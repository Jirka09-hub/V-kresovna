import { expect, test } from '@playwright/test'
import {
  answerCurrent,
  answerDimension,
  chooseOption,
  currentKind,
  fixSeeds,
  placeSectionWithKeyboard,
  solveCurrent,
} from './helpers'

// Seedy vybrané tak, aby varianty úloh byly předem známé (viz generátor v packages/exercises):
// řez obtížnosti 1 seed 7001 = „vyber řez“, 7002 = „umísti rovinu“; obtížnost 2 seed 7003 =
// „umísti rovinu“; kóta obtížnosti 1 seed 7001 = celková délka, obtížnosti 4 seed 7001 = složená.

test.describe('řez a kóty', () => {
  test.setTimeout(150_000)

  test('lekce 7: živý řez v úvodu, výběr řezu a umístění roviny klávesnicí', async ({ page }) => {
    await fixSeeds(page, [7001, 7003, 7001, 7004])
    await page.goto('/cs/lekce/rez-a-srafovani')
    const demo = page.getByTestId('section-demo')
    await expect(demo).toBeVisible()
    const drawing = demo.locator('svg[data-part]')
    await expect(drawing.locator('g[data-section="A"]')).toBeAttached({ timeout: 20_000 })
    await expect(drawing.locator('.cuttingPlaneLine').first()).toBeAttached()
    // posun roviny klávesnicí přepočítá výkres
    const slider = demo.getByTestId('section-demo-slider')
    const before = await slider.inputValue()
    await slider.focus()
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight')
    await expect(slider).not.toHaveValue(before)
    await expect(demo.locator('canvas')).toBeVisible()
    await page.getByTestId('next-screen').click()
    await expect(page.getByTestId('section-demo')).toBeVisible()
    await page.getByTestId('to-tasks').click()

    // 1. vyber řez A–A: dané pohledy se stopou roviny, čtyři možnosti
    expect(await currentKind(page)).toBe('section')
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-seed', '7001')
    const choose = page.getByTestId('section-choose')
    await expect(choose).toBeVisible()
    await expect(choose.getByTestId('option')).toHaveCount(4)
    await expect(choose.locator('.cuttingPlaneLine').first()).toBeAttached({ timeout: 20_000 })
    await chooseOption(page)
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-correct', 'true')
    // po odpovědi model ukáže řez
    await expect(page.getByTestId('section-frame')).toBeVisible()
    await page.getByTestId('next').click()

    // 2. umísti rovinu řezu jen klávesnicí
    expect(await currentKind(page)).toBe('section')
    await expect(page.getByTestId('section-place')).toBeVisible()
    await placeSectionWithKeyboard(page)
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('next')).toBeFocused()
    await page.keyboard.press('Enter')

    // 3. a adaptivní 4. úloha, pak shrnutí
    await solveCurrent(page)
    await page.getByTestId('next').click()
    await solveCurrent(page)
    await page.getByTestId('next').click()
    await expect(page.getByTestId('summary')).toBeVisible()
  })

  test('umísti rovinu: chybná poloha ukáže správnou rovinu i řez v mé rovině', async ({ page }) => {
    await fixSeeds(page, [7002])
    await page.goto('/cs/lekce/rez-a-srafovani')
    await page.getByTestId('next-screen').click()
    await page.getByTestId('to-tasks').click()
    expect(await currentKind(page)).toBe('section')
    const place = page.getByTestId('section-place')
    await expect(place).toBeVisible()
    await expect(place.locator('g[data-section="A"]')).toBeAttached({ timeout: 20_000 })
    // výchozí poloha je vždy mimo toleranci
    await page.getByTestId('check').click()
    const feedback = page.getByTestId('feedback')
    await expect(feedback).toHaveAttribute('data-correct', 'false')
    await expect(feedback.locator('[data-error-code="WRONG_SECTION_PLANE"]')).toBeVisible()
    await expect(page.getByTestId('section-slider')).toBeDisabled()
    const show = page.getByTestId('show-correct-plane')
    await show.click()
    await expect(show).toHaveAttribute('aria-pressed', 'true')
    const target = await place.getAttribute('data-test-answer-at')
    await expect(page.getByTestId('section-slider')).toHaveValue(target!)
    await expect(feedback.getByText('Řez ve vaší rovině')).toBeVisible()
  })

  test('vyber řez: chybná možnost vyznačí správnou', async ({ page }) => {
    await fixSeeds(page, [7001])
    await page.goto('/cs/lekce/rez-a-srafovani')
    await page.getByTestId('next-screen').click()
    await page.getByTestId('to-tasks').click()
    expect(await currentKind(page)).toBe('section')
    await chooseOption(page, false)
    const feedback = page.getByTestId('feedback')
    await expect(feedback).toHaveAttribute('data-correct', 'false')
    await expect(feedback.locator('[data-error-code]').first()).toBeVisible()
    await expect(page.locator('[data-testid="option"][data-status="correct"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="option"][data-status="wrong"]')).toHaveCount(1)
  })

  test('lekce 8: kóty v úvodu, odpověď číslem, chyba s vysvětlením, složená otázka', async ({
    page,
  }) => {
    await fixSeeds(page, [7001, 7003, 7001, 7001, 7002])
    await page.goto('/cs/lekce/koty')
    const demo = page.getByTestId('dimension-demo')
    await expect(demo).toBeVisible()
    const drawing = demo.locator('svg[data-part]')
    await expect(drawing.locator('[data-dimension-id]').first()).toBeAttached({ timeout: 20_000 })
    const feature = demo.getByTestId('dimension-feature').first()
    await feature.click()
    await expect(feature).toHaveAttribute('aria-pressed', 'true')
    await expect(
      drawing.locator('[data-dimension-id][data-highlight="true"]').first(),
    ).toBeAttached()
    await expect(demo.getByTestId('dimension-demo-status')).not.toBeEmpty()
    await page.getByTestId('next-screen').click()
    await page.getByTestId('to-tasks').click()

    // 1. přímo okótovaný rozměr; nejdřív neplatný vstup
    expect(await currentKind(page)).toBe('dimension')
    const dim = page.getByTestId('dimension')
    await expect(dim.locator('svg [data-dimension-id]').first()).toBeAttached({ timeout: 20_000 })
    await expect(page.getByTestId('dim-question')).not.toBeEmpty()
    const input = page.getByTestId('dim-input')
    await input.fill('abc')
    await input.press('Enter')
    await expect(dim.getByRole('alert')).toBeVisible()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await answerDimension(page)
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-correct', 'true')
    await page.getByTestId('next').click()

    // 2. schválně špatně: vysvětlení chyby a správná hodnota
    expect(await currentKind(page)).toBe('dimension')
    await answerDimension(page, false)
    const feedback = page.getByTestId('feedback')
    await expect(feedback).toHaveAttribute('data-correct', 'false')
    await expect(feedback.locator('[data-error-code^="DIMENSION_"]').first()).toBeVisible()
    await expect(page.getByTestId('dim-correct')).toBeVisible()
    await page.getByTestId('next').click()

    // 3. a 4. (složená otázka: hodnota není okótovaná, musí se dopočítat)
    await solveCurrent(page)
    await page.getByTestId('next').click()
    expect(await currentKind(page)).toBe('dimension')
    await expect(page.getByTestId('dimension')).toHaveAttribute('data-question', 'wallBeyond')
    await solveCurrent(page)
    await page.getByTestId('next').click()

    // 5. adaptivní (kóty nebo řez), pak shrnutí
    await solveCurrent(page)
    await page.getByTestId('next').click()
    await expect(page.getByTestId('summary')).toBeVisible()
  })

  test('lekce 9: závěrečný test bez zpětné vazby a výsledky s rozpisem', async ({ page }) => {
    test.setTimeout(300_000)
    await fixSeeds(page, [424242])
    await page.goto('/cs/lekce/zaverecny-test')
    const intro = page.getByTestId('test-intro')
    await expect(intro).toBeVisible()
    await expect(intro).toContainText('12 úloh')
    await expect(intro).toContainText('75 %')
    await page.getByTestId('start-test').click()

    let wrongDone = false
    const kinds = new Set<string>()
    for (let i = 1; i <= 12; i++) {
      await expect(
        page.getByRole('heading', { level: 2, name: new RegExp(`Úloha ${i} z 12`) }),
      ).toBeVisible()
      const kind = await currentKind(page)
      // jednu kótu schválně špatně, ať je ve výsledcích vysvětlení chyby
      const correct = !(kind === 'dimension' && !wrongDone)
      if (!correct) wrongDone = true
      await answerCurrent(page, correct)
      kinds.add(kind)
      // během testu žádná zpětná vazba, rovnou další úloha
      await expect(page.getByTestId('feedback')).toHaveCount(0)
      await expect(page.getByTestId('test-saved')).toContainText(`${i}`)
    }
    expect(kinds.size).toBe(6)

    const results = page.getByTestId('test-results')
    await expect(results).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Výsledek testu' })).toBeFocused()
    await expect(results).toHaveAttribute('data-score', '11')
    await expect(results).toHaveAttribute('data-passed', 'true')
    await expect(page.getByTestId('test-by-kind').locator('tbody tr')).toHaveCount(6)
    const mistakes = page.getByTestId('test-mistakes').locator('li')
    await expect(mistakes).toHaveCount(1)
    await expect(mistakes.first()).toContainText('Odečti kótu')
    await expect(page.getByTestId('certificate-note')).toBeVisible()

    await page.getByTestId('retry-test').click()
    await expect(page.getByRole('heading', { level: 2, name: /Úloha 1 z 12/ })).toBeVisible()
  })
})
