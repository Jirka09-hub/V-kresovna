import { TEST_PARTS } from '@vykresovna/engine/fixtures'
import { expect, test } from '@playwright/test'

test.describe('laboratoř enginu', () => {
  test('zobrazí 3D model i výkres a propojí zvýraznění hran', async ({ page }) => {
    await page.goto('/cs/laborator')
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
    const svg = page.locator('svg[data-part="01-kvadr"]')
    await expect(svg).toBeVisible()
    await expect(svg.locator('g[data-view]')).toHaveCount(3)
    // najetí na hranu ve výkresu ji zvýrazní
    const edge = svg.locator('[data-edge-ids]:not([data-hit])').first()
    await edge.dispatchEvent('pointermove')
    await expect(svg.locator('[data-highlight="true"]').first()).toBeVisible()
  })
})

// Vizuální snapshoty výkresů 10 testovacích součástí (jen desktop, výkres je stejný na všech zařízeních).
test.describe('výkresy testovacích součástí', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || !!isMobile)
  for (const part of TEST_PARTS) {
    test(`výkres ${part.id}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium')
      await page.goto('/cs/laborator')
      await page.getByRole('button', { name: part.id, exact: true }).click()
      const svg = page.locator(`svg[data-part="${part.id}"]`)
      await expect(svg).toBeVisible({ timeout: 20_000 })
      await expect(svg).toHaveScreenshot(`${part.id}.png`)
    })
  }
})
