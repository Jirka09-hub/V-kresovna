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
        : page.getByTestId('option-button').first()
  await expect(ready).toBeVisible({ timeout: 30_000 })
  return kind
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
  else await answerChoice(page, kind)
  return kind
}
