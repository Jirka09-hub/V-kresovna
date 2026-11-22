import { expect, test } from '@playwright/test'
import { signIn } from './auth-helpers'
import { addMember, admin, createOrg, createUser, dbAvailable, uniq, userClient } from './db'

test.skip(!dbAvailable, 'potřebuje lokální Supabase (pnpm db:start && pnpm db:env)')

test.describe('účty a připojení', () => {
  test('nový účastník se připojí kódem skupiny, odhlásí a znovu přihlásí jménem', async ({
    page,
  }) => {
    const org = await createOrg({ name: `Strojírna ${uniq()}` })
    const trainer = await createUser('Školitel Kód')
    await addMember(trainer.id, org.id, 'trainer')
    const { data: group } = await admin()
      .from('groups')
      .insert({ org_id: org.id, name: 'Ranní směna', created_by: trainer.id })
      .select()
      .single()
    const code = group!.join_code!

    await page.goto(`/cs/pripojit?kod=${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`)
    await expect(
      page.getByText(`Připojíte se do organizace ${org.name}, skupina Ranní směna.`),
    ).toBeVisible()
    const form = page.getByTestId('create-account-form')
    const username = `jan.${uniq()}`
    await form.getByLabel('Jméno a příjmení').fill('Jan Novák')
    await form.getByLabel('E-mail nebo přihlašovací jméno').fill(username)
    await form.getByLabel('Heslo', { exact: true }).fill('tajne-heslo')
    await form.getByLabel('Heslo znovu').fill('tajne-heslo')
    await form.getByRole('button', { name: 'Vytvořit účet a připojit se' }).click()

    await expect(page).toHaveURL(/\/cs\/lekce$/)
    await expect(page.getByTestId('user-menu-account')).toHaveText('Jan Novák')

    // je ve skupině
    const { data: profile } = await admin()
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()
    const { data: gm } = await admin()
      .from('group_members')
      .select('role')
      .eq('user_id', profile!.id)
    expect(gm).toEqual([{ role: 'participant' }])

    await page.goto('/cs/ucet')
    await page.getByTestId('sign-out').click()
    await expect(page.getByRole('link', { name: 'Přihlásit' })).toBeVisible()

    await signIn(page, username, 'tajne-heslo')
    await expect(page).toHaveURL(/\/cs\/ucet$/)
    await expect(page.getByTestId('account-orgs')).toContainText(org.name)
  })

  test('špatné heslo, plná organizace a neplatný kód', async ({ page }) => {
    const org = await createOrg({ seats: 0 })
    await page.goto(`/cs/pripojit?kod=${org.join_code}`)
    await expect(page.getByRole('main').getByRole('alert')).toContainText('nemá volná místa')
    await page.goto('/cs/pripojit?kod=XXXXXXXX')
    await expect(page.getByRole('main').getByRole('alert')).toContainText('neplatí')

    const user = await createUser()
    await page.goto('/cs/prihlaseni')
    await page.getByLabel('E-mail nebo přihlašovací jméno').fill(user.username)
    await page.getByLabel('Heslo').fill('spatne-heslo')
    await page.getByRole('button', { name: 'Přihlásit se' }).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText('nesedí')
  })

  test('přihlášený uživatel přijme pozvánku školitele do druhé organizace', async ({ page }) => {
    const orgA = await createOrg({ name: `Agentura ${uniq()}` })
    const orgB = await createOrg({ name: `Firma B ${uniq()}` })
    const orgAdmin = await createUser('Správce B')
    await addMember(orgAdmin.id, orgB.id, 'org_admin')
    const user = await createUser('Pracovník Agentury')
    await addMember(user.id, orgA.id, 'participant')

    const adminApi = await userClient(orgAdmin.username, orgAdmin.password)
    const { data: token, error } = await adminApi.rpc('create_invitation', {
      p_org: orgB.id,
      p_role: 'trainer',
    })
    expect(error).toBeNull()

    await signIn(page, user.username, user.password, `/pozvanka/${token}`)
    await expect(
      page.getByText(`Pozvánka do organizace ${orgB.name} s rolí školitel.`),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Přijmout pozvánku' }).click()
    await expect(page).toHaveURL(/\/cs\/skolitel/)

    await page.goto('/cs/ucet')
    const orgs = page.getByTestId('account-orgs')
    await expect(orgs).toContainText(orgA.name)
    await expect(orgs).toContainText(orgB.name)
    // pozvánka je jednorázová
    await page.goto(`/cs/pozvanka/${token}`)
    await expect(page.getByRole('main').getByRole('alert')).toContainText('už byla použita')
  })
})
