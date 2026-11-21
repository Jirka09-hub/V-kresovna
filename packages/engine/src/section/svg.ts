import {
  arrowheadWidth,
  CUTTING_PLANE_ARROWHEAD_LENGTH_MM,
  CUTTING_PLANE_END_STYLE,
  dashArrayMm,
  LINE_STYLES,
  LINE_WIDTH_MM,
  SECTION_LETTER_HEIGHT_MM,
  SECTION_TITLE_GAP_MM,
  SECTION_TITLE_HEIGHT_MM,
  type LineKind,
} from '@vykresovna/drafting-standards'
import type { Drawing, DrawingView } from '../drawing/drawing'
import type { Vec2 } from '../projection/hlr'
import { CAP_HEIGHT_EM, viewToSheet } from './view'

/**
 * Vykreslení řezu do SVG: plochy řezu (třída `sectionFace`, v UI je lze jemně podbarvit přes
 * proměnnou `--drawing-section-fill`), šrafy jako přesné úsečky, nápis „A–A“ a stopa roviny řezu
 * se zesílenými konci, šipkami a písmeny.
 */

const fmt = (n: number) => {
  const r = Math.round(n * 1000) / 1000 + 0
  return Number.isInteger(r) ? String(r) : r.toFixed(3).replace(/0+$/, '')
}
const pt = (p: Vec2) => `${fmt(p[0])} ${fmt(p[1])}`

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function strokeRule(cls: string, kind: LineKind | null, weight: 'thick' | 'thin'): string {
  const dash = kind ? dashArrayMm(kind) : []
  return `.${cls}{stroke-width:${fmt(LINE_WIDTH_MM[weight])}${dash.length ? `;stroke-dasharray:${dash.map(fmt).join(' ')}` : ''}}`
}

/** Má výkres nějaký řez nebo stopu řezu? (Jen pak se přidávají styly řezu.) */
export function hasSections(drawing: Drawing): boolean {
  return drawing.views.some((v) => v.section || v.cuttingPlanes?.length)
}

/** CSS pro prvky řezu (třídy odvozené z konstant v drafting-standards). */
export function sectionStyleRules(): string {
  const ink = 'var(--drawing-ink,#111)'
  return [
    `.sectionFace{fill:var(--drawing-section-fill,none);stroke:none}`,
    strokeRule('hatching', 'hatching', LINE_STYLES.hatching.weight),
    strokeRule('cuttingPlaneLine', 'cuttingPlaneLine', LINE_STYLES.cuttingPlaneLine.weight),
    strokeRule('cuttingPlaneEnd', null, CUTTING_PLANE_END_STYLE.weight),
    strokeRule('cuttingPlaneArrow', null, 'thin'),
    `.cuttingPlaneArrowHead{fill:${ink};stroke:none}`,
    `.sectionLetter,.sectionTitle{fill:${ink};stroke:none;font-family:var(--drawing-font,Arial,Helvetica,sans-serif);text-anchor:middle}`,
  ].join('')
}

/** Podklad pohledu v řezu: plochy řezu a šrafy (kreslí se pod hrany). */
export function renderSectionUnderlay(v: DrawingView): string {
  const s = v.section
  if (!s) return ''
  const tx = viewToSheet(v)
  const out: string[] = []
  const ring = (loop: readonly Vec2[]) => `M${loop.map((p) => pt(tx(p))).join('L')}Z`
  const faces = s.faces.map((f) => [f.outer, ...f.holes].map(ring).join('')).join('')
  if (faces) {
    out.push(
      `<path class="sectionFace" data-section-face="${escapeXml(s.label)}" fill-rule="evenodd" d="${faces}"/>`,
    )
  }
  if (s.hatching.length > 0) {
    const d = s.hatching.map((h) => `M${pt(tx(h.a))}L${pt(tx(h.b))}`).join('')
    out.push(`<path class="hatching" data-hatching="${escapeXml(s.label)}" d="${d}"/>`)
  }
  return out.join('')
}

/** Text se středem velkého písmene v bodě `c` (souřadnice výkresu). */
function text(cls: string, c: Vec2, capHeight: number, content: string, extra = ''): string {
  // účaří je o polovinu výšky velkého písmene pod středem
  return `<text class="${cls}"${extra} x="${fmt(c[0])}" y="${fmt(c[1] + capHeight / 2)}" font-size="${fmt(capHeight / CAP_HEIGHT_EM)}">${escapeXml(content)}</text>`
}

/** Popisy řezu nad hranami: nápis „A–A“ nad pohledem a stopy rovin řezu. */
export function renderSectionOverlay(v: DrawingView): string {
  const out: string[] = []
  if (v.section) {
    const h = SECTION_TITLE_HEIGHT_MM
    const c: Vec2 = [v.origin[0] + v.size[0] / 2, v.origin[1] - SECTION_TITLE_GAP_MM - h / 2]
    out.push(text('sectionTitle', c, h, v.section.title, ' data-section-title="true"'))
  }
  const tx = viewToSheet(v)
  for (const m of v.cuttingPlanes ?? []) {
    const parts: string[] = []
    // čerchovaná část mezi tlustými konci, vzor vycentrovaný jako u os
    const e0 = tx(m.ends[0].b)
    const e1 = tx(m.ends[1].b)
    const len = Math.hypot(e1[0] - e0[0], e1[1] - e0[1])
    const pattern = dashArrayMm('cuttingPlaneLine')
    const period = pattern.reduce((x, y) => x + y, 0)
    const offset = period > 0 ? ((((pattern[0] ?? 0) / 2 - len / 2) % period) + period) % period : 0
    parts.push(
      `<path class="cuttingPlaneLine" stroke-dashoffset="${fmt(offset)}" d="M${pt(e0)}L${pt(e1)}"/>`,
    )
    for (const end of m.ends) {
      parts.push(`<path class="cuttingPlaneEnd" d="M${pt(tx(end.a))}L${pt(tx(end.b))}"/>`)
    }
    for (const arrow of m.arrows) {
      const t0 = tx(arrow.tail)
      const t1 = tx(arrow.tip)
      const len2 = Math.hypot(t1[0] - t0[0], t1[1] - t0[1])
      const ux = (t1[0] - t0[0]) / len2
      const uy = (t1[1] - t0[1]) / len2
      const hl = CUTTING_PLANE_ARROWHEAD_LENGTH_MM
      const hw = arrowheadWidth() / 2
      const base: Vec2 = [t1[0] - ux * hl, t1[1] - uy * hl]
      parts.push(`<path class="cuttingPlaneArrow" d="M${pt(t0)}L${pt(base)}"/>`)
      parts.push(
        `<path class="cuttingPlaneArrowHead" d="M${pt(t1)}L${pt([base[0] - uy * hw, base[1] + ux * hw])}L${pt([base[0] + uy * hw, base[1] - ux * hw])}Z"/>`,
      )
    }
    for (const c of m.letters) {
      parts.push(text('sectionLetter', tx(c), SECTION_LETTER_HEIGHT_MM, m.label))
    }
    out.push(`<g data-cutting-plane="${escapeXml(m.label)}">${parts.join('')}</g>`)
  }
  return out.join('')
}
