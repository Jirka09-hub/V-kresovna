import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { signIn } from './auth-helpers'
import { addMember, admin, createOrg, createUser, dbAvailable, uniq } from './db'

test.skip(!dbAvailable, 'potřebuje lokální Supabase (pnpm db:start && pnpm db:env)')

test.describe('můj účet', () => {
  test('změna jména a hesla', async ({ page }) => {
    const org = await createOrg()
    const user = await createUser('Jana Původní')
    await addMember(user.id, org.id, 'participant')
    await signIn(page, user.username, user.password)
    await expect(page).toHaveURL(/\/cs\/ucet$/)

    const nameForm = page.getByTestId('name-form')
    await nameForm.getByLabel('Zobrazované jméno').fill('Jana Nováková-Šťastná')
    await nameForm.getByRole('button', { name: 'Uložit jméno' }).click()
    await expect(nameForm.getByRole('status')).toHaveText('Jméno je uložené.')
    await expect(page.getByTestId('account-name')).toHaveText('Jana Nováková-Šťastná')
    await expect(page.getByTestId('user-menu-account')).toHaveText('Jana Nováková-Šťastná')
    const { data: profile } = await admin()
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
    expect(profile!.display_name).toBe('Jana Nováková-Šťastná')

    const pw = page.getByTestId('password-form')
    await pw.getByLabel('Současné heslo').fill('spatne-heslo')
    await pw.getByLabel('Nové heslo', { exact: true }).fill('nove-heslo-1')
    await pw.getByLabel('Nové heslo znovu').fill('nove-heslo-1')
    await pw.getByRole('button', { name: 'Změnit heslo' }).click()
    await expect(pw.getByRole('alert')).toContainText('Současné heslo nesedí')

    await pw.getByLabel('Současné heslo').fill(user.password)
    await pw.getByLabel('Nové heslo', { exact: true }).fill('nove-heslo-1')
    await pw.getByLabel('Nové heslo znovu').fill('nove-heslo-1')
    await pw.getByRole('button', { name: 'Změnit heslo' }).click()
    await expect(page.getByTestId('password-form').getByRole('status')).toHaveText(
      'Heslo je změněné.',
    )

    await page.getByTestId('sign-out').click()
    await expect(page.getByRole('link', { name: 'Přihlásit' })).toBeVisible()
    // staré heslo už neplatí, nové ano
    await page.goto('/cs/prihlaseni')
    await page.getByLabel('E-mail nebo přihlašovací jméno').fill(user.username)
    await page.getByLabel('Heslo').fill(user.password)
    await page.getByRole('button', { name: 'Přihlásit se' }).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText('nesedí')
    await signIn(page, user.username, 'nove-heslo-1')
    await expect(page.getByTestId('account-name')).toHaveText('Jana Nováková-Šťastná')
  })

  test('odchod z organizace; poslední správce odejít nemůže', async ({ page }) => {
    const orgA = await createOrg({ name: `Firma A ${uniq()}` })
    const orgB = await createOrg({ name: `Firma B ${uniq()}` })
    const user = await createUser('Pracovník Dvou Firem')
    await addMember(user.id, orgA.id, 'participant')
    await addMember(user.id, orgB.id, 'org_admin')
    await signIn(page, user.username, user.password)

    const orgs = page.getByTestId('account-orgs')
    const rowA = orgs.locator(`li[data-org="${orgA.id}"]`)
    const rowB = orgs.locator(`li[data-org="${orgB.id}"]`)
    // poslední správce organizace B
    await rowB.getByTestId('leave-org').click()
    await rowB.getByTestId('leave-confirm').click()
    await expect(rowB.getByRole('alert')).toContainText('poslední správce')

    await rowA.getByTestId('leave-org').click()
    await expect(rowA).toContainText(`opustit organizaci ${orgA.name}`)
    await rowA.getByTestId('leave-confirm').click()
    await expect(rowA).toHaveCount(0)
    await expect(rowB).toBeVisible()
    const { data } = await admin().from('memberships').select('org_id').eq('user_id', user.id)
    expect(data).toEqual([{ org_id: orgB.id }])
  })

  test('postup a certifikáty v účtu, PDF ke stažení znovu', async ({ page }) => {
    const org = await createOrg({ name: `Škola ${uniq()}` })
    const user = await createUser('Žák Certifikátu')
    await addMember(user.id, org.id, 'participant')
    // dokončená lekce a vydaný certifikát (data jako po průchodu aplikací)
    const { data: run } = await admin()
      .from('lesson_runs')
      .insert({
        user_id: user.id,
        org_id: org.id,
        module_slug: 'pohledy-a-rezy',
        lesson_slug: 'diry-a-osy',
        task_count: 4,
        engine_version: '0.4.0',
        finished_at: new Date().toISOString(),
        correct_count: 3,
      })
      .select('id')
      .single()
    const code = `T${uniq().toUpperCase()}XYZAB`.slice(0, 16)
    await admin().from('certificates').insert({
      user_id: user.id,
      org_id: org.id,
      module_slug: 'pohledy-a-rezy',
      run_id: run!.id,
      score: 0.83,
      holder_name: 'Žák Certifikátu',
      org_name: org.name,
      verification_code: code,
    })

    await signIn(page, user.username, user.password)
    const progress = page.getByTestId('account-progress')
    await expect(progress).toContainText('Dokončené lekce: 1 z 8')
    await expect(progress).toContainText('Závěrečný test: zatím nedokončený')

    const cert = page.getByTestId('account-certificate')
    await expect(cert).toContainText('Pohledy a řezy jednoduchých součástí')
    await expect(cert).toContainText('83 %')
    await expect(cert).toContainText(code.match(/.{4}/g)!.join('-'))
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      cert.getByTestId('certificate-download').click(),
    ])
    const pdf = readFileSync((await download.path())!)
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    await cert.getByRole('link', { name: 'Ověřovací stránka' }).click()
    await expect(page.getByTestId('verify-holder')).toHaveText('Žák Certifikátu')
  })

  test('smazání účtu odstraní uživatele i jeho výsledky', async ({ page }) => {
    const org = await createOrg()
    const user = await createUser('Mazaný Uživatel')
    await addMember(user.id, org.id, 'participant')
    await admin().from('attempts').insert({
      user_id: user.id,
      org_id: org.id,
      module_slug: 'pohledy-a-rezy',
      lesson_slug: 'diry-a-osy',
      exercise_type: 'dimension',
      difficulty: 1,
      seed: 1,
      engine_version: '0.4.0',
      is_correct: true,
      score: 1,
    })
    await signIn(page, user.username, user.password)

    const form = page.getByTestId('delete-form')
    const submit = form.getByTestId('delete-submit')
    await form.getByLabel('Pro potvrzení napište SMAZAT').fill('smazat')
    await expect(submit).toBeDisabled()
    await form.getByLabel('Pro potvrzení napište SMAZAT').fill('SMAZAT')
    await submit.click()

    await expect(page).toHaveURL(/\/cs\?ucet=smazan$/)
    await expect(page.getByTestId('account-deleted')).toContainText('Účet je smazaný')
    await expect(page.getByRole('link', { name: 'Přihlásit' })).toBeVisible()
    const { data: auth } = await admin().auth.admin.getUserById(user.id)
    expect(auth.user).toBeNull()
    const { data: attempts } = await admin().from('attempts').select('id').eq('user_id', user.id)
    expect(attempts).toEqual([])
    // stará session už nic neotevře
    await page.goto('/cs/ucet')
    await expect(page).toHaveURL(/\/cs\/prihlaseni/)
  })
})
