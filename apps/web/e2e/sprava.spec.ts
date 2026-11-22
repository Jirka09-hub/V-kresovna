import { expect, test } from '@playwright/test'
import { signIn } from './auth-helpers'
import { addMember, admin, createOrg, createUser, dbAvailable, uniq } from './db'

test.skip(!dbAvailable, 'potřebuje lokální Supabase (pnpm db:start && pnpm db:env)')

test.describe('správa organizace a platformy', () => {
  test('správce změní roli, nepřijde o posledního správce a vytvoří pozvánku', async ({
    page,
    browser,
  }) => {
    const org = await createOrg({ name: `Učiliště ${uniq()}`, kind: 'school', seats: 5 })
    const orgAdmin = await createUser('Správkyně Jana')
    await addMember(orgAdmin.id, org.id, 'org_admin')
    const member = await createUser(`Karel Učitel ${uniq()}`)
    await addMember(member.id, org.id, 'participant')

    await signIn(page, orgAdmin.username, orgAdmin.password, '/sprava')
    await expect(page).toHaveURL(/\/cs\/sprava$/)
    await expect(page.getByTestId('license')).toContainText('1 z 5 obsazeno')
    await expect(page.getByTestId('org-code')).toHaveText(
      `${org.join_code.slice(0, 4)}-${org.join_code.slice(4)}`,
    )

    // účastník → školitel
    const row = page.getByTestId('org-member-row').filter({ hasText: member.displayName })
    await row.getByTestId('role-select').selectOption('trainer')
    await row.getByRole('button', { name: 'Uložit' }).click()
    await expect(page.getByTestId('license')).toContainText('0 z 5 obsazeno')
    const { data: m } = await admin()
      .from('memberships')
      .select('role')
      .eq('user_id', member.id)
      .eq('org_id', org.id)
      .single()
    expect(m!.role).toBe('trainer')

    // poslední správce se nesesadí
    const me = page.getByTestId('org-member-row').filter({ hasText: orgAdmin.displayName })
    await me.getByTestId('role-select').selectOption('participant')
    await me.getByRole('button', { name: 'Uložit' }).click()
    await expect(me.getByRole('alert')).toContainText('aspoň jednoho správce')

    // pozvánka
    const form = page.getByTestId('org-invitation-form')
    await form.getByLabel('Role').selectOption('trainer')
    await form.getByLabel('Pro koho (nepovinné)').fill('Pro Martina')
    await form.getByRole('button', { name: 'Vytvořit pozvánku' }).click()
    const link = await page.getByTestId('one-time-link-value').inputValue()
    expect(link).toMatch(/^http:\/\/localhost:\d+\/cs\/pozvanka\/[0-9a-f]{48}$/)
    await expect(page.getByTestId('pending-invitations')).toContainText('Pro Martina')

    const context = await browser.newContext()
    const guest = await context.newPage()
    await guest.goto(link)
    await expect(
      guest.getByText(`Pozvánka do organizace ${org.name} s rolí školitel.`),
    ).toBeVisible()
    await context.close()

    // zrušení pozvánky
    await page.getByTestId('pending-invitations').getByRole('button', { name: 'Zrušit' }).click()
    await expect(page.getByText('Žádné nevyužité pozvánky.')).toBeVisible()
  })

  test('účastník správu organizace ani platformy neuvidí', async ({ page }) => {
    const org = await createOrg()
    const user = await createUser()
    await addMember(user.id, org.id, 'participant')
    await signIn(page, user.username, user.password, '/sprava')
    await expect(page.getByTestId('no-access')).toBeVisible()
    await expect(page.getByTestId('org-members')).toHaveCount(0)
    await page.goto('/cs/platforma')
    await expect(page.getByTestId('no-access')).toBeVisible()
  })

  test('správce platformy založí organizaci a pozvánka pro správce funguje', async ({
    page,
    browser,
  }) => {
    const operator = await createUser('Provozovatel')
    await admin().from('platform_admins').insert({ user_id: operator.id })
    await signIn(page, operator.username, operator.password, '/platforma')
    await expect(page).toHaveURL(/\/cs\/platforma$/)

    const orgName = `Nová firma ${uniq()}`
    const create = page.getByTestId('create-org')
    await create.getByLabel('Název').fill(orgName)
    await create.getByLabel('Typ').selectOption('school')
    await create.getByLabel('Míst pro účastníky').fill('12')
    await create.getByLabel('Licence do (včetně)').fill('2031-06-30')
    await create.getByRole('button', { name: 'Založit organizaci' }).click()
    await expect(page.getByText(`Organizace ${orgName} je založená.`)).toBeVisible()
    const orgRow = page.getByTestId('platform-org-row').filter({ hasText: orgName })
    await expect(orgRow).toContainText('0 / 12')
    await expect(orgRow).toContainText('škola')

    await page
      .getByRole('button', { name: 'Vytvořit pozvánku pro správce organizace' })
      .first()
      .click()
    const link = await page.getByTestId('one-time-link-value').first().inputValue()
    expect(link).toContain('/cs/pozvanka/')

    // úprava licence
    await orgRow.getByText('Licence a pozvánka').click()
    await orgRow.getByLabel(`Počet míst: ${orgName}`).fill('20')
    await orgRow.getByRole('button', { name: 'Uložit licenci' }).click()
    await expect(page.getByTestId('platform-org-row').filter({ hasText: orgName })).toContainText(
      '0 / 20',
    )

    // pozvánka v čistém prohlížeči: nový správce si založí účet a skončí ve správě
    const context = await browser.newContext()
    const guest = await context.newPage()
    await guest.goto(link)
    await expect(
      guest.getByText(`Pozvánka do organizace ${orgName} s rolí správce organizace.`),
    ).toBeVisible()
    const form = guest.getByTestId('create-account-form')
    await form.getByLabel('Jméno a příjmení').fill('Nový Správce')
    await form.getByLabel('E-mail nebo přihlašovací jméno').fill(`spravce.${uniq()}`)
    await form.getByLabel('Heslo', { exact: true }).fill('tajne-heslo')
    await form.getByLabel('Heslo znovu').fill('tajne-heslo')
    await form.getByRole('button', { name: 'Vytvořit účet a připojit se' }).click()
    await expect(guest).toHaveURL(/\/cs\/sprava$/)
    await expect(guest.getByRole('main')).toContainText(orgName)
    await expect(guest.getByTestId('license')).toContainText('0 z 20 obsazeno')
    await context.close()
  })
})
