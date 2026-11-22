import {
  ARROW_FILLED,
  dashArrayMm,
  LINE_STYLES,
  LINE_WIDTH_MM,
  type LineKind,
} from '@vykresovna/drafting-standards'
import type { Vec2 } from '../projection/hlr'
import { DIMENSION_FONT_FAMILY, DIMENSION_FONT_SIZE_MM } from './geometry'
import type { DrawingDimension } from './types'

/**
 * SVG kót. Volá ho `drawingToSvg` jen pro pohledy, které kóty mají, takže výkresy bez kót zůstávají
 * beze změny.
 */

const fmt = (n: number) => {
  const r = Math.round(n * 1000) / 1000 + 0
  return Number.isInteger(r) ? String(r) : r.toFixed(3).replace(/0+$/, '')
}

/** CSS pravidla pro kóty (přidají se do `<style>` výkresu, jen když výkres kóty obsahuje). */
export function dimensionStyleRules(): string {
  const kinds: LineKind[] = ['dimensionLine', 'extensionLine']
  const rules = kinds.map((k) => {
    const dash = dashArrayMm(k)
    const width = LINE_WIDTH_MM[LINE_STYLES[k].weight]
    return `.${k}{stroke-width:${fmt(width)}${dash.length ? `;stroke-dasharray:${dash.map(fmt).join(' ')}` : ''}}`
  })
  return [
    ...rules,
    `.dimensionArrow{${ARROW_FILLED ? 'fill:var(--drawing-ink,#111);' : ''}stroke:none}`,
    `.dimensionText{fill:var(--drawing-ink,#111);stroke:none;font-family:${DIMENSION_FONT_FAMILY};font-size:${fmt(DIMENSION_FONT_SIZE_MM)}px;text-anchor:middle}`,
    '[data-dimension-id][data-highlight="true"] .dimensionText,[data-dimension-id][data-highlight="true"] .dimensionArrow{fill:var(--drawing-highlight,#1d4ed8)}',
    '[data-dimension-id][data-highlight="true"] path{stroke:var(--drawing-highlight,#1d4ed8)}',
  ].join('')
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** Kóty jednoho pohledu jako SVG; `tx` převádí souřadnice pohledu do souřadnic výkresu. */
export function renderDimensions(dims: readonly DrawingDimension[], tx: (p: Vec2) => Vec2): string {
  return dims
    .map((d) => {
      const out: string[] = []
      const p = (q: Vec2) => {
        const t = tx(q)
        return `${fmt(t[0])} ${fmt(t[1])}`
      }
      for (const kind of ['extensionLine', 'dimensionLine'] as const) {
        const ls = d.lines.filter((l) => l.kind === kind)
        if (ls.length)
          out.push(`<path class="${kind}" d="${ls.map((l) => `M${p(l.a)}L${p(l.b)}`).join('')}"/>`)
      }
      if (d.arrows.length) {
        out.push(
          `<path class="dimensionArrow" d="${d.arrows.map((a) => `M${p(a[0])}L${p(a[1])}L${p(a[2])}Z`).join('')}"/>`,
        )
      }
      const a = tx(d.textAnchor)
      const rot = d.textRotationDeg
      out.push(
        `<text class="dimensionText" x="${fmt(a[0])}" y="${fmt(a[1])}"${rot ? ` transform="rotate(${fmt(rot)} ${fmt(a[0])} ${fmt(a[1])})"` : ''}>${escapeXml(d.text)}</text>`,
      )
      const feature = d.featureId ? ` data-feature-id="${escapeXml(d.featureId)}"` : ''
      return `<g data-dimension-id="${escapeXml(d.id)}"${feature} data-dimension-kind="${d.kind}">${out.join('')}</g>`
    })
    .join('')
}
