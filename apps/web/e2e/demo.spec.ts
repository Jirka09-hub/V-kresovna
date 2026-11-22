import { expect, test } from '@playwright/test'
import { FIRST_ANGLE_LAYOUT, type ViewName } from '@vykresovna/drafting-standards'
import { currentKind, solveCurrent } from './helpers'

test.describe('demo', () => {
  test.setTimeout(120_000)

  test('3D ukázka, pět úloh pěti typů (včetně řezu) a shrnutí', async ({ page }) => {
    await page.goto('/cs/demo')
    await expect(page.getByTestId('showcase')).toBeVisible()
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('unfold-play').click()
    await page.getByTestId('start-tasks').click()

    const kinds = new Set<string>()
    for (let i = 1; i <= 5; i++) {
      await expect(page.getByRole('heading', { level: 2, name: `Úloha ${i} z 5` })).toBeVisible()
      kinds.add(await solveCurrent(page))
      // výsledek je vidět i v ukazateli postupu
      await expect(page.locator('[data-testid="progress"] li').nth(i - 1)).toHaveAttribute(
        'data-state',
        /done|wrong/,
      )
      await page.getByTestId('next').click()
    }
    expect(kinds).toEqual(
      new Set(['assign-views', 'missing-view', 'drawing-to-model', 'find-error', 'section']),
    )

    const summary = page.getByTestId('summary')
    await expect(summary).toBeVisible()
    await expect(summary.getByRole('heading', { name: 'Hotovo!' })).toBeVisible()
    await expect(summary).toContainText('z 5 úloh')
  })

  test('kartu pohledu jde přetáhnout myší', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'přetahování prstem pokrývá stejný PointerSensor')
    await page.goto('/cs/demo')
    await page.getByTestId('start-tasks').click()
    expect(await currentKind(page)).toBe('assign-views')
    const card = page.getByTestId('card').first()
    const view = (await card.getAttribute('data-view')) as ViewName
    const [col, row] = FIRST_ANGLE_LAYOUT[view]
    await page.getByTestId('tray').scrollIntoViewIfNeeded()
    const from = (await card.boundingBox())!
    const to = (await page.locator(`[data-slot="${col},${row}"]`).boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
    await page.mouse.up()
    await expect(
      page.locator(`[data-slot="${col},${row}"] [data-testid="card"][data-view="${view}"]`),
    ).toBeVisible()
  })

  test('„Další varianta“ vygeneruje nové úlohy', async ({ page }) => {
    await page.goto('/cs/demo')
    await page.getByTestId('start-tasks').click()
    const exercise = page.getByTestId('exercise')
    await expect(exercise).toBeVisible({ timeout: 30_000 })
    const seed = await exercise.getAttribute('data-seed')
    await page.getByTestId('new-variant').click()
    await expect(exercise).not.toHaveAttribute('data-seed', seed!)
    await expect(page.getByRole('heading', { level: 2, name: /Úloha 1 z 5/ })).toBeVisible()
  })
})
