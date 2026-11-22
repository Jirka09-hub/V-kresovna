import { expect, test } from '@playwright/test'
import { solveCurrent } from './helpers'

test.describe('lekce', () => {
  test('přehled: 9 lekcí, všechny dostupné, poslední je závěrečný test', async ({ page }) => {
    await page.goto('/cs/lekce')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Pohledy a řezy')
    const items = page.locator('[data-testid="lesson-list"] > li')
    await expect(items).toHaveCount(9)
    await expect(
      page.locator('[data-testid="lesson-list"] > li[data-status="available"] a'),
    ).toHaveCount(9)
    await expect(page.locator('li[data-status="coming-soon"]')).toHaveCount(0)
    await expect(items.last()).toContainText('Závěrečný test')
  })

  test('lekce 1: výklad s animací, pak úloha', async ({ page }) => {
    test.setTimeout(90_000)
    await page.goto('/cs/lekce')
    await page.getByRole('link', { name: /Jak vznikají pohledy/ }).click()
    await expect(page).toHaveURL(/\/cs\/lekce\/jak-vznikaji-pohledy$/)
    await expect(page.getByTestId('intro')).toBeVisible()
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('next-screen').click()
    // druhá obrazovka: model propojený s výkresem
    await expect(page.locator('svg[data-part] g[data-view]')).toHaveCount(3, { timeout: 20_000 })
    await page.getByTestId('to-tasks').click()
    await solveCurrent(page)
    await expect(page.getByTestId('next')).toBeFocused()
  })

  test('lekce 3: tlačítko prvku zvýrazní díru ve výkresu', async ({ page }) => {
    await page.goto('/cs/lekce/diry-a-osy')
    const drawing = page.locator('svg[data-part]')
    await expect(drawing).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'slepá díra' }).click()
    await expect(drawing.locator('[data-highlight="true"]').first()).toBeVisible()
  })
})
