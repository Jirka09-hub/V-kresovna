import { SECTION_TEST_CASES, TEST_PARTS } from '@vykresovna/engine/fixtures'
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

test('zaškrtnutí „Kóty“ zobrazí kótovaný výkres', async ({ page }) => {
  await page.goto('/cs/laborator')
  await page.getByRole('button', { name: '05-drazka', exact: true }).click()
  const svg = page.locator('svg[data-part="05-drazka"]')
  await expect(svg).toBeVisible({ timeout: 20_000 })
  await expect(svg.locator('[data-dimension-id]')).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Kóty' }).check()
  await expect(svg.locator('[data-dimension-id]').first()).toBeVisible({ timeout: 20_000 })
  await expect(svg.locator('[data-dimension-id="dim:s1:size:x"] text')).toHaveText('20')
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

test.describe('řez v laboratoři', () => {
  test('přepínač Řez nahradí nárys řezem A–A a posuvník posune rovinu', async ({ page }) => {
    await page.goto('/cs/laborator')
    await page.getByRole('button', { name: '03-dira-pruchozi', exact: true }).click()
    await expect(page.locator('svg[data-part="03-dira-pruchozi"]')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Řez', exact: true }).click()
    const svg = page.locator('svg[data-part="03-dira-pruchozi"]')
    const section = svg.locator('g[data-view="front"][data-section="A"]')
    await expect(section).toBeVisible({ timeout: 20_000 })
    await expect(section.locator('[data-section-title]')).toHaveText('A–A')
    await expect(svg.locator('g[data-view="top"] [data-cutting-plane="A"]')).toHaveCount(1)
    // rovina přes osu díry (střed součásti): díra rozdělí plochu řezu, šrafy jsou vidět
    await expect(section.locator('path.hatching')).toHaveCount(1)
    const slider = page.getByTestId('section-slider')
    await expect(slider).toHaveValue('20')
    // klávesnicí: posun roviny o 3 kroky (1,5 mm) a nový výkres
    await slider.focus()
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveValue('21.5')
    await expect(page.getByText('Poloha roviny: Y = 21,5 mm')).toBeVisible()
    // řez kolmo na X nahradí bokorys
    await page.getByRole('radio', { name: /kolmo na X/ }).click()
    await expect(svg.locator('g[data-view="left"][data-section="A"]')).toBeVisible({
      timeout: 20_000,
    })
    await expect(svg.locator('g[data-view="front"] [data-cutting-plane="A"]')).toHaveCount(1)
  })
})

// Vizuální snapshoty výkresů řezů (stejné jako SVG snapshoty enginu, tady přes prohlížeč).
test.describe('výkresy řezů', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || !!isMobile)
  for (const c of SECTION_TEST_CASES) {
    test(`řez ${c.part.id}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium')
      await page.goto('/cs/laborator')
      await page.getByRole('button', { name: c.part.id, exact: true }).click()
      const svg = page.locator(`svg[data-part="${c.part.id}"]`)
      await expect(svg.locator(`g[data-view="${c.view}"][data-section="A"]`)).toBeVisible({
        timeout: 20_000,
      })
      await expect(svg).toHaveScreenshot(`${c.part.id}.png`)
    })
  }
})
