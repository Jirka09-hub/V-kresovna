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
          : kind === 'section'
            ? page.locator('[data-testid="option"], [data-testid="section-slider"]').first()
            : kind === 'dimension'
              ? page.getByTestId('dim-input')
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

/**
 * Seedy úloh v pořadí, v jakém si je stránka vyžádá (`randomSeed` v lib/seeds.ts volá
 * `crypto.getRandomValues` s jedním 32bitovým číslem). Ostatní volání zůstávají náhodná.
 */
export async function fixSeeds(page: Page, seeds: readonly number[]) {
  await page.addInitScript(
    (queue: number[]) => {
      const original = crypto.getRandomValues.bind(crypto)
      const patched = (array: Parameters<Crypto['getRandomValues']>[0]) => {
        if (array instanceof Uint32Array && array.length === 1 && queue.length > 0) {
          array[0] = queue.shift()!
          return array
        }
        return original(array)
      }
      crypto.getRandomValues = patched as Crypto['getRandomValues']
    },
    [...seeds],
  )
}

/** Správná (nebo schválně špatná) možnost výběru 1 ze 4 podle testovacího atributu. */
export async function chooseOption(page: Page, correct = true) {
  const exercise = page.getByTestId('exercise')
  const id = (await exercise.locator('[data-test-correct]').getAttribute('data-test-correct'))!
  const option = correct
    ? exercise.locator(`[data-testid="option"][data-option-id="${id}"]`)
    : exercise.locator(`[data-testid="option"]:not([data-option-id="${id}"])`).first()
  const button = option.locator('[data-testid="option-button"]')
  await ((await button.count()) ? button : option).click()
}

/** Rovina řezu jen klávesnicí: šipkami na posuvníku na správnou polohu, pak Zkontrolovat. */
export async function placeSectionWithKeyboard(page: Page) {
  const place = page.getByTestId('section-place')
  const target = Number(await place.getAttribute('data-test-answer-at'))
  const slider = page.getByTestId('section-slider')
  const step = Number(await slider.getAttribute('step'))
  await slider.focus()
  const n = Math.round((target - Number(await slider.inputValue())) / step)
  for (let i = 0; i < Math.abs(n); i++)
    await page.keyboard.press(n > 0 ? 'ArrowRight' : 'ArrowLeft')
  await expect(slider).toHaveValue(String(target))
  await page.getByTestId('check').click()
}

/** Odpověď na kótu: napíše číslo (správné nebo o 1 větší) a odešle klávesou Enter. */
export async function answerDimension(page: Page, correct = true) {
  const answer = Number(await page.getByTestId('dimension').getAttribute('data-test-answer'))
  const input = page.getByTestId('dim-input')
  await input.fill(String(correct ? answer : answer + 1))
  await input.press('Enter')
}

/**
 * Odpověď na aktuální úlohu bez čekání na zpětnou vazbu (v závěrečném testu žádná není).
 * `correct: false` odpoví schválně špatně (jen u kót a výběru možnosti).
 */
export async function answerCurrent(page: Page, correct = true): Promise<string> {
  const kind = await currentKind(page)
  if (kind === 'assign-views') {
    const cards = page.getByTestId('card')
    const views = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-view')!))
    for (const view of views) {
      await page.locator(`[data-testid="card"][data-view="${view}"]`).click()
      const [col, row] = FIRST_ANGLE_LAYOUT[view as ViewName]
      await page.locator(`[data-slot-button="${col},${row}"]`).click()
    }
    await page.getByTestId('check').click()
  } else if (kind === 'find-error') {
    const drawing = page.getByTestId('find-error-drawing')
    await expect(drawing).toHaveAttribute('data-target-x', /\d/)
    if ((await drawing.getAttribute('data-layout-error')) === 'true') {
      await page.getByTestId('layout-wrong').click()
    } else {
      const fx = Number(await drawing.getAttribute('data-target-x'))
      const fy = Number(await drawing.getAttribute('data-target-y'))
      const box = (await drawing.boundingBox())!
      await drawing.click({ position: { x: fx * box.width, y: fy * box.height } })
    }
    await page.getByTestId('check').click()
  } else if (kind === 'dimension') {
    await answerDimension(page, correct)
  } else if (kind === 'section' && (await page.getByTestId('section-place').count())) {
    await placeSectionWithKeyboard(page)
  } else {
    await chooseOption(page, correct)
  }
  return kind
}

export async function solveCurrent(page: Page) {
  const kind = await currentKind(page)
  if (kind === 'assign-views') await solveAssignViewsWithKeyboard(page)
  else if (kind === 'find-error') await solveFindErrorWithClick(page)
  else if (kind === 'section' || kind === 'dimension') {
    await answerCurrent(page)
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-correct', 'true')
  } else await answerChoice(page, kind)
  return kind
}
