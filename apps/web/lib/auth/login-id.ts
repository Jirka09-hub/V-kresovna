/**
 * Přihlašovací údaje (D-026): e-mail, nebo přihlašovací jméno u účtů bez e-mailu. Účet bez e-mailu
 * má v Supabase Auth technickou adresu v doméně `.invalid` (nikdy nedoručitelná).
 */
export const SYNTHETIC_EMAIL_DOMAIN = 'ucet.vykresovna.invalid'
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/
export const MIN_PASSWORD_LENGTH = 6
export const MAX_PASSWORD_LENGTH = 72
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type LoginId =
  | { readonly kind: 'email'; readonly email: string }
  | { readonly kind: 'username'; readonly username: string; readonly email: string }

/** Rozpozná zadaný údaj; null = není to platný e-mail ani přihlašovací jméno. */
export function parseLoginId(input: string): LoginId | null {
  const value = input.trim().toLowerCase()
  if (value.includes('@')) {
    if (!EMAIL_PATTERN.test(value) || value.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)) return null
    return { kind: 'email', email: value }
  }
  if (!USERNAME_PATTERN.test(value)) return null
  return { kind: 'username', username: value, email: `${value}@${SYNTHETIC_EMAIL_DOMAIN}` }
}

/** Je e-mail technický (účet bez e-mailu)? */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)
}

/** Přihlašovací jméno z technické adresy (jinak null). */
export function usernameFromEmail(email: string | null | undefined): string | null {
  return isSyntheticEmail(email) ? email!.slice(0, -SYNTHETIC_EMAIL_DOMAIN.length - 1) : null
}

/**
 * Návrh přihlašovacího jména ze jména („Jan Novák“ → „jan.novak“), s volitelnou číselnou příponou.
 * Výsledek vždy odpovídá USERNAME_PATTERN.
 */
export function suggestUsername(displayName: string, suffix?: number): string {
  const base = displayName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24)
    .replace(/\.+$/g, '')
  const padded = base.length >= 3 ? base : `${base || 'ucet'}${'0'.repeat(3)}`.slice(0, 3)
  return suffix === undefined ? padded : `${padded}${suffix}`
}

export function validPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH
}

/** Náhodné počáteční heslo pro účty zakládané školitelem: 8 znaků bez zaměnitelných. */
export function generatePassword(random: () => number = Math.random): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(random() * alphabet.length)]
  return out
}

/** Kód organizace/skupiny pro zobrazení: „ABCD-EFGH“. */
export function formatJoinCode(code: string): string {
  const c = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}
