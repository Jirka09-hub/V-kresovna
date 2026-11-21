import { expect, test } from '@playwright/test'

test('kořen přesměruje na českou verzi a zobrazí úvod', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/cs$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('technické výkresy')
  await expect(page.getByTestId('status')).toBeVisible()
})

test('health endpoint odpovídá a hlásí evropské promítání', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.ok).toBe(true)
  expect(body.projectionMethod).toBe('E')
})
