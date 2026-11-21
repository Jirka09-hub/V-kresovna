import {
  CENTER_LINE_OVERHANG_MM,
  drillPointHeight,
  SYMMETRY_AXIS_REQUIRES_FEATURE,
  FIRST_ANGLE_LAYOUT,
  STANDARD_VIEWS,
  THIRD_ANGLE_DEMO_ONLY,
  type GridPosition,
  type Vec3,
  type ViewName,
} from '@vykresovna/drafting-standards'
import { extractEdges, type EdgeModel } from '../edges/extract'
import type { SolidMesh } from '../mesh/types'
import { AXIS_INDEX, otherAxes, type Axis, type Box, type PartSpec } from '../part/spec'
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
      // osa slepé díry sahá až do vrcholu kuželového dna
      const tip = drillPointHeight(f.diameter)
      start = f.from === 'max' ? extent - f.depth - tip : 0
      end = f.from === 'max' ? extent : f.depth + tip
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

const AXES: readonly Axis[] = ['x', 'y', 'z']

/** Obalový kvádr prvku oříznutý na základ (pro test, zda prvek leží uvnitř součásti). */
function featureBox(f: PartSpec['features'][number], size: Vec3): Box {
  switch (f.kind) {
    case 'hole': {
      const ai = AXIS_INDEX[f.axis]
      const [a, b] = otherAxes(f.axis)
      const r = f.diameter / 2
      const min: [number, number, number] = [0, 0, 0]
      const max: [number, number, number] = [size[0], size[1], size[2]]
      if (f.depth !== undefined) {
        const reach = f.depth + drillPointHeight(f.diameter)
        if (f.from === 'max') min[ai] = size[ai] - reach
        else max[ai] = reach
      }
      min[AXIS_INDEX[a]] = f.at[0] - r
      max[AXIS_INDEX[a]] = f.at[0] + r
      min[AXIS_INDEX[b]] = f.at[1] - r
      max[AXIS_INDEX[b]] = f.at[1] + r
      return { min, max }
    }
    case 'chamfer': {
      const [a, b] = otherAxes(f.along)
      const min: [number, number, number] = [0, 0, 0]
      const max: [number, number, number] = [size[0], size[1], size[2]]
      for (const [axis, side] of [
        [a, f.edge[0]],
        [b, f.edge[1]],
      ] as const) {
        const i = AXIS_INDEX[axis]
        if (side === 'min') max[i] = f.size
        else min[i] = size[i] - f.size
      }
      return { min, max }
    }
    default:
      return f.box
  }
}

/** Je množina vrcholů sítě souměrná podle roviny kolmé na osu `ai` v souřadnici `c`? */
function isMirrorSymmetric(mesh: SolidMesh, ai: number, c: number): boolean {
  const TOL = 1e-3
  const CELL = 0.01
  const n = mesh.positions.length / 3
  const cells = new Map<string, number[]>()
  const cellKey = (x: number, y: number, z: number) => `${x},${y},${z}`
  for (let i = 0; i < n; i++) {
    const k = cellKey(
      Math.floor(mesh.positions[i * 3]! / CELL),
      Math.floor(mesh.positions[i * 3 + 1]! / CELL),
      Math.floor(mesh.positions[i * 3 + 2]! / CELL),
    )
    const list = cells.get(k)
    if (list) list.push(i)
    else cells.set(k, [i])
  }
  for (let i = 0; i < n; i++) {
    const p = [mesh.positions[i * 3]!, mesh.positions[i * 3 + 1]!, mesh.positions[i * 3 + 2]!]
    p[ai] = 2 * c - p[ai]!
    const g = p.map((v) => Math.floor(v / CELL))
    let found = false
    search: for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (const j of cells.get(cellKey(g[0]! + dx, g[1]! + dy, g[2]! + dz)) ?? []) {
            if (
              Math.abs(mesh.positions[j * 3]! - p[0]!) < TOL &&
              Math.abs(mesh.positions[j * 3 + 1]! - p[1]!) < TOL &&
              Math.abs(mesh.positions[j * 3 + 2]! - p[2]!) < TOL
            ) {
              found = true
              break search
            }
          }
        }
      }
    }
    if (!found) return false
  }
  return true
}

export type SymmetryPlane = { readonly axis: Axis; readonly at: number }

/**
 * Roviny souměrnosti součásti, pro které se kreslí osa souměrnosti: těleso je podle roviny souměrné
 * a aspoň jeden prvek leží uvnitř součásti (nedotýká se obou konců), takže souměrnost je pro čtení
 * výkresu podstatná.
 */
export function symmetryPlanes(spec: PartSpec, mesh: SolidMesh): SymmetryPlane[] {
  const planes: SymmetryPlane[] = []
  const size = spec.base.size
  for (const axis of AXES) {
    const ai = AXIS_INDEX[axis]
    const lo = mesh.bbox.min[ai]
    const hi = mesh.bbox.max[ai]
    const c = (lo + hi) / 2
    if (SYMMETRY_AXIS_REQUIRES_FEATURE) {
      const inner = spec.features.some((f) => {
        const box = featureBox(f, size)
        return box.min[ai]! > lo + 1e-6 && box.max[ai]! < hi - 1e-6
      })
      if (!inner) continue
    }
    if (isMirrorSymmetric(mesh, ai, c)) planes.push({ axis, at: c })
  }
  return planes
}

/** Osy souměrnosti v pohledu: rovina kolmá na pohled se promítne do čerchované čáry přes celý pohled. */
function symmetryLines(
  planes: readonly SymmetryPlane[],
  view: ViewName,
  bounds: ViewProjection['bounds'],
): CenterLine[] {
  const basis = viewBasis(view)
  const o = CENTER_LINE_OVERHANG_MM
  const lines: CenterLine[] = []
  for (const plane of planes) {
    const ai = AXIS_INDEX[plane.axis]
    if (Math.abs(basis.dir[ai]) > 0.5) continue // rovina rovnoběžná s nákresnou se nepromítne do čáry
    const featureId = `symmetry:${plane.axis}`
    if (Math.abs(basis.right[ai]) > 0.5) {
      const u = plane.at * basis.right[ai] + 0
      lines.push({ a: [u, bounds.min[1] - o], b: [u, bounds.max[1] + o], featureId })
    } else {
      const v = plane.at * basis.up[ai] + 0
      lines.push({ a: [bounds.min[0] - o, v], b: [bounds.max[0] + o, v], featureId })
    }
  }
  return lines
}

/** Leží osa `inner` celá na ose `outer`? (Osa díry splývající s osou souměrnosti se nekreslí dvakrát.) */
function containedIn(inner: CenterLine, outer: CenterLine): boolean {
  const EPS = 1e-6
  const dx = outer.b[0] - outer.a[0]
  const dy = outer.b[1] - outer.a[1]
  const len = Math.hypot(dx, dy)
  const onLine = (p: Vec2) => {
    const cross = (p[0] - outer.a[0]) * dy - (p[1] - outer.a[1]) * dx
    const t = ((p[0] - outer.a[0]) * dx + (p[1] - outer.a[1]) * dy) / (len * len)
    return Math.abs(cross / len) < EPS && t > -EPS && t < 1 + EPS
  }
  return onLine(inner.a) && onLine(inner.b)
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
  const planes = symmetryPlanes(spec, mesh)

  const parts = viewNames.map((view) => {
    const projection = projectView(mesh, edges, view)
    const holes = holeAnnotations(spec, view)
    const symmetry = symmetryLines(planes, view, projection.bounds)
    const centerLines = [
      ...symmetry,
      ...holes.centerLines.filter((cl) => !symmetry.some((s) => containedIn(cl, s))),
    ]
    const circles = holes.circles
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
