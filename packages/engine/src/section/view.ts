import {
  arrowheadWidth,
  CUTTING_PLANE_ARROW_LENGTH_MM,
  CUTTING_PLANE_END_LENGTH_MM,
  CUTTING_PLANE_OVERHANG_MM,
  drillPointHeight,
  HATCH_PHASE,
  HATCH_SPACING_MM,
  isValidSectionLetter,
  SECTION_HATCH_ANGLE_DEG,
  SECTION_LETTER_HEIGHT_MM,
  SECTION_LETTER_OFFSET_MM,
  SECTION_SHOWS_HIDDEN_EDGES,
  SECTION_TITLE_GAP_MM,
  SECTION_TITLE_HEIGHT_MM,
  sectionTitle,
  VIEWS,
  type Vec3,
  type ViewName,
} from '@vykresovna/drafting-standards'
import type { Drawing, DrawingView } from '../drawing/drawing'
import { extractEdges } from '../edges/extract'
import type { SolidMesh } from '../mesh/types'
import { AXIS_INDEX, otherAxes, type Axis, type PartSpec } from '../part/spec'
import { projectView, viewBasis, type Vec2, type ViewProjection } from '../projection/hlr'
import { cutSolidWithCap, type CutPlane } from './cut'
import { hatchLines } from './hatch'
import { groupRings } from './triangulate'
import type {
  CuttingPlaneMark,
  SectionDrawingOptions,
  SectionFace,
  SectionSpec,
  SectionViewData,
} from './types'

/**
 * Odhad šířky velkého písmene jako násobek jeho výšky (bezpatkové písmo). Slouží jen k rozvržení,
 * aby se písmena vešla na výkres; není to pravidlo normy.
 */
export const LETTER_WIDTH_FACTOR = 0.9
/** Výška velkého písmene jako podíl velikosti písma (em) u běžných bezpatkových písem. */
export const CAP_HEIGHT_EM = 0.72

const ROUND = 1e4
const round = (x: number) => Math.round(x * ROUND) / ROUND + 0
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Pořadí, ve kterém se hledá pohled pro stopu roviny řezu (nárys, pak půdorys, …). */
const MARK_VIEW_PREFERENCE: readonly ViewName[] = [
  'front',
  'top',
  'left',
  'right',
  'bottom',
  'rear',
]

/**
 * Pohled, který řez kolmý na danou osu běžně nahrazuje: rovina kolmá na Y → nárys, na X → bokorys
 * zleva, na Z → půdorys (díváme se shora, odebere se horní část).
 */
export const DEFAULT_SECTION_VIEW: Readonly<Record<Axis, ViewName>> = {
  x: 'left',
  y: 'front',
  z: 'top',
}

export class InvalidSectionError extends Error {}

/** Strana, kterou se díváme: u pohledu ve směru +osa stojí pozorovatel na straně min. */
export function viewFromOf(view: ViewName, spec: Pick<SectionSpec, 'axis'>): 'min' | 'max' {
  return VIEWS[view].viewDirection[AXIS_INDEX[spec.axis]] > 0 ? 'min' : 'max'
}

/** Rovina řezu ve smyslu `cutSolid`: zůstává strana odvrácená od pozorovatele. */
export function cutPlaneOf(spec: SectionSpec, view?: ViewName): CutPlane {
  const from = spec.viewFrom ?? (view ? viewFromOf(view, spec) : 'min')
  return { axis: spec.axis, at: spec.at, keep: from === 'min' ? 'max' : 'min' }
}

/** Obdélník průmětu celé součásti (stejně zaokrouhlený jako v `projectView`). */
function fullBounds(mesh: SolidMesh, view: ViewName): ViewProjection['bounds'] {
  const basis = viewBasis(view)
  let minU = Infinity
  let minV = Infinity
  let maxU = -Infinity
  let maxV = -Infinity
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const p: Vec3 = [mesh.positions[i]!, mesh.positions[i + 1]!, mesh.positions[i + 2]!]
    const u = dot(p, basis.right)
    const v = dot(p, basis.up)
    minU = Math.min(minU, u)
    maxU = Math.max(maxU, u)
    minV = Math.min(minV, v)
    maxV = Math.max(maxV, v)
  }
  return { min: [round(minU), round(minV)], max: [round(maxU), round(maxV)] }
}

/** Rozsah prvku (díry) podél osy řezu; null = prvek nemá osu (nekreslí se pro něj nic). */
function featureExtent(spec: PartSpec, featureId: string, ai: number): [number, number] | null {
  const f = spec.features.find((x) => x.id === featureId)
  if (!f || f.kind !== 'hole') return null
  const size = spec.base.size
  const hi = AXIS_INDEX[f.axis]
  if (hi === ai) {
    if (f.depth === undefined) return [0, size[ai]]
    const reach = f.depth + drillPointHeight(f.diameter)
    return f.from === 'max' ? [size[ai] - reach, size[ai]] : [0, reach]
  }
  const [a, b] = otherAxes(f.axis)
  const c = AXIS_INDEX[a] === ai ? f.at[0] : AXIS_INDEX[b] === ai ? f.at[1] : 0
  const r = f.diameter / 2
  return [c - r, c + r]
}

/** Připravený řez pro `createDrawing`. */
export type PreparedSection = {
  readonly view: ViewName
  /** Pohled se stopou roviny řezu (null = bez stopy). */
  readonly markView: ViewName | null
  /** Průmět zbytku součásti: jen viditelné hrany, obdélník jako u celé součásti (kvůli zarovnání). */
  readonly projection: ViewProjection
  readonly data: SectionViewData
  /** Patří osa prvku do pohledu v řezu (prvek nebyl celý odebrán)? */
  readonly keepsFeature: (featureId: string) => boolean
  /** Stopa roviny řezu pro pohled s daným obdélníkem průmětu. */
  readonly mark: (bounds: ViewProjection['bounds']) => CuttingPlaneMark
}

export function prepareSection(
  spec: PartSpec,
  mesh: SolidMesh,
  options: SectionDrawingOptions,
  views: readonly ViewName[],
): PreparedSection {
  const s = options.spec
  const ai = AXIS_INDEX[s.axis]
  const view = options.view
  if (!isValidSectionLetter(s.label)) {
    throw new InvalidSectionError(`Neplatné písmeno řezu „${s.label}“`)
  }
  if (!views.includes(view)) {
    throw new InvalidSectionError(`Pohled ${view} není ve výkresu`)
  }
  const dir = VIEWS[view].viewDirection
  if (Math.abs(dir[ai]) < 0.5) {
    throw new InvalidSectionError(`Pohled ${view} se nedívá ve směru osy ${s.axis}`)
  }
  if (s.viewFrom && s.viewFrom !== viewFromOf(view, s)) {
    throw new InvalidSectionError(`Pohled ${view} se dívá z druhé strany než řez ${s.label}`)
  }
  const lo = mesh.bbox.min[ai]
  const hi = mesh.bbox.max[ai]
  if (!(s.at > lo && s.at < hi)) {
    throw new InvalidSectionError(`Rovina řezu ${s.axis} = ${s.at} neprotíná součást`)
  }

  let markView: ViewName | null = null
  if (options.cuttingPlaneView !== null) {
    const edgeOn = (v: ViewName) => v !== view && Math.abs(VIEWS[v].viewDirection[ai]) < 0.5
    if (options.cuttingPlaneView !== undefined) {
      if (!views.includes(options.cuttingPlaneView) || !edgeOn(options.cuttingPlaneView)) {
        throw new InvalidSectionError(
          `Stopu řezu nelze kreslit v pohledu ${options.cuttingPlaneView}`,
        )
      }
      markView = options.cuttingPlaneView
    } else {
      markView = MARK_VIEW_PREFERENCE.find((v) => views.includes(v) && edgeOn(v)) ?? null
    }
  }

  const plane = cutPlaneOf(s, view)
  const cut = cutSolidWithCap(mesh, plane, `section:${s.label}`)
  const raw = projectView(cut.solid, extractEdges(cut.solid), view)
  const projection: ViewProjection = {
    view,
    segments: SECTION_SHOWS_HIDDEN_EDGES
      ? raw.segments
      : raw.segments.filter((seg) => seg.visibility === 'visible'),
    bounds: fullBounds(mesh, view),
  }

  // obrysy plochy řezu v souřadnicích pohledu; normála plochy míří k pozorovateli, a protože
  // doprava × nahoru = −směr pohledu, jsou vnější obrysy proti směru hodinových ručiček
  const basis = viewBasis(view)
  const loops2 = cut.loops.map((loop) =>
    loop.map((p): Vec2 => [round(dot(p, basis.right)), round(dot(p, basis.up))]),
  )
  const faces: SectionFace[] = groupRings(
    loops2.map((l) => l.map((p) => ({ x: p[0], y: p[1], p }))),
  ).map((g) => ({ outer: g.outer.map((q) => q.p), holes: g.holes.map((h) => h.map((q) => q.p)) }))
  const hatching = hatchLines(loops2, SECTION_HATCH_ANGLE_DEG, HATCH_SPACING_MM, HATCH_PHASE)

  const keepsFeature = (featureId: string) => {
    const ext = featureExtent(spec, featureId, ai)
    if (!ext) return true
    return plane.keep === 'max' ? ext[1] > cut.at + 1e-6 : ext[0] < cut.at - 1e-6
  }

  const sectionDir = dir
  const mark = (bounds: ViewProjection['bounds']): CuttingPlaneMark =>
    cuttingPlaneMark(markView!, s, sectionDir, bounds)

  return {
    view,
    markView,
    projection,
    data: { label: s.label, title: sectionTitle(s.label), spec: s, faces, hatching },
    keepsFeature,
    mark,
  }
}

/** Stopa roviny řezu v pohledu `view`, kde rovina leží „na hraně“. */
function cuttingPlaneMark(
  view: ViewName,
  s: SectionSpec,
  sectionDir: Vec3,
  bounds: ViewProjection['bounds'],
): CuttingPlaneMark {
  const ai = AXIS_INDEX[s.axis]
  const basis = viewBasis(view)
  const o = CUTTING_PLANE_OVERHANG_MM
  const L = CUTTING_PLANE_END_LENGTH_MM
  const vertical = Math.abs(basis.right[ai]) > 0.5
  let a: Vec2
  let b: Vec2
  let outA: Vec2
  let outB: Vec2
  if (vertical) {
    const u = round(s.at * basis.right[ai]!)
    a = [u, round(bounds.min[1] - o)]
    b = [u, round(bounds.max[1] + o)]
    outA = [0, -1]
    outB = [0, 1]
  } else {
    const v = round(s.at * basis.up[ai]!)
    a = [round(bounds.min[0] - o), v]
    b = [round(bounds.max[0] + o), v]
    outA = [-1, 0]
    outB = [1, 0]
  }
  const add = (p: Vec2, d: Vec2, k: number): Vec2 => [
    round(p[0] + d[0] * k),
    round(p[1] + d[1] * k),
  ]
  const arrowDir: Vec2 = [dot(sectionDir, basis.right) + 0, dot(sectionDir, basis.up) + 0]
  const h = SECTION_LETTER_HEIGHT_MM
  const letterHalf = (out: Vec2) => (out[0] !== 0 ? (LETTER_WIDTH_FACTOR * h) / 2 : h / 2)
  const letter = (p: Vec2, out: Vec2): Vec2 =>
    add(
      add(p, out, SECTION_LETTER_OFFSET_MM + letterHalf(out)),
      arrowDir,
      CUTTING_PLANE_ARROW_LENGTH_MM / 2,
    )
  return {
    label: s.label,
    line: { a, b },
    ends: [
      { a, b: add(a, outA, -L) },
      { a: b, b: add(b, outB, -L) },
    ],
    arrows: [
      { tail: a, tip: add(a, arrowDir, CUTTING_PLANE_ARROW_LENGTH_MM) },
      { tail: b, tip: add(b, arrowDir, CUTTING_PLANE_ARROW_LENGTH_MM) },
    ],
    letters: [letter(a, outA), letter(b, outB)],
  }
}

/** Převod souřadnic pohledu (u doprava, v nahoru) na souřadnice výkresu (SVG, y dolů). */
export function viewToSheet(v: DrawingView): (p: Vec2) => Vec2 {
  const { min, max } = v.projection.bounds
  return (p) => [v.origin[0] + (p[0] - min[0]), v.origin[1] + (max[1] - p[1])]
}

/** Obdélníky popisů řezu (nápis A–A, stopa, šipky, písmena) v souřadnicích výkresu. */
export function sectionAnnotationBoxes(v: DrawingView): { min: Vec2; max: Vec2 }[] {
  const boxes: { min: Vec2; max: Vec2 }[] = []
  const tx = viewToSheet(v)
  if (v.section) {
    const w = LETTER_WIDTH_FACTOR * SECTION_TITLE_HEIGHT_MM * v.section.title.length
    const cx = v.origin[0] + v.size[0] / 2
    const base = v.origin[1] - SECTION_TITLE_GAP_MM
    boxes.push({ min: [cx - w / 2, base - SECTION_TITLE_HEIGHT_MM], max: [cx + w / 2, base] })
  }
  const head = arrowheadWidth() / 2
  const lw = (LETTER_WIDTH_FACTOR * SECTION_LETTER_HEIGHT_MM) / 2
  const lh = SECTION_LETTER_HEIGHT_MM / 2
  for (const m of v.cuttingPlanes ?? []) {
    const pts: Vec2[] = [m.line.a, m.line.b, ...m.arrows.flatMap((ar) => [ar.tail, ar.tip])]
    for (const p of pts.map(tx)) {
      boxes.push({ min: [p[0] - head, p[1] - head], max: [p[0] + head, p[1] + head] })
    }
    for (const c of m.letters.map(tx)) {
      boxes.push({ min: [c[0] - lw, c[1] - lh], max: [c[0] + lw, c[1] + lh] })
    }
  }
  return boxes
}

/**
 * Zvětší výkres a posune pohledy tak, aby se popisy řezu vešly dovnitř s okrajem `margin`.
 * Pohledy se posouvají všechny stejně, takže zůstanou navzájem zarovnané.
 */
export function fitSectionAnnotations(drawing: Drawing, margin: number): Drawing {
  let minX = margin
  let minY = margin
  let maxX = drawing.width - margin
  let maxY = drawing.height - margin
  for (const v of drawing.views) {
    for (const box of sectionAnnotationBoxes(v)) {
      minX = Math.min(minX, box.min[0])
      minY = Math.min(minY, box.min[1])
      maxX = Math.max(maxX, box.max[0])
      maxY = Math.max(maxY, box.max[1])
    }
  }
  const dx = round(margin - minX)
  const dy = round(margin - minY)
  if (dx === 0 && dy === 0 && maxX <= drawing.width - margin && maxY <= drawing.height - margin) {
    return drawing
  }
  return {
    ...drawing,
    views: drawing.views.map((v) => ({ ...v, origin: [v.origin[0] + dx, v.origin[1] + dy] })),
    width: round(Math.ceil((maxX + dx + margin) * 100) / 100),
    height: round(Math.ceil((maxY + dy + margin) * 100) / 100),
  }
}
