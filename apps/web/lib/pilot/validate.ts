/**
 * Kontrola formuláře „Chci pilot“ (D-030). Čistá funkce, sdílí ji serverová akce a testy.
 * Meze odpovídají kontrolám v tabulce `pilot_requests`.
 */

export const PILOT_LIMITS = {
  name: [2, 120],
  organization: [2, 160],
  email: 254,
  message: 2000,
  headcount: [1, 100000],
} as const

/** Nejkratší rozumná doba vyplnění formuláře (past na roboty) a nejdelší platnost formuláře. */
export const MIN_FILL_MS = 3000
export const MAX_FILL_MS = 24 * 60 * 60 * 1000

export type PilotSegment = 'company' | 'school'

export type PilotField =
  'segment' | 'name' | 'organization' | 'email' | 'phone' | 'headcount' | 'message' | 'consent'

export type PilotRequestInput = {
  readonly segment: PilotSegment
  readonly name: string
  readonly organization: string
  readonly email: string
  readonly phone: string | null
  readonly headcount: number | null
  readonly message: string | null
}

export type PilotValidation =
  | { readonly ok: true; readonly data: PilotRequestInput }
  | { readonly ok: false; readonly fields: readonly PilotField[] }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE = /^[0-9 +()/-]{6,30}$/

const between = (s: string, [min, max]: readonly [number, number]) =>
  s.length >= min && s.length <= max

/** Hodnoty polí formuláře (už oříznuté o mezery) → data k uložení, nebo seznam chybných polí. */
export function validatePilotRequest(v: Readonly<Record<string, string>>): PilotValidation {
  const get = (k: string) => (v[k] ?? '').trim()
  const fields: PilotField[] = []
  const segment = get('segment')
  const name = get('name')
  const organization = get('organization')
  const email = get('email').toLowerCase()
  const phone = get('phone')
  const headcountRaw = get('headcount').replace(/\s/g, '')
  const message = get('message')

  if (segment !== 'company' && segment !== 'school') fields.push('segment')
  if (!between(name, PILOT_LIMITS.name)) fields.push('name')
  if (!between(organization, PILOT_LIMITS.organization)) fields.push('organization')
  if (email.length > PILOT_LIMITS.email || !EMAIL.test(email)) fields.push('email')
  if (phone && !PHONE.test(phone)) fields.push('phone')
  const headcount = headcountRaw ? Number(headcountRaw) : null
  if (
    headcount !== null &&
    (!Number.isInteger(headcount) ||
      headcount < PILOT_LIMITS.headcount[0] ||
      headcount > PILOT_LIMITS.headcount[1])
  )
    fields.push('headcount')
  if (message.length > PILOT_LIMITS.message) fields.push('message')
  if (v.consent !== 'on') fields.push('consent')

  if (fields.length) return { ok: false, fields }
  return {
    ok: true,
    data: {
      segment: segment as PilotSegment,
      name,
      organization,
      email,
      phone: phone || null,
      headcount,
      message: message || null,
    },
  }
}

/** Past na roboty: vyplněné skryté pole nebo podezřele rychlé či staré odeslání. */
export function botCheck(honeypot: string, startedAt: string, now: number): 'ok' | 'bot' | 'retry' {
  if (honeypot.trim()) return 'bot'
  const started = Number(startedAt)
  if (!Number.isFinite(started) || started <= 0) return 'retry'
  const elapsed = now - started
  if (elapsed < MIN_FILL_MS || elapsed > MAX_FILL_MS) return 'retry'
  return 'ok'
}
