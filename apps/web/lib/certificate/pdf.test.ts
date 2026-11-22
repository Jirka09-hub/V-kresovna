import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { formatCode, normalizeCode } from './format'
import { A4_LANDSCAPE, buildCertificatePdf, type CertificateLines } from './pdf'

const fontsDir = join(__dirname, '../../public/fonts')
const fonts = {
  regular: readFileSync(join(fontsDir, 'NotoSans-Regular.ttf')),
  bold: readFileSync(join(fontsDir, 'NotoSans-Bold.ttf')),
}
const messages = JSON.parse(
  readFileSync(join(__dirname, '../../messages/cs.json'), 'utf8'),
) as Record<string, unknown>

const lines: CertificateLines = {
  brand: 'Výkresovna',
  title: 'Certifikát',
  subtitle: 'o absolvování kurzu čtení technických výkresů',
  awardedTo: 'Tento certifikát získává',
  holder: 'Řehoř Žluťoučký-Kůň',
  forModule: 'za úspěšné absolvování modulu',
  module: 'Pohledy a řezy jednoduchých součástí',
  details: ['Organizace: Strojírny Ďáblice, s. r. o.', 'Výsledek závěrečného testu: 92 %'],
  stamp: [
    { label: 'Ověřovací kód', value: 'ABCD-EFGH-JKMN-PQRS' },
    { label: 'Datum vydání', value: '22. listopadu 2026' },
  ],
  verifyHint: 'Pravost certifikátu ověříte zadáním kódu na adrese:',
  verifyUrl: 'https://vykresovna.cz/cs/overeni/ABCDEFGHJKMNPQRS',
  documentTitle: 'Certifikát Výkresovna – Řehoř Žluťoučký-Kůň',
}

/** Všechny texty ze stromu zpráv (hodnoty listů). */
function strings(node: unknown): string[] {
  if (typeof node === 'string') return [node]
  if (node && typeof node === 'object') return Object.values(node).flatMap(strings)
  return []
}

describe('PDF certifikátu', () => {
  it('vytvoří jednostránkové PDF A4 na šířku', async () => {
    const bytes = await buildCertificatePdf(lines, fonts, new Date('2026-11-22T10:00:00Z'))
    expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    const { width, height } = doc.getPage(0).getSize()
    expect(width).toBeCloseTo(A4_LANDSCAPE[0], 1)
    expect(height).toBeCloseTo(A4_LANDSCAPE[1], 1)
    expect(doc.getTitle()).toBe(lines.documentTitle)
  })

  it('zvládne velmi dlouhé jméno (zmenší nebo zkrátí písmo)', async () => {
    const bytes = await buildCertificatePdf(
      {
        ...lines,
        holder: 'Marie Terezie Walburga Amálie Kristýna Habsburská-Lotrinská '.repeat(3),
      },
      fonts,
    )
    expect(bytes.length).toBeGreaterThan(1000)
  })

  it('písmo obsahuje všechny znaky textů certifikátu i češtinu', () => {
    const cert = (messages.certificate as Record<string, unknown>).pdf
    const sample = [
      ...strings(cert),
      ...strings(messages.modules),
      'ěščřžýáíéúůďťňó ĚŠČŘŽÝÁÍÉÚŮĎŤŇÓ äöüß ľĺŕ „“ – … · %',
    ].join('')
    for (const bytes of [fonts.regular, fonts.bold]) {
      const font = fontkit.create(bytes)
      const missing = [...new Set(sample)].filter(
        (ch) => ch.trim() && !font.hasGlyphForCodePoint(ch.codePointAt(0)!),
      )
      expect(missing).toEqual([])
    }
  })
})

describe('ověřovací kód', () => {
  it('se zobrazuje po čtveřicích a zadání se normalizuje', () => {
    expect(formatCode('ABCDEFGHJKMNPQRS')).toBe('ABCD-EFGH-JKMN-PQRS')
    expect(normalizeCode(' abcd-efgh jkmn-pqrs ')).toBe('ABCDEFGHJKMNPQRS')
  })
})
