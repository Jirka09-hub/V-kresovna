import {
  CENTER_LINE_OVERHANG_MM,
  FIRST_ANGLE_LAYOUT,
  STANDARD_VIEWS,
  THIRD_ANGLE_DEMO_ONLY,
  type GridPosition,
  type Vec3,
  type ViewName,
} from '@vykresovna/drafting-standards'
import { extractEdges, type EdgeModel } from '../edges/extract'
import type { SolidMesh } from '../mesh/types'
import { AXIS_INDEX, otherAxes, type PartSpec } from '../part/spec'
import { projectView, viewBasis, type Vec2, type ViewProjection } from '../projection/hlr'

/** Mezera mezi pohledy na výkrese (mm). Není to norma, jen rozvržení. */
export const VIEW_GAP_MM = 16
/** Okraj kolem výkresu (mm). */
export const DRAWING_MARGIN_MM = 8

export type CenterLine = {
  readonly a: Vec2
  readonly b: Vec2
  /** Prvek, ke kterému osa patří. */
  readonly featureId: string
}

/** Kružnice, která se ve výkresu kreslí přesně (díra viděná ve směru osy). */
export type ViewCircle = {
  readonly center: Vec2
  readonly radius: number
  readonly featureId: string
}

export type DrawingView = {
  readonly view: ViewName
  readonly projection: ViewProjection
  readonly centerLines: readonly CenterLine[]
  readonly circles: readonly ViewCircle[]
  /** Posun levého horního rohu pohledu na výkrese (mm, SVG souřadnice: y dolů). */
  readonly origin: Vec2
  readonly size: Vec2
}

export type Drawing = {
  readonly partId: string
  readonly views: readonly DrawingView[]
  readonly width: number
  readonly height: number
  /** Rozmístění pohledů. 'third-angle-demo' jen pro výslovnou výukovou ukázku. */
  readonly layout: 'first-angle' | 'third-angle-demo'
}

export type DrawingOptions = {
  readonly views?: readonly ViewName[]
  readonly layout?: 'first-angle' | 'third-angle-demo'
  readonly edges?: EdgeModel
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Osy děr a kružnice děr pro daný pohled (z parametrů prvků, ne z geometrie sítě). */
function holeAnnotations(spec: PartSpec, view: ViewName) {
  const basis = viewBasis(view)
  const centerLines: CenterLine[] = []
  const circles: ViewCircle[] = []
  const o = CENTER_LINE_OVERHANG_MM
  const size = spec.base.size
  for (const f of spec.features) {
    if (f.kind !== 'hole') continue
    const r = f.diameter / 2
    const ai = AXIS_INDEX[f.axis]
    const axisVec: Vec3 = [ai === 0 ? 1 : 0, ai === 1 ? 1 : 0, ai === 2 ? 1 : 0]
    const [a, b] = otherAxes(f.axis)
    const extent = size[ai]
    let start = 0
    let end = extent
    if (f.depth !== undefined) {
      start = f.from === 'max' ? extent - f.depth : 0
      end = f.from === 'max' ? extent : f.depth
    }
    const point = (t: number): Vec3 => {
      const p: [number, number, number] = [0, 0, 0]
      p[ai] = t
      p[AXIS_INDEX[a]] = f.at[0]
      p[AXIS_INDEX[b]] = f.at[1]
      return p
    }
    const to2 = (p: Vec3): Vec2 => [dot(p, basis.right), dot(p, basis.up)]
    if (Math.abs(dot(axisVec, basis.dir)) > 0.5) {
      // díra ve směru pohledu: kružnice a osový kříž
      const c = to2(point(start))
      centerLines.push({ a: [c[0] - r - o, c[1]], b: [c[0] + r + o, c[1]], featureId: f.id })
      centerLines.push({ a: [c[0], c[1] - r - o], b: [c[0], c[1] + r + o], featureId: f.id })
      circles.push({ center: c, radius: r, featureId: f.id })
    } else {
      // díra kolmo na směr pohledu: osa podél díry s přesahem
      const p0 = to2(point(start))
      const p1 = to2(point(end))
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
      const ux = (p1[0] - p0[0]) / len
      const uy = (p1[1] - p0[1]) / len
      centerLines.push({
        a: [p0[0] - ux * o, p0[1] - uy * o],
        b: [p1[0] + ux * o, p1[1] + uy * o],
        featureId: f.id,
      })
    }
  }
  return { centerLines, circles }
}

/** Vytvoří výkres součásti: pohledy se skrytými hranami, osami a rozmístěním podle promítání. */
export function createDrawing(
  spec: PartSpec,
  mesh: SolidMesh,
  options: DrawingOptions = {},
): Drawing {
  const viewNames = options.views ?? STANDARD_VIEWS
  const layoutName = options.layout ?? 'first-angle'
  const grid: Readonly<Record<ViewName, GridPosition>> =
    layoutName === 'first-angle' ? FIRST_ANGLE_LAYOUT : THIRD_ANGLE_DEMO_ONLY
  const edges = options.edges ?? extractEdges(mesh)

  const parts = viewNames.map((view) => {
    const projection = projectView(mesh, edges, view)
    const { centerLines, circles } = holeAnnotations(spec, view)
    const size: Vec2 = [
      projection.bounds.max[0] - projection.bounds.min[0],
      projection.bounds.max[1] - projection.bounds.min[1],
    ]
    return { view, projection, centerLines, circles, size, cell: grid[view] }
  })

  // šířky sloupců a výšky řádků mřížky
  const colWidth = new Map<number, number>()
  const rowHeight = new Map<number, number>()
  for (const p of parts) {
    colWidth.set(p.cell[0], Math.max(colWidth.get(p.cell[0]) ?? 0, p.size[0]))
    rowHeight.set(p.cell[1], Math.max(rowHeight.get(p.cell[1]) ?? 0, p.size[1]))
  }
  const cols = [...colWidth.keys()].sort((x, y) => x - y)
  const rows = [...rowHeight.keys()].sort((x, y) => y - x) // nahoře je vyšší řádek
  const colX = new Map<number, number>()
  let x = DRAWING_MARGIN_MM
  for (const c of cols) {
    colX.set(c, x)
    x += colWidth.get(c)! + VIEW_GAP_MM
  }
  const rowY = new Map<number, number>()
  let y = DRAWING_MARGIN_MM
  for (const r of rows) {
    rowY.set(r, y)
    y += rowHeight.get(r)! + VIEW_GAP_MM
  }

  const views: DrawingView[] = parts.map((p) => ({
    view: p.view,
    projection: p.projection,
    centerLines: p.centerLines,
    circles: p.circles,
    size: p.size,
    origin: [colX.get(p.cell[0])!, rowY.get(p.cell[1])!],
  }))

  return {
    partId: spec.id,
    views,
    width: x - VIEW_GAP_MM + DRAWING_MARGIN_MM,
    height: y - VIEW_GAP_MM + DRAWING_MARGIN_MM,
    layout: layoutName,
  }
}
