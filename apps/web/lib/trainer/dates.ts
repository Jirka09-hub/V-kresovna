/**
 * Termíny přiřazených lekcí: školitel zadává den, ukládá se konec toho dne v Praze
 * (lekce je „včas“, když ji účastník dokončí kdykoli během posledního dne), D-028.
 */
export const APP_TIME_ZONE = 'Europe/Prague'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Kalendářní den (YYYY-MM-DD) okamžiku v pražském čase. */
export function pragueDate(at: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(new Date(at))
}

/** Konec dne `date` (YYYY-MM-DD) v pražském čase jako ISO řetězec; null pro neplatné datum. */
export function pragueEndOfDay(date: string): string | null {
  if (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return null
  // letní čas (+02:00), nebo zimní (+01:00): platí ten, který v Praze dává 23:59 téhož dne
  for (const offset of ['+02:00', '+01:00']) {
    const at = new Date(`${date}T23:59:59${offset}`)
    const hour = new Intl.DateTimeFormat('en-GB', {
      timeZone: APP_TIME_ZONE,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(at)
    if (pragueDate(at) === date && hour === '23') return at.toISOString()
  }
  return null
}

/** Je termín po uplynutí? */
export function isOverdue(dueAt: string | null, now: Date = new Date()): boolean {
  return !!dueAt && new Date(dueAt).getTime() < now.getTime()
}
