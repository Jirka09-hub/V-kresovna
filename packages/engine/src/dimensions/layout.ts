import {
  ARROW_LENGTH_MM,
  ARROWS_INSIDE_MIN_LENGTH_MM,
  arrowWidth,
  DIMENSION_FIRST_OFFSET_MM,
  DIMENSION_ROW_SPACING_MM,
  DIMENSION_TEXT_GAP_MM,
  DIMENSION_TEXT_HEIGHT_MM,
  dimensionTextRotationDeg,
  EXTENSION_LINE_GAP_MM,
  EXTENSION_LINE_OVERSHOOT_MM,
  textUpVector,
  type ViewName,
} from '@vykresovna/drafting-standards'
import type { CenterLine, ViewCircle } from '../drawing/drawing'
import { AXIS_INDEX, otherAxes, type Axis, type Box } from '../part/spec'
import { viewBasis, type Vec2, type ViewProjection } from '../projection/hlr'
import {
  convexOverlap,
  estimateTextWidth,
  round3,
  roundVec,
  segmentsCross,
  textRect,
  type Poly,
} from './geometry'
import type {
  DimensionArrow,
  DimensionLineSegment,
  DimensionMargins,
  DimensionSide,
  DrawingDimension,
  PartDimension,
} from './types'

/**
 * Volba pohledu pro každou kótu a rozmístění kót v pohledu.
 *
 * Volba pohledu: kóta jde do pohledu, kde má prvek skutečný tvar a kde jsou místa, odkud vedou pomocné
 * čáry, vidět (viditelná hrana > skrytá hrana). Při shodě vyhrává nárys, pak půdorys, pak bokorys.
 *
 * Rozmístění: délkové kóty leží vně obrysu na straně bližší kótovanému prvku, v řadách od obrysu.
 * Kratší kóty se umisťují dřív, takže leží blíž k tělesu. Kóta jde do nejbližší řady, kde nepřekryje text
 * jiné kóty a nekříží cizí kótovací ani pomocné čáry. Průměry děr se kótují u kružnice šikmou kótovací
 * čarou přes střed s textem venku.
 */

/** Vstup jednoho pohledu (stejná data, jaká má `DrawingView`). */
export type DimensionViewInput = {
  readonly view: ViewName
  readonly projection: ViewProjection
  readonly centerLines: readonly CenterLine[]
  readonly circles: readonly ViewCircle[]
}

export type ViewDimensions = {
  readonly view: ViewName
  readonly dimensions: readonly DrawingDimension[]
  readonly margins: DimensionMargins
}

type Orient = 'h' | 'v'

const EPS = 1e-4
/** Kolik řad kót nejvýš zkoušíme na jedné straně, než se vzdáme hledání volného místa. */
const MAX_ROWS = 8
/** Mezery pro kontrolu překryvu (mm). Nejsou to normy, jen vzduch kolem textu. */
const TEXT_CLEARANCE = 0.8
const LINE_CLEARANCE = 0.3
const VIEW_ORDER_BONUS: Partial<Record<ViewName, number>> = { front: 0.3, top: 0.2, left: 0.1 }

/** Jak se osa součásti promítá do pohledu: vodorovně (u), svisle (v), nebo vůbec (směr pohledu). */
function axisInView(view: ViewName, axis: Axis): { orient: Orient; sign: number } | null {
  const basis = viewBasis(view)
  const i = AXIS_INDEX[axis]
  if (Math.abs(basis.right[i]) > 0.5) return { orient: 'h', sign: basis.right[i] }
  if (Math.abs(basis.up[i]) > 0.5) return { orient: 'v', sign: basis.up[i] }
  return null
}

/** Obdélník kvádru v souřadnicích pohledu. */
function regionInView(view: ViewName, box: Box): { u: [number, number]; v: [number, number] } {
  const u: [number, number] = [Infinity, -Infinity]
  const v: [number, number] = [Infinity, -Infinity]
  for (const axis of ['x', 'y', 'z'] as const) {
    const m = axisInView(view, axis)
    if (!m) continue
    const i = AXIS_INDEX[axis]
    const a = box.min[i]! * m.sign
    const b = box.max[i]! * m.sign
    const target = m.orient === 'h' ? u : v
    target[0] = Math.min(target[0], a, b)
    target[1] = Math.max(target[1], a, b)
  }
  return { u, v }
}

const along = (p: Vec2, o: Orient) => (o === 'h' ? p[0] : p[1])
const across = (p: Vec2, o: Orient) => (o === 'h' ? p[1] : p[0])
const pt = (o: Orient, a: number, c: number): Vec2 => (o === 'h' ? [a, c] : [c, a])

/** Místo, odkud vede pomocná čára: kandidátní body a jejich „kvalita“ (viditelná 2, skrytá 1). */
type EndInfo = { readonly quality: number; readonly points: readonly Vec2[] }

type Measure = {
  readonly dim: PartDimension
  readonly view: ViewName
  readonly input: DimensionViewInput
  readonly orient: Orient
  /** Konce kóty podél směru měření (souřadnice pohledu, p0 < p1). */
  readonly p0: number
  readonly p1: number
  readonly ends: readonly [EndInfo, EndInfo]
  /** Rozsah kótovaného místa napříč směrem měření (pro volbu strany). */
  readonly perp: readonly [number, number]
  readonly score: number
}

function findEnd(
  input: DimensionViewInput,
  dim: PartDimension,
  orient: Orient,
  p: number,
  perp: readonly [number, number],
  isHoleCenter: boolean,
): EndInfo | null {
  if (isHoleCenter) {
    // střed díry: pomocná čára pokračuje osou díry (nebo osou souměrnosti, na které díra leží)
    const lines = input.centerLines.filter(
      (cl) =>
        (cl.featureId === dim.featureId || cl.featureId.startsWith('symmetry:')) &&
        Math.abs(along(cl.a, orient) - p) < EPS &&
        Math.abs(along(cl.b, orient) - p) < EPS,
    )
    if (lines.length) {
      const circleView = dim.hole && axisInView(input.view, dim.hole.axis) === null
      return { quality: circleView ? 2 : 1.5, points: lines.flatMap((cl) => [cl.a, cl.b]) }
    }
  }
  const lo = perp[0] - EPS
  const hi = perp[1] + EPS
  for (const visibility of ['visible', 'hidden'] as const) {
    const points: Vec2[] = []
    for (const s of input.projection.segments) {
      if (s.visibility !== visibility) continue
      const aOn = Math.abs(along(s.a, orient) - p) < EPS
      const bOn = Math.abs(along(s.b, orient) - p) < EPS
      if (aOn && bOn) {
        // úsečka ve směru pomocné čáry: oříznout na rozsah prvku
        const c0 = Math.max(Math.min(across(s.a, orient), across(s.b, orient)), lo)
        const c1 = Math.min(Math.max(across(s.a, orient), across(s.b, orient)), hi)
        if (c0 <= c1) points.push(pt(orient, p, c0), pt(orient, p, c1))
      } else {
        for (const [on, q] of [
          [aOn, s.a],
          [bOn, s.b],
        ] as const) {
          if (on && across(q, orient) >= lo && across(q, orient) <= hi) points.push(q)
        }
      }
    }
    if (points.length) return { quality: visibility === 'visible' ? 2 : 1, points }
  }
  return null
}

/** Jak dobře jde kótu umístit do pohledu (null = nejde). */
function measureIn(dim: PartDimension, input: DimensionViewInput): Measure | null {
  if (dim.kind === 'diameter') return null // průměr řeší `diameterIn`
  const m = axisInView(input.view, dim.axis)
  if (!m) return null
  const region = regionInView(input.view, dim.region)
  const a = dim.span[0] * m.sign
  const b = dim.span[1] * m.sign
  const p0 = Math.min(a, b)
  const p1 = Math.max(a, b)
  const perp = m.orient === 'h' ? region.v : region.u
  // u polohy díry leží střed na konci span[1]
  const centerAt = dim.hole && dim.role === 'position' ? dim.span[1] * m.sign : null
  const e0 = findEnd(
    input,
    dim,
    m.orient,
    p0,
    perp,
    centerAt !== null && Math.abs(centerAt - p0) < EPS,
  )
  const e1 = findEnd(
    input,
    dim,
    m.orient,
    p1,
    perp,
    centerAt !== null && Math.abs(centerAt - p1) < EPS,
  )
  if (!e0 || !e1) return null
  const trueShape = dim.trueShapeAxes.some((ax) => axisInView(input.view, ax) === null)
  const score = e0.quality + e1.quality + (trueShape ? 4 : 0) + (VIEW_ORDER_BONUS[input.view] ?? 0)
  return { dim, view: input.view, input, orient: m.orient, p0, p1, ends: [e0, e1], perp, score }
}

/** Průměr díry: pohled, kde je díra kružnicí. */
function diameterIn(dim: PartDimension, input: DimensionViewInput): ViewCircle | null {
  if (dim.kind !== 'diameter') return null
  return input.circles.find((c) => c.featureId === dim.featureId) ?? null
}

/**
 * Náhradní délková kóta průměru, když se díra v žádném kresleném pohledu nejeví jako kružnice:
 * měří se mezi obrysy díry kolmo na její osu.
 */
function diameterAsLinear(dim: PartDimension, input: DimensionViewInput): PartDimension | null {
  if (!dim.hole || axisInView(input.view, dim.hole.axis) === null) return null
  const [a, b] = otherAxes(dim.hole.axis)
  const axis = axisInView(input.view, a) ? a : b
  const c = dim.hole.center[AXIS_INDEX[axis]]
  return {
    ...dim,
    kind: 'linear',
    axis,
    span: [c - dim.hole.radius, c + dim.hole.radius],
  }
}

type Placed = {
  readonly dimLines: readonly DimensionLineSegment[]
  readonly extLines: readonly DimensionLineSegment[]
  readonly textBox: Poly
}

type Geometry = {
  readonly lines: DimensionLineSegment[]
  readonly arrows: DimensionArrow[]
  readonly textAnchor: Vec2
  readonly textRotationDeg: number
  readonly textBox: Poly
}

function arrow(tip: Vec2, towardBase: Vec2): DimensionArrow {
  const half = arrowWidth() / 2
  const base: Vec2 = [
    tip[0] + towardBase[0] * ARROW_LENGTH_MM,
    tip[1] + towardBase[1] * ARROW_LENGTH_MM,
  ]
  const n: Vec2 = [-towardBase[1], towardBase[0]]
  return [
    roundVec(tip),
    roundVec([base[0] + n[0] * half, base[1] + n[1] * half]),
    roundVec([base[0] - n[0] * half, base[1] - n[1] * half]),
  ]
}

/** Směr textu a „nahoru“ v souřadnicích pohledu (v nahoru) pro čáru se směrem `d` (pohled). */
function textFrame(d: Vec2): { rotation: number; dir: Vec2; up: Vec2 } {
  // pohled → SVG: y se obrací
  const rotation = dimensionTextRotationDeg(d[0], -d[1])
  const r = (rotation * Math.PI) / 180
  const upSvg = textUpVector(rotation)
  return {
    rotation,
    dir: [Math.cos(r), -Math.sin(r)],
    up: [upSvg[0], -upSvg[1]],
  }
}

const sideSign: Record<Exclude<DimensionSide, 'inside'>, number> = {
  top: 1,
  right: 1,
  bottom: -1,
  left: -1,
}

function linearGeometry(
  m: Measure,
  side: Exclude<DimensionSide, 'inside'>,
  row: number,
  bounds: ViewProjection['bounds'],
  textAfter: boolean,
): Geometry {
  const o = m.orient
  const sign = sideSign[side]
  const edge = sign > 0 ? across(bounds.max, o) : across(bounds.min, o)
  const lineAt = edge + sign * (DIMENSION_FIRST_OFFSET_MM + row * DIMENSION_ROW_SPACING_MM)
  const lines: DimensionLineSegment[] = []
  // pomocné čáry: od nejkrajnějšího bodu prvku na straně kóty
  for (const [p, end] of [
    [m.p0, m.ends[0]],
    [m.p1, m.ends[1]],
  ] as const) {
    let start = end.points.reduce(
      (best, q) => (sign > 0 ? Math.max(best, across(q, o)) : Math.min(best, across(q, o))),
      sign > 0 ? -Infinity : Infinity,
    )
    // když obrys pokračuje ve směru pomocné čáry, pomocná čára začne až na jeho konci
    // (jinak by kreslila tenkou čáru přes tlustou hranu)
    for (let moved = true; moved;) {
      moved = false
      for (const s of m.input.projection.segments) {
        if (Math.abs(along(s.a, o) - p) > EPS || Math.abs(along(s.b, o) - p) > EPS) continue
        const lo = Math.min(across(s.a, o), across(s.b, o))
        const hi = Math.max(across(s.a, o), across(s.b, o))
        if (start < lo - EPS || start > hi + EPS) continue
        const far = sign > 0 ? hi : lo
        if ((far - start) * sign > EPS) {
          start = far
          moved = true
        }
      }
    }
    lines.push({
      a: roundVec(pt(o, p, start + sign * EXTENSION_LINE_GAP_MM)),
      b: roundVec(pt(o, p, lineAt + sign * EXTENSION_LINE_OVERSHOOT_MM)),
      kind: 'extensionLine',
    })
  }
  const len = m.p1 - m.p0
  const inside = len >= ARROWS_INSIDE_MIN_LENGTH_MM
  const width = estimateTextWidth(m.dim.text)
  const unit: Vec2 = pt(o, 1, 0)
  const frame = textFrame(unit)
  let lineFrom = m.p0
  let lineTo = m.p1
  let textMid: number
  if (width + 1 <= len) {
    textMid = (m.p0 + m.p1) / 2
  } else if (textAfter) {
    const start = m.p1 + (inside ? 1 : ARROW_LENGTH_MM + 1)
    textMid = start + width / 2
    lineTo = start + width
  } else {
    const start = m.p0 - (inside ? 1 : ARROW_LENGTH_MM + 1)
    textMid = start - width / 2
    lineFrom = start - width
  }
  if (!inside) {
    // šipky zvenku: krátké konce kótovací čáry za šipkami
    lineFrom = Math.min(lineFrom, m.p0 - ARROW_LENGTH_MM - 2)
    lineTo = Math.max(lineTo, m.p1 + ARROW_LENGTH_MM + 2)
  }
  // kótovací čára po kouscích: hlavní část mezi pomocnými čarami a případná prodloužení
  const pieces: [number, number][] = [[m.p0, m.p1]]
  if (lineFrom < m.p0 - EPS) pieces.push([lineFrom, m.p0])
  if (lineTo > m.p1 + EPS) pieces.push([m.p1, lineTo])
  for (const [a, b] of pieces) {
    lines.push({
      a: roundVec(pt(o, a, lineAt)),
      b: roundVec(pt(o, b, lineAt)),
      kind: 'dimensionLine',
    })
  }
  const dirIn = inside ? 1 : -1
  const arrows = [
    arrow(pt(o, m.p0, lineAt), pt(o, dirIn, 0)),
    arrow(pt(o, m.p1, lineAt), pt(o, -dirIn, 0)),
  ]
  const base = pt(o, textMid, lineAt)
  const anchor: Vec2 = [
    base[0] + frame.up[0] * DIMENSION_TEXT_GAP_MM,
    base[1] + frame.up[1] * DIMENSION_TEXT_GAP_MM,
  ]
  return {
    lines,
    arrows,
    textAnchor: roundVec(anchor),
    textRotationDeg: frame.rotation,
    textBox: textRect(anchor, frame.dir, frame.up, width, DIMENSION_TEXT_HEIGHT_MM),
  }
}

/** Průměr u kružnice: kótovací čára přes střed pod úhlem `angleDeg`, text na prodloužení vně kružnice. */
function diameterGeometry(dim: PartDimension, circle: ViewCircle, angleDeg: number): Geometry {
  const a = (angleDeg * Math.PI) / 180
  const d: Vec2 = [Math.cos(a), Math.sin(a)]
  const c = circle.center
  const r = circle.radius
  const at = (t: number): Vec2 => [c[0] + d[0] * t, c[1] + d[1] * t]
  const width = estimateTextWidth(dim.text)
  const inside = 2 * r >= ARROWS_INSIDE_MIN_LENGTH_MM
  const frame = textFrame(d)
  // text začíná kousek za kružnicí (u malé díry až za šipkou), aby se nedotkl osového kříže
  const textStart = Math.max(
    inside ? r + 1 : r + ARROW_LENGTH_MM + 1,
    DIMENSION_TEXT_GAP_MM + DIMENSION_TEXT_HEIGHT_MM + 0.5,
  )
  const textMid = textStart + width / 2
  const from = inside ? -r : -r - ARROW_LENGTH_MM - 2
  const lines: DimensionLineSegment[] = [
    { a: roundVec(at(from)), b: roundVec(at(textStart + width)), kind: 'dimensionLine' },
  ]
  const s = inside ? 1 : -1
  const arrows = [arrow(at(-r), [d[0] * s, d[1] * s]), arrow(at(r), [-d[0] * s, -d[1] * s])]
  const base = at(textMid)
  const anchor: Vec2 = [
    base[0] + frame.up[0] * DIMENSION_TEXT_GAP_MM,
    base[1] + frame.up[1] * DIMENSION_TEXT_GAP_MM,
  ]
  return {
    lines,
    arrows,
    textAnchor: roundVec(anchor),
    textRotationDeg: frame.rotation,
    textBox: textRect(anchor, frame.dir, frame.up, width, DIMENSION_TEXT_HEIGHT_MM),
  }
}

/** Počet kolizí nové kóty s už umístěnými kótami a s čarami pohledu (0 = v pořádku). */
function conflicts(g: Geometry, placed: readonly Placed[], geometry: readonly Poly[]): number {
  let n = 0
  const dimLines = g.lines.filter((l) => l.kind === 'dimensionLine')
  const extLines = g.lines.filter((l) => l.kind === 'extensionLine')
  for (const seg of geometry) if (convexOverlap(g.textBox, seg, LINE_CLEARANCE)) n++
  for (const p of placed) {
    if (convexOverlap(g.textBox, p.textBox, TEXT_CLEARANCE)) n += 10
    for (const l of [...p.dimLines, ...p.extLines]) {
      if (convexOverlap(g.textBox, [l.a, l.b], LINE_CLEARANCE)) n += 5
    }
    for (const l of g.lines) {
      if (convexOverlap(p.textBox, [l.a, l.b], LINE_CLEARANCE)) n += 5
    }
    // kótovací čáry ve stejné řadě se nesmějí překrývat (dotyk v konci je řetězec kót, ten je v pořádku)
    for (const l of dimLines) {
      for (const q of p.dimLines) if (convexOverlap([l.a, l.b], [q.a, q.b], 0)) n += 5
    }
    // křížení kótovací čáry s cizí pomocnou čarou (pomocné čáry se navzájem křížit smějí,
    // např. u osazení v rohu, kde se jinak kóta nedá umístit)
    for (const l of dimLines) {
      for (const q of p.extLines) if (segmentsCross(l.a, l.b, q.a, q.b)) n += 2
    }
    for (const l of extLines) {
      for (const q of p.dimLines) if (segmentsCross(l.a, l.b, q.a, q.b)) n += 2
    }
  }
  return n
}

const OPPOSITE: Record<Exclude<DimensionSide, 'inside'>, Exclude<DimensionSide, 'inside'>> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

/** Výchozí strana kót v pohledu: vně sestavy pohledů (u evropského promítání). */
function defaultSide(view: ViewName, o: Orient): Exclude<DimensionSide, 'inside'> {
  if (o === 'h') return view === 'bottom' ? 'top' : 'bottom'
  return view === 'left' || view === 'rear' ? 'right' : 'left'
}

function chooseSide(
  m: Measure,
  bounds: ViewProjection['bounds'],
): Exclude<DimensionSide, 'inside'> {
  const lo = across(bounds.min, m.orient)
  const hi = across(bounds.max, m.orient)
  const toMin = m.perp[0] - lo
  const toMax = hi - m.perp[1]
  if (Math.abs(toMin - toMax) < EPS) return defaultSide(m.view, m.orient)
  if (m.orient === 'h') return toMax < toMin ? 'top' : 'bottom'
  return toMax < toMin ? 'right' : 'left'
}

/** Čáry pohledu jako úsečky (pro kontrolu, že text kóty nepřekrývá výkres). */
function viewGeometry(input: DimensionViewInput): Poly[] {
  const polys: Poly[] = input.projection.segments.map((s) => [s.a, s.b])
  for (const cl of input.centerLines) polys.push([cl.a, cl.b])
  return polys
}

function toDimension(
  dim: PartDimension,
  view: ViewName,
  side: DimensionSide,
  row: number,
  g: Geometry,
): DrawingDimension {
  return {
    id: dim.id,
    featureId: dim.featureId,
    kind: dim.kind,
    role: dim.role,
    value: dim.value,
    text: dim.text,
    view,
    side,
    row,
    lines: g.lines,
    arrows: g.arrows,
    textAnchor: g.textAnchor,
    textRotationDeg: g.textRotationDeg,
    textBox: g.textBox.map(roundVec),
  }
}

/** Rozmístí kóty jednoho pohledu. */
function layoutView(
  input: DimensionViewInput,
  measures: readonly Measure[],
  diameters: readonly { dim: PartDimension; circle: ViewCircle }[],
): ViewDimensions {
  const bounds = input.projection.bounds
  const geometry = viewGeometry(input)
  const placed: Placed[] = []
  const result: DrawingDimension[] = []
  const remember = (g: Geometry) =>
    placed.push({
      dimLines: g.lines.filter((l) => l.kind === 'dimensionLine'),
      extLines: g.lines.filter((l) => l.kind === 'extensionLine'),
      textBox: g.textBox,
    })

  // kratší kóty dřív (blíž k obrysu); při shodě podle pořadí v popisu součásti
  const sorted = [...measures].sort((a, b) => a.p1 - a.p0 - (b.p1 - b.p0))
  for (const m of sorted) {
    const preferred = chooseSide(m, bounds)
    let best: {
      side: Exclude<DimensionSide, 'inside'>
      row: number
      g: Geometry
      n: number
    } | null = null
    search: for (const side of [preferred, OPPOSITE[preferred]]) {
      for (let row = 0; row < MAX_ROWS; row++) {
        for (const textAfter of [true, false]) {
          const g = linearGeometry(m, side, row, bounds, textAfter)
          const n = conflicts(g, placed, geometry)
          // na opačné straně jen tehdy, když na preferované nebylo místo vůbec
          if (!best || n < best.n) best = { side, row, g, n }
          if (n === 0) break search
        }
      }
    }
    remember(best!.g)
    result.push(toDimension(m.dim, input.view, best!.side, best!.row, best!.g))
  }

  for (const { dim, circle } of diameters) {
    let best: { g: Geometry; n: number } | null = null
    for (const angle of [45, 135, -45, -135, 60, 120, -60, -120, 30, 150, -30, -150]) {
      const g = diameterGeometry(dim, circle, angle)
      const n = conflicts(g, placed, geometry)
      if (!best || n < best.n) best = { g, n }
      if (n === 0) break
    }
    remember(best!.g)
    result.push(toDimension(dim, input.view, 'inside', 0, best!.g))
  }

  // stabilní pořadí ve výstupu: podle id
  result.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return { view: input.view, dimensions: result, margins: marginsOf(result, bounds) }
}

/** O kolik kóty přesahují průmět pohledu na každé straně. */
export function marginsOf(
  dims: readonly DrawingDimension[],
  bounds: ViewProjection['bounds'],
): DimensionMargins {
  let minU = bounds.min[0]
  let maxU = bounds.max[0]
  let minV = bounds.min[1]
  let maxV = bounds.max[1]
  for (const d of dims) {
    const pts = [...d.lines.flatMap((l) => [l.a, l.b]), ...d.arrows.flat(), ...d.textBox]
    for (const p of pts) {
      minU = Math.min(minU, p[0])
      maxU = Math.max(maxU, p[0])
      minV = Math.min(minV, p[1])
      maxV = Math.max(maxV, p[1])
    }
  }
  return {
    left: round3(bounds.min[0] - minU),
    right: round3(maxU - bounds.max[0]),
    bottom: round3(bounds.min[1] - minV),
    top: round3(maxV - bounds.max[1]),
  }
}

/**
 * Přiřadí kóty pohledům (každou právě jednomu) a rozmístí je. Kóty, které nejde ukázat v žádném
 * z kreslených pohledů, se vynechají.
 */
export function layoutDimensions(
  dims: readonly PartDimension[],
  views: readonly DimensionViewInput[],
): ViewDimensions[] {
  const measures = new Map<ViewName, Measure[]>()
  const diameters = new Map<ViewName, { dim: PartDimension; circle: ViewCircle }[]>()
  for (const v of views) {
    measures.set(v.view, [])
    diameters.set(v.view, [])
  }
  for (const dim of dims) {
    if (dim.kind === 'diameter') {
      const circleView = views.find((v) => diameterIn(dim, v))
      if (circleView) {
        diameters.get(circleView.view)!.push({ dim, circle: diameterIn(dim, circleView)! })
        continue
      }
      // díra se nikde nejeví jako kružnice: délková kóta s ⌀ mezi obrysy díry
      const options = views
        .map((v) => {
          const lin = diameterAsLinear(dim, v)
          return lin ? measureIn(lin, v) : null
        })
        .filter((m): m is Measure => m !== null)
      const best = options.sort((a, b) => b.score - a.score)[0]
      if (best) measures.get(best.view)!.push(best)
      continue
    }
    const options = views
      .map((v) => measureIn(dim, v))
      .filter((m): m is Measure => m !== null)
      .sort((a, b) => b.score - a.score)
    const best = options[0]
    if (best) measures.get(best.view)!.push(best)
  }
  return views.map((v) => layoutView(v, measures.get(v.view)!, diameters.get(v.view)!))
}
