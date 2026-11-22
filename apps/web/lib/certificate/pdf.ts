/**
 * PDF certifikátu (D-027, D-029): A4 na šířku, vložené písmo Noto Sans s češtinou. Jen rozvržení
 * hotových textů (překlady a formátování dělá volající), takže běží v prohlížeči i v Node (test).
 * Načítá se dynamicky, až když si uživatel PDF stáhne (pdf-lib není v hlavním bundlu).
 */
import fontkit from '@pdf-lib/fontkit'
import {
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setCharacterSpacing,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'

/** A4 na šířku v bodech (1 pt = 1/72 palce). */
export const A4_LANDSCAPE: readonly [number, number] = [841.89, 595.28]

/** Hotové texty certifikátu (už přeložené a s vyplněnými hodnotami). */
export type CertificateLines = {
  /** Název aplikace nahoře. */
  readonly brand: string
  readonly title: string
  readonly subtitle: string
  /** „Tento certifikát získává“ */
  readonly awardedTo: string
  readonly holder: string
  /** „za úspěšné absolvování modulu“ */
  readonly forModule: string
  readonly module: string
  /** Řádky s organizací a výsledkem testu. */
  readonly details: readonly string[]
  /** Rohové razítko vpravo dole: popisek a hodnota (kód, datum). */
  readonly stamp: readonly { readonly label: string; readonly value: string }[]
  /** Kde certifikát ověřit (popis a adresa). */
  readonly verifyHint: string
  readonly verifyUrl: string
  /** Název dokumentu v metadatech PDF. */
  readonly documentTitle: string
}

export type CertificateFonts = {
  readonly regular: Uint8Array | ArrayBuffer
  readonly bold: Uint8Array | ArrayBuffer
}

const INK = rgb(0.06, 0.09, 0.16)
const MUTED = rgb(0.28, 0.33, 0.41)
const ACCENT = rgb(0.12, 0.25, 0.69)
const LINE = rgb(0.8, 0.84, 0.9)

/** Velikost písma, při které se text vejde do šířky (nejvýš `size`, nejméně `min`). */
export function fitFontSize(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
  min = 10,
): number {
  const width = font.widthOfTextAtSize(text, size)
  if (width <= maxWidth) return size
  return Math.max(min, Math.floor(((size * maxWidth) / width) * 10) / 10)
}

/** Text zkrácený tak, aby se vešel (pro jistotu, když nepomůže ani nejmenší písmo). */
function clip(font: PDFFont, input: string, size: number, maxWidth: number): string {
  // písmo má jen složené znaky (č, ř…), ne kombinující diakritiku
  const text = input.normalize('NFC')
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let t = text
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

function centered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
  maxWidth = 680,
  spacing = 0,
) {
  const fitted = fitFontSize(font, text.normalize('NFC'), size, maxWidth)
  const shown = clip(font, text, fitted, maxWidth)
  const width = font.widthOfTextAtSize(shown, fitted) + spacing * Math.max(0, shown.length - 1)
  const [w] = A4_LANDSCAPE
  if (spacing) page.pushOperators(pushGraphicsState(), setCharacterSpacing(spacing))
  page.drawText(shown, { x: (w - width) / 2, y, size: fitted, font, color })
  if (spacing) page.pushOperators(setCharacterSpacing(0), popGraphicsState())
}

/** Vytvoří PDF certifikátu (bajty souboru). */
export async function buildCertificatePdf(
  lines: CertificateLines,
  fonts: CertificateFonts,
  createdAt: Date = new Date(),
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  // písma jsou už zmenšená na latinku (public/fonts), vkládají se celá
  const regular = await doc.embedFont(fonts.regular, { subset: false })
  const bold = await doc.embedFont(fonts.bold, { subset: false })
  doc.setTitle(lines.documentTitle)
  doc.setSubject(lines.module)
  doc.setCreator(lines.brand)
  doc.setProducer(lines.brand)
  doc.setLanguage('cs')
  doc.setCreationDate(createdAt)
  doc.setModificationDate(createdAt)

  const [w, h] = A4_LANDSCAPE
  const page = doc.addPage([w, h])

  // rámeček jako na výkresu: silná vnější a tenká vnitřní čára
  page.drawRectangle({
    x: 22,
    y: 22,
    width: w - 44,
    height: h - 44,
    borderColor: ACCENT,
    borderWidth: 2.2,
  })
  page.drawRectangle({
    x: 30,
    y: 30,
    width: w - 60,
    height: h - 60,
    borderColor: ACCENT,
    borderWidth: 0.6,
  })

  centered(page, lines.brand.toUpperCase(), h - 92, bold, 13, ACCENT, 680, 3)
  centered(page, lines.title, h - 160, bold, 44)
  centered(page, lines.subtitle, h - 190, regular, 14, MUTED)

  centered(page, lines.awardedTo, h - 245, regular, 13, MUTED)
  centered(page, lines.holder, h - 290, bold, 32, INK, 620)
  page.drawLine({
    start: { x: w / 2 - 220, y: h - 304 },
    end: { x: w / 2 + 220, y: h - 304 },
    thickness: 0.6,
    color: LINE,
  })
  centered(page, lines.forModule, h - 335, regular, 13, MUTED)
  centered(page, lines.module, h - 365, bold, 20, INK, 640)
  lines.details.forEach((d, i) => centered(page, d, h - 405 - i * 20, regular, 12, INK, 640))

  // vlevo dole: kde certifikát ověřit
  const left = 56
  page.drawText(clip(regular, lines.verifyHint, 9.5, 400), {
    x: left,
    y: 78,
    size: 9.5,
    font: regular,
    color: MUTED,
  })
  page.drawText(clip(regular, lines.verifyUrl, 10, 400), {
    x: left,
    y: 62,
    size: 10,
    font: regular,
    color: ACCENT,
  })

  // vpravo dole: rohové razítko (tabulka s kódem a datem)
  const rowH = 22
  const labelW = 104
  const valueW = 176
  const sx = w - 30 - labelW - valueW
  const sy = 30
  const rows = lines.stamp
  page.drawRectangle({
    x: sx,
    y: sy,
    width: labelW + valueW,
    height: rowH * rows.length,
    borderColor: ACCENT,
    borderWidth: 0.6,
  })
  page.drawLine({
    start: { x: sx + labelW, y: sy },
    end: { x: sx + labelW, y: sy + rowH * rows.length },
    thickness: 0.6,
    color: ACCENT,
  })
  rows.forEach((row, i) => {
    const y = sy + rowH * (rows.length - 1 - i)
    if (i > 0) {
      page.drawLine({
        start: { x: sx, y: y + rowH },
        end: { x: sx + labelW + valueW, y: y + rowH },
        thickness: 0.6,
        color: ACCENT,
      })
    }
    page.drawText(clip(regular, row.label, 8.5, labelW - 12), {
      x: sx + 6,
      y: y + 8,
      size: 8.5,
      font: regular,
      color: MUTED,
    })
    page.drawText(clip(bold, row.value, 10.5, valueW - 12), {
      x: sx + labelW + 6,
      y: y + 7.5,
      size: 10.5,
      font: bold,
      color: INK,
    })
  })

  return doc.save()
}
