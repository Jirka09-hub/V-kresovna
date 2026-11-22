/**
 * Export matice postupu do CSV pro Excel v české lokalizaci (D-028): oddělovač `;`, UTF-8 s BOM
 * (Excel jinak nepozná kódování), řádky CRLF. Čisté funkce, bez DOM.
 */
import { percent, type MatrixCell, type MatrixRow } from './matrix'

export const CSV_SEPARATOR = ';'
/** Značka pořadí bajtů UTF-8: podle ní Excel pozná kódování. */
const BOM = String.fromCharCode(0xfeff)

/**
 * Jedna hodnota CSV. Uvozovky, když obsahuje oddělovač, uvozovky nebo konec řádku. Hodnoty
 * začínající znaky `= + - @` (a tabulátorem) dostanou apostrof, aby je tabulkový procesor
 * nespustil jako vzorec (jméno účastníka píše školitel, ale i tak).
 */
export function csvCell(value: string | number | null | undefined): string {
  let v = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function buildCsv(
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  return `${BOM}${rows.map((r) => r.map(csvCell).join(CSV_SEPARATOR)).join('\r\n')}\r\n`
}

/** Název souboru: skupina (bez diakritiky a zvláštních znaků) + datum. */
export function csvFilename(groupName: string, date: string): string {
  const base = groupName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40)
  return `vysledky-${base || 'skupina'}-${date}.csv`
}

export type CsvLabels = {
  readonly name: string
  readonly login: string
  readonly finalTest: string
  readonly finalResult: string
  readonly certificate: string
  /** titulky sloupců lekcí ve stejném pořadí jako `lessonSlugs` */
  readonly lessons: readonly string[]
  readonly cell: (cell: MatrixCell) => string
  readonly passed: (passed: boolean | null) => string
}

/** Řádky CSV: hlavička + jeden řádek na účastníka. Lekce bez závěrečného testu, test zvlášť. */
export function matrixCsvRows(
  matrix: readonly MatrixRow[],
  lessonSlugs: readonly string[],
  labels: CsvLabels,
): string[][] {
  const header = [
    labels.name,
    labels.login,
    ...labels.lessons,
    labels.finalTest,
    labels.finalResult,
    labels.certificate,
  ]
  const rows = matrix.map((r) => [
    r.displayName,
    r.username ?? '',
    ...lessonSlugs.map((slug) => labels.cell(r.cells[slug] ?? { status: 'none', bestScore: null })),
    r.finalScore === null ? '' : `${percent(r.finalScore)} %`,
    labels.passed(r.finalPassed),
    r.certificateCode ?? '',
  ])
  return [header, ...rows]
}
