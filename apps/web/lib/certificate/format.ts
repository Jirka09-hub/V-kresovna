/** Formátování údajů certifikátu (bez závislostí, používá prohlížeč i server). */

/** Ověřovací kód po čtveřicích pro čitelnost („ABCD-EFGH-…“); ověření pomlčky ignoruje. */
export function formatCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? []).join('-')
}

/** Kód zadaný uživatelem: velká písmena, bez mezer a pomlček (jako `app.normalize_code`). */
export function normalizeCode(input: string): string {
  return input
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 64)
}

/** Cesta ověřovací stránky certifikátu. */
export function verifyPath(locale: string, code: string): string {
  return `/${locale}/overeni/${encodeURIComponent(code)}`
}

/** Skóre 0–1 jako celá procenta. */
export function scorePercent(score: number): number {
  return Math.round(score * 100)
}

/** Název souboru PDF. */
export function certificateFileName(code: string): string {
  return `certifikat-vykresovna-${code}.pdf`
}

/** Datum vydání certifikátu (kalendář Europe/Prague, jako licence). */
export const CERTIFICATE_DATE_FORMAT = {
  dateStyle: 'long',
  timeZone: 'Europe/Prague',
} as const
