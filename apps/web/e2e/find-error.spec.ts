import { expect, test, type Page } from '@playwright/test'
import {
  currentKind,
  solveCurrent,
  solveFindErrorWithClick,
  solveFindErrorWithKeyboard,
} from './helpers'

/** Schválně špatná odpověď: u chyby čáry tlačítko rozmístění, u chyby rozmístění nárys. */
async function answerWrong(page: Page) {
  const drawing = page.getByTestId('find-error-drawing')
  if ((await drawing.getAttribute('data-layout-error')) === 'true') {
    const cell = page.locator('[data-testid="find-error-cell"][data-view="front"][data-cell="1,1"]')
    await cell.click()
    await expect(page.getByTestId('selection')).toContainText('nárys')
  } else {
    await page.getByTestId('layout-wrong').click()
    await expect(page.getByTestId('layout-wrong')).toHaveAttribute('aria-pressed', 'true')
  }
  await page.getByTestId('check').click()
  const feedback = page.getByTestId('feedback')
  await expect(feedback).toHaveAttribute('data-correct', 'false')
  await expect(feedback.locator('[data-error-code="MISSED_ERROR"]')).toBeVisible()
  // místo chyby je po odpovědi vyznačené
  await expect(drawing.getByTestId('target-highlight').first()).toBeAttached()
}

test.describe('najdi chybu ve výkresu', () => {
  test.setTimeout(150_000)

  test('demo: klik na místo chyby, pak správný výkres', async ({ page }) => {
    await page.goto('/cs/demo')
    await page.getByTestId('start-tasks').click()
    for (let i = 1; i <= 3; i++) {
      await solveCurrent(page)
      await page.getByTestId('next').click()
    }
    await expect(page.getByRole('heading', { level: 2, name: /Úloha 4 z 5/ })).toBeVisible()
    expect(await currentKind(page)).toBe('find-error')
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-seed', '4409')
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20_000 })
    // klik mimo pohledy se nepočítá
    const drawing = page.getByTestId('find-error-drawing')
    const box = (await drawing.boundingBox())!
    await drawing.click({ position: { x: box.width - 3, y: box.height - 3 } })
    await expect(page.getByTestId('selection')).toContainText('mimo pohledy')
    await expect(page.getByTestId('check')).toBeDisabled()

    await solveFindErrorWithClick(page, false)
    await expect(page.getByTestId('feedback')).toContainText('Chyba je v tomto pohledu')
    await page.getByTestId('toggle-correct').click()
    await expect(drawing).toHaveAttribute('data-showing', 'correct')
    await expect(page.getByRole('heading', { name: 'Správný výkres' })).toBeVisible()
    await page.getByTestId('toggle-correct').click()
    await expect(drawing).toHaveAttribute('data-showing', 'task')
  })

  test('lekce 6: výklad, klávesnice, myš, chyba a adaptivní úlohy', async ({ page }) => {
    await page.goto('/cs/lekce')
    await page.getByRole('link', { name: /Chyby ve výkresu/ }).click()
    await expect(page).toHaveURL(/\/cs\/lekce\/chyby-ve-vykresu$/)
    await expect(page.getByTestId('intro')).toBeVisible()
    await expect(page.locator('svg[data-part] g[data-view]')).toHaveCount(3, { timeout: 20_000 })
    await page.getByTestId('next-screen').click()

    // ukázka chyby: zvýraznit chybu, přepnout na správný výkres
    const example = page.getByTestId('error-example-drawing')
    await expect(example.locator('svg g[data-view]')).toHaveCount(3, { timeout: 20_000 })
    await expect(example.locator('[data-highlight="true"]')).toHaveCount(0)
    await page.getByTestId('reveal-error').click()
    await expect(example.locator('[data-highlight="true"]').first()).toBeAttached()
    await page.getByTestId('toggle-correct-example').click()
    await expect(example).toHaveAttribute('data-showing', 'correct')
    await page.getByTestId('to-tasks').click()

    await expect(page.getByRole('heading', { level: 2, name: /Úloha 1 z 5/ })).toBeVisible()
    expect(await currentKind(page)).toBe('find-error')
    await solveFindErrorWithKeyboard(page)
    await page.keyboard.press('Enter') // fokus je na „Další úloha“

    await expect(page.getByRole('heading', { level: 2, name: /Úloha 2 z 5/ })).toBeVisible()
    expect(await currentKind(page)).toBe('find-error')
    await solveFindErrorWithClick(page)
    await page.getByTestId('next').click()

    await expect(page.getByRole('heading', { level: 2, name: /Úloha 3 z 5/ })).toBeVisible()
    expect(await currentKind(page)).toBe('find-error')
    await answerWrong(page)
    await page.getByTestId('next').click()

    // úlohy 4 a 5 se vybírají podle chyb (po chybě v hledání chyb nejspíš znovu „najdi chybu“)
    for (const n of [4, 5]) {
      await expect(page.getByRole('heading', { level: 2, name: `Úloha ${n} z 5` })).toBeVisible()
      const exercise = page.getByTestId('exercise')
      await expect(exercise).toHaveAttribute('data-adaptive', /weakness|practice/)
      if ((await exercise.getAttribute('data-adaptive')) === 'weakness') {
        await expect(page.getByTestId('adaptive-hint')).toHaveText(
          'Úloha vybraná podle vašich chyb',
        )
      }
      const kind = await solveCurrent(page)
      expect(['find-error', 'missing-view']).toContain(kind)
      await page.getByTestId('next').click()
    }
    const summary = page.getByTestId('summary')
    await expect(summary).toBeVisible()
    await expect(summary).toContainText('z 5 úloh')
    await expect(summary).toContainText('Na tomhle místě chyba není')
  })
})
