import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signIn } from './auth-helpers'
import { admin, createUser, dbAvailable, uniq } from './db'

/** Past na roboty hlídá, že formulář nebyl odeslán dřív než za 3 s; test čekat nemusí. */
async function pretendSlowFill(page: Page) {
  await page
    .locator('input[name="startedAt"]')
    .evaluate((el: HTMLInputElement) => (el.value = String(Date.now() - 10_000)))
}

async function fillPilot(page: Page, email: string, organization: string) {
  const form = page.getByTestId('pilot-form')
  await form.getByLabel('Škola', { exact: true }).check()
  await form.getByLabel('Jméno a příjmení').fill('Jana Testová')
  await form.getByLabel('Firma nebo škola').fill(organization)
  await form.getByLabel('E-mail').fill(email)
  await form.getByLabel(/Kolik lidí/).fill('28')
  await form.getByLabel(/Co potřebujete/).fill('Pohledy a řezy pro 2. ročník.')
  await form.getByLabel(/Rozumím/).check()
}

test.describe('úvodní stránka', () => {
  test('živá ukázka se načte bez výpočetního jádra a propojí model s výkresem', async ({
    page,
  }) => {
    const wasm: string[] = []
    page.on('request', (r) => {
      if (/\.wasm$|engine\.worker/.test(r.url())) wasm.push(r.url())
    })
    await page.goto('/cs')
    const sample = page.getByTestId('landing-sample')
    await sample.scrollIntoViewIfNeeded()
    await expect(sample).toHaveAttribute('data-status', 'ready')
    await expect(sample.locator('.vk-drawing')).toBeVisible()
    await sample.getByRole('button', { name: 'průchozí díra' }).click()
    await expect(sample.getByRole('button', { name: 'průchozí díra' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(wasm).toEqual([])
  })

  test('tlačítko „Chci pilot pro školu“ předvybere školu', async ({ page }) => {
    await page.goto('/cs')
    await page.getByTestId('pilot-cta-school').click()
    await expect(page).toHaveURL(/#pilot$/)
    await expect(page.getByTestId('pilot-form').getByLabel('Škola', { exact: true })).toBeChecked()
  })

  test('formulář pilotu vypíše chyby a vyplněné hodnoty nesmaže', async ({ page }) => {
    await page.goto('/cs#pilot')
    const form = page.getByTestId('pilot-form')
    await form.getByLabel('Jméno a příjmení').fill('Jana Testová')
    await form.getByLabel('E-mail').fill('neplatny-email')
    await pretendSlowFill(page)
    await page.getByTestId('pilot-submit').click()
    await expect(page.getByTestId('pilot-error')).toHaveText('Zkontrolujte prosím označená pole.')
    await expect(form.getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByText('Zadejte platný e-mail.')).toBeVisible()
    await expect(form.getByLabel('Jméno a příjmení')).toHaveValue('Jana Testová')
    await expect(form.getByLabel('Jméno a příjmení')).not.toHaveAttribute('aria-invalid')
  })

  test('příliš rychlé odeslání formuláře se nepřijme', async ({ page }) => {
    await page.goto('/cs#pilot')
    await fillPilot(page, `rychly-${uniq()}@test.invalid`, 'SPŠ Rychlá')
    await page.getByTestId('pilot-submit').click()
    await expect(page.getByTestId('pilot-error')).toContainText('moc rychle')
  })

  for (const path of [
    '/cs',
    '/cs/zasady',
    '/cs/demo',
    '/cs/lekce',
    '/cs/lekce/jak-vznikaji-pohledy',
    '/cs/prihlaseni',
    '/cs/overeni',
  ]) {
    test(`přístupnost ${path} (axe, WCAG 2.1 AA)`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('canvas')
        .analyze()
      const summary = result.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
      )
      expect(summary).toEqual([])
    })
  }
})

test.describe('poptávka pilotu v databázi', () => {
  test.skip(!dbAvailable, 'potřebuje lokální Supabase (pnpm db:start && pnpm db:env)')

  test('poptávka se uloží a provozovatel ji vyřídí a smaže', async ({ page, browser }) => {
    const email = `pilot-${uniq()}@test.invalid`
    const organization = `SPŠ ${uniq()}`
    await page.goto('/cs#pilot')
    await fillPilot(page, email, organization)
    await pretendSlowFill(page)
    await page.getByTestId('pilot-submit').click()
    await expect(page.getByTestId('pilot-success')).toBeFocused()

    const { data } = await admin().from('pilot_requests').select('*').eq('email', email).single()
    expect(data).toMatchObject({ segment: 'school', organization, headcount: 28, phone: null })

    const operator = await createUser('Provozovatel poptávek')
    await admin().from('platform_admins').insert({ user_id: operator.id })
    const ctx = await browser.newContext()
    const op = await ctx.newPage()
    await signIn(op, operator.username, operator.password, '/platforma')
    const item = op.getByTestId('pilot-request').filter({ hasText: organization })
    await expect(item).toContainText(email)
    await expect(item).toHaveAttribute('data-handled', 'false')
    await item.getByTestId('pilot-request-toggle').click()
    await expect(item).toHaveAttribute('data-handled', 'true')
    op.once('dialog', (d) => d.accept())
    await item.getByTestId('pilot-request-delete').click()
    await expect(item).toHaveCount(0)
    await ctx.close()
  })

  test('vyplněné skryté pole (robot) vypadá jako úspěch, ale nic se neuloží', async ({ page }) => {
    const email = `robot-${uniq()}@test.invalid`
    await page.goto('/cs#pilot')
    await fillPilot(page, email, 'Robot s.r.o.')
    await page.locator('input[name="website"]').fill('https://spam.example')
    await pretendSlowFill(page)
    await page.getByTestId('pilot-submit').click()
    await expect(page.getByTestId('pilot-success')).toBeVisible()
    const { data } = await admin().from('pilot_requests').select('id').eq('email', email)
    expect(data).toEqual([])
  })
})
