import { FIRST_ANGLE_LAYOUT, type ViewName } from '@vykresovna/drafting-standards'
import { expect, type Page } from '@playwright/test'

/** Typ aktuální úlohy, až je načtená (generuje se ve workeru). */
export async function currentKind(page: Page): Promise<string> {
  const exercise = page.getByTestId('exercise')
  await expect(exercise).toBeVisible({ timeout: 30_000 })
  const kind = (await exercise.getAttribute('data-kind'))!
  const ready =
    kind === 'assign-views'
      ? page.getByTestId('card').first()
      : kind === 'missing-view'
        ? page.getByTestId('option').first()
        : kind === 'find-error'
          ? page.getByTestId('find-error-cell').first()
          : page.getByTestId('option-button').first()
  await expect(ready).toBeAttached({ timeout: 30_000 })
  return kind
}

/**
 * „Najdi chybu“ myší: klik na místo chyby podle testovacích atributů výkresu (`data-target-x/y`
 * jsou zlomky šířky a výšky výkresu), nebo tlačítko u chyby rozmístění.
 */
export async function solveFindErrorWithClick(page: Page, useLayoutButton = true) {
  const drawing = page.getByTestId('find-error-drawing')
  if (useLayoutButton && (await drawing.getAttribute('data-layout-error')) === 'true') {
    await page.getByTestId('layout-wrong').click()
  } else {
    const fx = Number(await drawing.getAttribute('data-target-x'))
    const fy = Number(await drawing.getAttribute('data-target-y'))
    const box = (await drawing.boundingBox())!
    await drawing.click({ position: { x: fx * box.width, y: fy * box.height } })
    await expect(drawing.getByTestId('marker')).toBeAttached()
  }
  await page.getByTestId('check').click()
  const feedback = page.getByTestId('feedback')
  await expect(feedback).toHaveAttribute('data-correct', 'true')
  await expect(drawing.getByTestId('target-highlight').first()).toBeAttached()
}

/**
 * „Najdi chybu“ jen klávesnicí: Tab na pohled s chybou, šipkami na oblast s chybou, Enter,
 * pak Zkontrolovat.
 */
export async function solveFindErrorWithKeyboard(page: Page) {
  const drawing = page.getByTestId('find-error-drawing')
  const view = (await drawing.getAttribute('data-target-view'))!
  const [row, col] = (await drawing.getAttribute('data-target-cell'))!.split(',').map(Number)
  // výchozí oblast pohledu je prostřední; fokus se k pohledu dostane tabulátorem
  const start = page.locator(`[data-testid="find-error-cell"][data-view="${view}"][tabindex="0"]`)
  await expect(start).toHaveAttribute('data-cell', '1,1')
  await page.getByTestId('exercise').locator('p').first().click()
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab')
    if (await start.evaluate((el) => el === document.activeElement)) break
  }
  await expect(start).toBeFocused()
  for (let r = 1; r < row!; r++) await page.keyboard.press('ArrowDown')
  for (let r = 1; r > row!; r--) await page.keyboard.press('ArrowUp')
  for (let c = 1; c < col!; c++) await page.keyboard.press('ArrowRight')
  for (let c = 1; c > col!; c--) await page.keyboard.press('ArrowLeft')
  const target = page.locator(
    `[data-testid="find-error-cell"][data-view="${view}"][data-cell="${row},${col}"]`,
  )
  await expect(target).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(target).toHaveAttribute('aria-pressed', 'true')
  const check = page.getByTestId('check')
  await check.focus()
  await page.keyboard.press('Enter')
  const feedback = page.getByTestId('feedback')
  await expect(feedback).toHaveAttribute('data-correct', 'true')
  await expect(page.getByTestId('next')).toBeFocused()
}

/** Přiřaď pohledy jen klávesnicí: vybrat kartu (Enter), pak místo podle evropského promítání. */
export async function solveAssignViewsWithKeyboard(page: Page) {
  const cards = page.getByTestId('card')
  const views = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-view')!))
  for (const view of views) {
    await page.locator(`[data-testid="card"][data-view="${view}"]`).focus()
    await page.keyboard.press('Enter')
    const [col, row] = FIRST_ANGLE_LAYOUT[view as ViewName]
    await page.locator(`[data-slot-button="${col},${row}"]`).focus()
    await page.keyboard.press('Enter')
    await expect(
      page.locator(`[data-slot="${col},${row}"] [data-testid="card"][data-view="${view}"]`),
    ).toBeVisible()
  }
  const check = page.getByTestId('check')
  await expect(check).toBeEnabled()
  await check.focus()
  await page.keyboard.press('Enter')
  const feedback = page.getByTestId('feedback')
  await expect(feedback).toBeVisible()
  await expect(feedback).toHaveAttribute('data-correct', 'true')
}

/** Výběr 1 ze 4: zvolí první možnost a ověří, že přišla zpětná vazba (obsah se generuje). */
export async function answerChoice(page: Page, kind: string) {
  if (kind === 'drawing-to-model') {
    // všechny modely jsou na jednom plátně a otáčejí se společně (i tlačítky z klávesnice)
    await expect(page.locator('canvas')).toHaveCount(1)
    const gallery = page.getByTestId('part-gallery')
    const before = await gallery.getAttribute('data-rotation')
    await page.getByRole('button', { name: 'Otočit doprava' }).click()
    await expect(gallery).not.toHaveAttribute('data-rotation', before!)
  }
  const option =
    kind === 'missing-view'
      ? page.getByTestId('option').first()
      : page.getByTestId('option-button').first()
  await option.click()
  const feedback = page.getByTestId('feedback')
  await expect(feedback).toBeVisible()
  await expect(feedback).toHaveAttribute('data-correct', /true|false/)
  // správná možnost je po odpovědi vždy vyznačená
  await expect(page.locator('[data-testid="option"][data-status="correct"]')).toHaveCount(1)
}

export async function solveCurrent(page: Page) {
  const kind = await currentKind(page)
  if (kind === 'assign-views') await solveAssignViewsWithKeyboard(page)
  else if (kind === 'find-error') await solveFindErrorWithClick(page)
  else await answerChoice(page, kind)
  return kind
}
