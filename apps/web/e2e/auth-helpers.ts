import { expect, type Page } from '@playwright/test'

/** Přihlášení přes formulář (přihlašovací jméno nebo e-mail). */
export async function signIn(page: Page, login: string, password: string, next?: string) {
  await page.goto(next ? `/cs/prihlaseni?next=${encodeURIComponent(next)}` : '/cs/prihlaseni')
  const form = page.getByTestId('sign-in-form')
  await form.getByLabel('E-mail nebo přihlašovací jméno').fill(login)
  await form.getByLabel('Heslo').fill(password)
  await form.getByRole('button', { name: 'Přihlásit se' }).click()
  await expect(page).not.toHaveURL(/\/prihlaseni/)
}
