/**
 * Platí licence k dnešnímu dni (kalendář Europe/Prague, včetně posledního dne)? Bez závislosti na
 * serveru, takže ji používá i prohlížeč (ukládání výsledků v lekcích).
 */
export function licenseActive(validUntil: string, now: Date = new Date()): boolean {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(now)
  return validUntil >= today
}
