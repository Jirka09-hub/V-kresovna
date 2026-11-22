import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { signIn } from './auth-helpers'
import {
  addGroupMember,
  addMember,
  admin,
  createGroup,
  createOrg,
  createUser,
  dbAvailable,
  uniq,
} from './db'

test.skip(!dbAvailable, 'potřebuje lokální Supabase (pnpm db:start && pnpm db:env)')

const MODULE = 'pohledy-a-rezy'

test.describe('školitel', () => {
  test('založí skupinu a účty, vidí postup, přiřadí lekci, stáhne CSV a nastaví nové heslo', async ({
    page,
    browser,
  }) => {
    const org = await createOrg({ name: `Strojírna ${uniq()}` })
    const trainer = await createUser('Školitelka Dana')
    await addMember(trainer.id, org.id, 'trainer')

    await signIn(page, trainer.username, trainer.password, '/skolitel')
    await expect(page).toHaveURL(/\/cs\/skolitel$/)
    await expect(page.getByText('Zatím tu není žádná skupina.')).toBeVisible()

    const groupName = `Ranní směna ${uniq()}`
    await page.getByLabel('Název skupiny').fill(groupName)
    await page.getByRole('button', { name: 'Založit skupinu' }).click()
    await expect(page).toHaveURL(/\/cs\/skolitel\/skupina\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { level: 1, name: groupName })).toBeVisible()
    const groupId = page.url().split('/').at(-1)!

    // hromadné založení dvou účtů
    const tag = uniq().replace(/[0-9]/g, '').slice(0, 4) || 'abc'
    const names = [`Petr Svoboda ${tag}`, `Eva Malá ${tag}`]
    await page.getByLabel('Jména, jedno na řádek').fill(names.join('\n'))
    await page.getByRole('button', { name: 'Založit účty' }).click()
    const result = page.getByTestId('bulk-result')
    await expect(result.getByTestId('bulk-row')).toHaveCount(2)
    await expect(result).toContainText('Založeny 2 účty.')
    const login = (await result.getByTestId('bulk-login').first().textContent())!.trim()
    expect(login).toBe(`petr.svoboda.${tag}`)
    await expect(result.getByRole('button', { name: 'Vytisknout' })).toBeVisible()

    // objeví se v matici
    const matrix = page.getByTestId('progress-matrix')
    await expect(matrix.getByTestId('matrix-row')).toHaveCount(2)
    await expect(matrix).toContainText(names[0]!)
    await expect(matrix).toContainText(names[1]!)

    // výsledek a chyba účastníka → matice a nejčastější chyby
    const { data: petr } = await admin()
      .from('profiles')
      .select('id')
      .eq('username', login)
      .single()
    await admin().from('lesson_runs').insert({
      user_id: petr!.id,
      org_id: org.id,
      module_slug: MODULE,
      lesson_slug: 'jak-vznikaji-pohledy',
      task_count: 5,
      engine_version: '0.4.0',
      finished_at: new Date().toISOString(),
      correct_count: 4,
    })
    await admin()
      .from('attempts')
      .insert({
        user_id: petr!.id,
        org_id: org.id,
        module_slug: MODULE,
        lesson_slug: 'jak-vznikaji-pohledy',
        exercise_type: 'assign-views',
        difficulty: 1,
        seed: 1,
        engine_version: '0.4.0',
        is_correct: false,
        score: 0,
        error_codes: ['MIRRORED'],
      })

    // přiřazení lekce s termínem
    const assign = page.getByTestId('assign-lesson')
    await assign
      .getByLabel('Lekce', { exact: true })
      .selectOption({ label: '1. Jak vznikají pohledy' })
    await assign.getByLabel('Termín (nepovinný)').fill('2030-01-15')
    await assign.getByRole('button', { name: 'Přiřadit lekci' }).click()
    const assignments = page.getByTestId('assignments')
    await expect(assignments).toContainText('1. Jak vznikají pohledy')
    await expect(assignments).toContainText('Termín 15. 1. 2030')
    await expect(matrix.locator('th[data-assigned="true"]')).toContainText('do 15. 1. 2030')
    await expect(matrix.getByTestId('matrix-row').filter({ hasText: names[0]! })).toContainText(
      '80 %',
    )
    await expect(page.getByTestId('common-mistakes')).toContainText('zrcadlově obrácená')

    // změna termínu
    await assignments.getByLabel('Termín pro lekci Jak vznikají pohledy').fill('2030-02-01')
    await assignments.getByRole('button', { name: 'Uložit termín' }).click()
    await expect(assignments).toContainText('Termín 1. 2. 2030')

    // export CSV
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('csv-export').click(),
    ])
    expect(download.suggestedFilename()).toMatch(
      /^vysledky-ranni-smena-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.csv$/,
    )
    const csv = await readFile((await download.path())!, 'utf8')
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Jméno;Přihlašovací jméno;1. Jak vznikají pohledy')
    expect(csv).toContain(`${names[0]};${login};hotovo 80 %`)
    expect(csv).toContain(names[1]!)

    // nové heslo a přihlášení účastníka
    const row = page.getByTestId('member-row').filter({ hasText: names[0]! })
    page.once('dialog', (d) => void d.accept())
    await row.getByRole('button', { name: `Nové heslo pro ${names[0]}` }).click()
    const newPassword = (await row.getByTestId('new-password-value').textContent())!.trim()
    expect(newPassword).toMatch(/^[a-z2-9]{8}$/)

    const context = await browser.newContext()
    const participantPage = await context.newPage()
    await signIn(participantPage, login, newPassword)
    await expect(participantPage).toHaveURL(/\/cs\/ucet$/)
    await expect(participantPage.getByTestId('account-orgs')).toContainText(org.name)
    // účastník přehled školitele nevidí
    await participantPage.goto('/cs/skolitel')
    await expect(participantPage.getByTestId('no-access')).toBeVisible()
    const res = await participantPage.goto(`/cs/skolitel/skupina/${groupId}`)
    expect(res?.status()).toBe(404)
    await context.close()

    // skupina je v přehledu s počty
    await page.goto('/cs/skolitel')
    await expect(page.getByTestId('group-list')).toContainText(groupName)
    await expect(page.getByTestId('group-list')).toContainText('2 účastníci · 1 přiřazená lekce')
  })

  test('cizí školitel skupinu neuvidí (izolace organizací)', async ({ page }) => {
    const orgA = await createOrg()
    const orgB = await createOrg()
    const trainerA = await createUser('Školitel A')
    await addMember(trainerA.id, orgA.id, 'trainer')
    const group = await createGroup(orgA.id, `Skupina A ${uniq()}`, trainerA.id)
    const participant = await createUser('Účastník A')
    await addMember(participant.id, orgA.id, 'participant')
    await addGroupMember(group.id, orgA.id, participant.id)

    const trainerB = await createUser('Školitel B')
    await addMember(trainerB.id, orgB.id, 'trainer')
    await signIn(page, trainerB.username, trainerB.password, '/skolitel')
    const res = await page.goto(`/cs/skolitel/skupina/${group.id}`)
    expect(res?.status()).toBe(404)
    await expect(page.getByText(group.name)).toHaveCount(0)
    await page.goto('/cs/skolitel')
    await expect(page.getByText(group.name)).toHaveCount(0)
  })

  test('druhý školitel stejné organizace cizí skupinu nespravuje', async ({ page }) => {
    const org = await createOrg()
    const trainer1 = await createUser('Školitel 1')
    const trainer2 = await createUser('Školitel 2')
    await addMember(trainer1.id, org.id, 'trainer')
    await addMember(trainer2.id, org.id, 'trainer')
    const group = await createGroup(org.id, `Cizí ${uniq()}`, trainer1.id)
    await signIn(page, trainer2.username, trainer2.password, '/skolitel')
    await expect(page.getByText(group.name)).toHaveCount(0)
    const res = await page.goto(`/cs/skolitel/skupina/${group.id}`)
    expect(res?.status()).toBe(404)
  })
})
