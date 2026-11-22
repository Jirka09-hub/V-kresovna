import {
  dashArrayMm,
  LINE_STYLES,
  LINE_WIDTH_MM,
  type LineKind,
} from '@vykresovna/drafting-standards'
import { dimensionStyleRules, renderDimensions } from '../dimensions/svg'
import type { EdgeVisibility, Vec2 } from '../projection/hlr'
import type { Drawing, DrawingView, ViewCircle } from './drawing'
import {
  hasSections,
  renderSectionOverlay,
  renderSectionUnderlay,
  sectionStyleRules,
} from '../section/svg'

/**
 * Převod výkresu do SVG. Souřadnice i tloušťky čar jsou v mm (viewBox v mm), takže výkres jde
 * tisknout v měřítku 1 : 1 a libovolně zvětšovat.
 */

export type SvgOptions = {
  /** Zobrazit skryté hrany (výchozí ano). */
  readonly showHidden?: boolean
  /** Zobrazit osy (výchozí ano). */
  readonly showCenterLines?: boolean
  /** Atribut `id` kořenového prvku. */
  readonly id?: string
  /** Popisek pro čtečky obrazovky (text dodává UI přes i18n). */
  readonly title?: string
}

const fmt = (n: number) => {
  const r = Math.round(n * 1000) / 1000 + 0
  return Number.isInteger(r) ? String(r) : r.toFixed(3).replace(/0+$/, '')
}

/**
 * Třída kořenového `<svg>` výkresu. Všechna pravidla stylu jsou omezená na ni, takže výkres vložený
 * přímo do stránky (inline SVG) nemění vzhled jiných SVG na stránce.
 */
export const DRAWING_ROOT_CLASS = 'vk-drawing'

/** Omezí pravidla CSS na výkres: před každý selektor přidá `.vk-drawing `. */
export function scopeCss(css: string, scope = DRAWING_ROOT_CLASS): string {
  return css
    .split('}')
    .filter((rule) => rule.trim() !== '')
    .map((rule) => {
      const i = rule.indexOf('{')
      const selectors = rule
        .slice(0, i)
        .split(',')
        .map((sel) => `.${scope} ${sel.trim()}`)
        .join(',')
      return `${selectors}${rule.slice(i)}}`
    })
    .join('')
}

const KIND_BY_VISIBILITY: Record<EdgeVisibility, LineKind> = {
  visible: 'visibleEdge',
  hidden: 'hiddenEdge',
}

function styleBlock(drawing: Drawing): string {
  const kinds: LineKind[] = ['visibleEdge', 'hiddenEdge', 'centerLine']
  const rules = kinds.map((k) => {
    const dash = dashArrayMm(k)
    const width = LINE_WIDTH_MM[LINE_STYLES[k].weight]
    return `.${k}{stroke-width:${fmt(width)}${dash.length ? `;stroke-dasharray:${dash.map(fmt).join(' ')}` : ''}}`
  })
  const css = [
    'path,circle,line{fill:none;stroke:var(--drawing-ink,#111);stroke-linecap:butt;stroke-linejoin:round}',
    ...rules,
    '[data-highlight="true"]{stroke:var(--drawing-highlight,#1d4ed8)}',
    ...(drawing.views.some((v) => v.dimensions?.length) ? [dimensionStyleRules()] : []),
    ...(hasSections(drawing) ? [sectionStyleRules()] : []),
  ].join('')
  return scopeCss(css)
}

type Chain = { points: Vec2[]; closed: boolean; edgeIds: Set<string> }

/** Spojí navazující úseky stejného druhu do lomených čar (aby čárkování plynule pokračovalo). */
function chainSegments(segs: readonly { a: Vec2; b: Vec2; edgeIds: readonly string[] }[]): Chain[] {
  const key = (p: Vec2) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)}`
  const byPoint = new Map<string, number[]>()
  segs.forEach((s, i) => {
    for (const p of [s.a, s.b]) {
      const k = key(p)
      const l = byPoint.get(k)
      if (l) l.push(i)
      else byPoint.set(k, [i])
    }
  })
  const used = new Uint8Array(segs.length)
  const chains: Chain[] = []

  const extend = (start: number, from: Vec2): Chain => {
    const seg = segs[start]!
    used[start] = 1
    const forward = key(seg.a) === key(from)
    const points: Vec2[] = forward ? [seg.a, seg.b] : [seg.b, seg.a]
    const edgeIds = new Set(seg.edgeIds)
    for (;;) {
      const end = points[points.length - 1]!
      const k = key(end)
      const candidates = byPoint.get(k)!
      if (candidates.length !== 2) break // rozvětvení nebo konec: řetězec končí
      const next = candidates.find((c) => !used[c])
      if (next === undefined) break
      used[next] = 1
      const ns = segs[next]!
      points.push(key(ns.a) === k ? ns.b : ns.a)
      for (const id of ns.edgeIds) edgeIds.add(id)
    }
    const closed = points.length > 3 && key(points[0]!) === key(points[points.length - 1]!)
    if (closed) points.pop()
    return { points, closed, edgeIds }
  }

  // začít v koncových bodech a rozvětveních, pak zbylé uzavřené smyčky
  segs.forEach((s, i) => {
    if (used[i]) return
    for (const p of [s.a, s.b]) {
      if (!used[i] && byPoint.get(key(p))!.length !== 2) chains.push(extend(i, p))
    }
  })
  segs.forEach((s, i) => {
    if (!used[i]) chains.push(extend(i, s.a))
  })
  return chains
}

/**
 * Posun vzoru osy tak, aby střed čáry padl doprostřed dlouhé čárky (osy děr se pak kříží v čárkách).
 */
function centeredDashOffset(length: number): number {
  const pattern = dashArrayMm('centerLine')
  const period = pattern.reduce((a, b) => a + b, 0)
  const dash = pattern[0] ?? 0
  return (((dash / 2 - length / 2) % period) + period) % period
}

function onCircle(points: readonly Vec2[], c: ViewCircle): boolean {
  return points.every(
    (p) => Math.abs(Math.hypot(p[0] - c.center[0], p[1] - c.center[1]) - c.radius) < 1e-3,
  )
}

function attrs(kind: LineKind, edgeIds: Iterable<string>): string {
  const ids = [...edgeIds].sort().join(' ')
  return `class="${kind}"${ids ? ` data-edge-ids="${ids}"` : ''}`
}

function renderView(v: DrawingView, opts: SvgOptions): string {
  const { min, max } = v.projection.bounds
  // pohled: u doprava, v nahoru → SVG: x doprava, y dolů
  const tx = (p: Vec2): Vec2 => [v.origin[0] + (p[0] - min[0]), v.origin[1] + (max[1] - p[1])]
  // plochy řezu a šrafy pod hranami
  const out: string[] = v.section ? [renderSectionUnderlay(v)] : []

  for (const visibility of ['hidden', 'visible'] as const) {
    if (visibility === 'hidden' && opts.showHidden === false) continue
    const kind = KIND_BY_VISIBILITY[visibility]
    const segs = v.projection.segments
      .filter((s) => s.visibility === visibility)
      .map((s) => ({ a: tx(s.a), b: tx(s.b), edgeIds: s.edgeIds }))
    const circles = v.circles.map((c) => ({ ...c, center: tx(c.center) }))
    for (const chain of chainSegments(segs)) {
      const circle =
        chain.points.length >= 4 ? circles.find((c) => onCircle(chain.points, c)) : undefined
      // celá kružnice, i když se konce řetězce kvůli zaokrouhlení liší o desetitisícinu mm
      const p0 = chain.points[0]!
      const pn = chain.points[chain.points.length - 1]!
      const almostClosed = Math.hypot(pn[0] - p0[0], pn[1] - p0[1]) < 1e-3
      if (circle && (chain.closed || almostClosed)) {
        out.push(
          `<circle ${attrs(kind, chain.edgeIds)} cx="${fmt(circle.center[0])}" cy="${fmt(circle.center[1])}" r="${fmt(circle.radius)}"/>`,
        )
        continue
      }
      if (circle) {
        // oblouk: směr a velikost podle součtu úhlů mezi body
        const ang = (p: Vec2) => Math.atan2(p[1] - circle.center[1], p[0] - circle.center[0])
        let total = 0
        for (let i = 1; i < chain.points.length; i++) {
          let d = ang(chain.points[i]!) - ang(chain.points[i - 1]!)
          if (d > Math.PI) d -= 2 * Math.PI
          if (d < -Math.PI) d += 2 * Math.PI
          total += d
        }
        const p0 = chain.points[0]!
        const p1 = chain.points[chain.points.length - 1]!
        const large = Math.abs(total) > Math.PI ? 1 : 0
        const sweep = total > 0 ? 1 : 0
        const r = fmt(circle.radius)
        out.push(
          `<path ${attrs(kind, chain.edgeIds)} d="M${fmt(p0[0])} ${fmt(p0[1])}A${r} ${r} 0 ${large} ${sweep} ${fmt(p1[0])} ${fmt(p1[1])}"/>`,
        )
        continue
      }
      const pts = chain.points.map((p) => `${fmt(p[0])} ${fmt(p[1])}`)
      out.push(
        `<path ${attrs(kind, chain.edgeIds)} d="M${pts.join('L')}${chain.closed ? 'Z' : ''}"/>`,
      )
    }
  }

  if (opts.showCenterLines !== false) {
    for (const cl of v.centerLines) {
      const a = tx(cl.a)
      const b = tx(cl.b)
      out.push(
        `<path ${attrs('centerLine', [`feature:${cl.featureId}`])} stroke-dashoffset="${fmt(centeredDashOffset(Math.hypot(b[0] - a[0], b[1] - a[1])))}" d="M${fmt(a[0])} ${fmt(a[1])}L${fmt(b[0])} ${fmt(b[1])}"/>`,
      )
    }
  }
  if (v.dimensions?.length) out.push(renderDimensions(v.dimensions, tx))
  if (v.section || v.cuttingPlanes) out.push(renderSectionOverlay(v))
  const sectionAttr = v.section ? ` data-section="${escapeXml(v.section.label)}"` : ''
  return `<g data-view="${v.view}"${sectionAttr}>${out.join('')}</g>`
}

/** Vykreslí výkres jako samostatný SVG dokument (řetězec). */
export function drawingToSvg(drawing: Drawing, opts: SvgOptions = {}): string {
  const w = fmt(drawing.width)
  const h = fmt(drawing.height)
  const title = opts.title ? `<title>${escapeXml(opts.title)}</title>` : ''
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="${DRAWING_ROOT_CLASS}"${opts.id ? ` id="${escapeXml(opts.id)}"` : ''} viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm" data-part="${escapeXml(drawing.partId)}" data-layout="${drawing.layout}"${opts.title ? ' role="img"' : ''}>`,
    title,
    `<style>${styleBlock(drawing)}</style>`,
    ...drawing.views.map((v) => renderView(v, opts)),
    '</svg>',
  ].join('')
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
