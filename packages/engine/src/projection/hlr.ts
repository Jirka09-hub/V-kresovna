import { cross, VIEWS, type Vec3, type ViewName } from '@vykresovna/drafting-standards'
import type { EdgeModel } from '../edges/extract'
import type { SolidMesh } from '../mesh/types'

/**
 * Výpočet viditelnosti hran pro pravoúhlý pohled (přístup B z docs/plan.md, kapitola 4).
 *
 * 1. Hrany (ostré hrany + obrysové hrany válců pro daný pohled) se promítnou do roviny pohledu.
 * 2. Každá hrana se rozdělí v místech, kde ji v průmětu kříží nebo se jí dotýká jiná hrana.
 *    Jen tam se může viditelnost změnit.
 * 3. Pro střed každého úseku se zjistí, zda ho z pohledu pozorovatele zakrývá některý trojúhelník
 *    natočený k pozorovateli (2D test bodu v trojúhelníku + porovnání hloubky).
 * 4. Úseky na stejné přímce se sloučí; když se kryje viditelný a skrytý úsek, platí viditelný.
 */

export type Vec2 = readonly [number, number]

export type EdgeVisibility = 'visible' | 'hidden'

export type ViewSegment = {
  readonly a: Vec2
  readonly b: Vec2
  readonly visibility: EdgeVisibility
  /** Logické hrany (nebo obrysy ploch `sil:<plocha>`), ze kterých úsek vznikl. */
  readonly edgeIds: readonly string[]
}

export type ViewProjection = {
  readonly view: ViewName
  readonly segments: readonly ViewSegment[]
  /** Obdélník průmětu tělesa v souřadnicích pohledu (u doprava, v nahoru). */
  readonly bounds: { readonly min: Vec2; readonly max: Vec2 }
}

/** Souřadnice pohledu: u = doprava v obrázku, v = nahoru v obrázku, w = hloubka (menší = blíž). */
export type ViewBasis = { readonly right: Vec3; readonly up: Vec3; readonly dir: Vec3 }

export function viewBasis(view: ViewName): ViewBasis {
  const { viewDirection, up } = VIEWS[view]
  return { right: cross(viewDirection, up), up, dir: viewDirection }
}

const EPS = 1e-7
/** Úsek je zakrytý, když je trojúhelník blíž k pozorovateli alespoň o tuto vzdálenost (mm). */
const DEPTH_EPS = 1e-5
/** Zaokrouhlení výsledných souřadnic (mm), aby byl výstup stabilní. */
const ROUND = 1e4

type RawSegment = {
  a2: Vec2
  b2: Vec2
  aw: number
  bw: number
  edgeId: string
}

export function projectView(mesh: SolidMesh, edges: EdgeModel, view: ViewName): ViewProjection {
  const basis = viewBasis(view)
  const n = mesh.positions.length / 3
  const pu = new Float64Array(n)
  const pv = new Float64Array(n)
  const pw = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const x = mesh.positions[i * 3]!
    const y = mesh.positions[i * 3 + 1]!
    const z = mesh.positions[i * 3 + 2]!
    pu[i] = x * basis.right[0] + y * basis.right[1] + z * basis.right[2]
    pv[i] = x * basis.up[0] + y * basis.up[1] + z * basis.up[2]
    pw[i] = x * basis.dir[0] + y * basis.dir[1] + z * basis.dir[2]
  }

  const raw: RawSegment[] = []
  const pushSeg = (p: number, q: number, edgeId: string) => {
    const du = pu[q]! - pu[p]!
    const dv = pv[q]! - pv[p]!
    if (Math.hypot(du, dv) < 1e-6) return // hrana rovnoběžná se směrem pohledu se promítne do bodu
    raw.push({ a2: [pu[p]!, pv[p]!], b2: [pu[q]!, pv[q]!], aw: pw[p]!, bw: pw[q]!, edgeId })
  }

  for (const e of edges.logicalEdges) {
    const vs = e.vertices
    for (let i = 0; i + 1 < vs.length; i++) pushSeg(vs[i]!, vs[i + 1]!, e.id)
    if (e.closed && vs.length > 2) pushSeg(vs[vs.length - 1]!, vs[0]!, e.id)
  }

  // obrysové hrany (silueta) zakřivených ploch: mezi trojúhelníkem natočeným k pozorovateli a odvráceným
  const facing = (t: number) =>
    mesh.triNormals[t * 3]! * basis.dir[0] +
    mesh.triNormals[t * 3 + 1]! * basis.dir[1] +
    mesh.triNormals[t * 3 + 2]! * basis.dir[2]
  for (const e of edges.meshEdges) {
    if (e.sharp) continue
    const f0 = facing(e.t0)
    const f1 = facing(e.t1)
    if ((f0 < -EPS && f1 > EPS) || (f0 > EPS && f1 < -EPS)) {
      const surf = mesh.surfaces[mesh.triSurface[e.t0]!]!
      pushSeg(e.a, e.b, `sil:${surf.key}`)
    }
  }

  const occluder = buildOccluderGrid(mesh, pu, pv, pw, facing)
  const classified: { a: Vec2; b: Vec2; visibility: EdgeVisibility; edgeId: string }[] = []

  for (let i = 0; i < raw.length; i++) {
    const s = raw[i]!
    const ts = splitParams(s, raw, i)
    for (let k = 0; k + 1 < ts.length; k++) {
      const t0 = ts[k]!
      const t1 = ts[k + 1]!
      if (t1 - t0 < 1e-9) continue
      const tm = (t0 + t1) / 2
      const mu = s.a2[0] + (s.b2[0] - s.a2[0]) * tm
      const mv = s.a2[1] + (s.b2[1] - s.a2[1]) * tm
      const mw = s.aw + (s.bw - s.aw) * tm
      const hidden = occluder(mu, mv, mw)
      classified.push({
        a: lerp2(s.a2, s.b2, t0),
        b: lerp2(s.a2, s.b2, t1),
        visibility: hidden ? 'hidden' : 'visible',
        edgeId: s.edgeId,
      })
    }
  }

  const segments = mergeCollinear(classified)
  let minU = Infinity
  let minV = Infinity
  let maxU = -Infinity
  let maxV = -Infinity
  for (let i = 0; i < n; i++) {
    minU = Math.min(minU, pu[i]!)
    maxU = Math.max(maxU, pu[i]!)
    minV = Math.min(minV, pv[i]!)
    maxV = Math.max(maxV, pv[i]!)
  }
  return {
    view,
    segments,
    bounds: { min: [round(minU), round(minV)], max: [round(maxU), round(maxV)] },
  }
}

const round = (x: number) => Math.round(x * ROUND) / ROUND + 0
const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
]

/** Parametry t ∈ [0, 1], ve kterých jiné úseky kříží nebo se dotýkají úseku s. */
function splitParams(s: RawSegment, all: readonly RawSegment[], self: number): number[] {
  const ts = [0, 1]
  const ax = s.a2[0]
  const ay = s.a2[1]
  const dx = s.b2[0] - ax
  const dy = s.b2[1] - ay
  const len2 = dx * dx + dy * dy
  const len = Math.sqrt(len2)
  const minX = Math.min(ax, s.b2[0]) - 1e-6
  const maxX = Math.max(ax, s.b2[0]) + 1e-6
  const minY = Math.min(ay, s.b2[1]) - 1e-6
  const maxY = Math.max(ay, s.b2[1]) + 1e-6
  const tol = 1e-6 // mm

  for (let j = 0; j < all.length; j++) {
    if (j === self) continue
    const o = all[j]!
    if (
      Math.max(o.a2[0], o.b2[0]) < minX ||
      Math.min(o.a2[0], o.b2[0]) > maxX ||
      Math.max(o.a2[1], o.b2[1]) < minY ||
      Math.min(o.a2[1], o.b2[1]) > maxY
    ) {
      continue
    }
    const ex = o.b2[0] - o.a2[0]
    const ey = o.b2[1] - o.a2[1]
    const denom = dx * ey - dy * ex
    const elen = Math.hypot(ex, ey)
    if (Math.abs(denom) > 1e-9 * len * elen) {
      // obecná poloha: průsečík přímek
      const qx = o.a2[0] - ax
      const qy = o.a2[1] - ay
      const t = (qx * ey - qy * ex) / denom
      const u = (qx * dy - qy * dx) / denom
      const tTol = tol / len
      const uTol = tol / elen
      if (t > -tTol && t < 1 + tTol && u > -uTol && u < 1 + uTol) {
        ts.push(Math.min(1, Math.max(0, t)))
      }
    } else {
      // rovnoběžné: pokud leží na stejné přímce, rozdělit v koncových bodech druhého úseku
      for (const p of [o.a2, o.b2]) {
        const px = p[0] - ax
        const py = p[1] - ay
        const distLine = Math.abs(px * dy - py * dx) / len
        if (distLine > tol) continue
        const t = (px * dx + py * dy) / len2
        if (t > 0 && t < 1) ts.push(t)
      }
    }
  }
  ts.sort((x, y) => x - y)
  const out: number[] = []
  for (const t of ts) {
    if (out.length === 0 || t - out[out.length - 1]! > 1e-9) out.push(t)
  }
  return out
}

/** Mřížka trojúhelníků natočených k pozorovateli pro rychlý test zakrytí bodu. */
function buildOccluderGrid(
  mesh: SolidMesh,
  pu: Float64Array,
  pv: Float64Array,
  pw: Float64Array,
  facing: (t: number) => number,
): (u: number, v: number, w: number) => boolean {
  const triCount = mesh.triangles.length / 3
  const tris: number[] = []
  let minU = Infinity
  let minV = Infinity
  let maxU = -Infinity
  let maxV = -Infinity
  for (let t = 0; t < triCount; t++) {
    if (facing(t) >= -1e-9) continue // jen trojúhelníky natočené k pozorovateli
    const i0 = mesh.triangles[t * 3]!
    const i1 = mesh.triangles[t * 3 + 1]!
    const i2 = mesh.triangles[t * 3 + 2]!
    const area =
      (pu[i1]! - pu[i0]!) * (pv[i2]! - pv[i0]!) - (pu[i2]! - pu[i0]!) * (pv[i1]! - pv[i0]!)
    if (Math.abs(area) < 1e-10) continue
    tris.push(t)
    for (const i of [i0, i1, i2]) {
      minU = Math.min(minU, pu[i]!)
      maxU = Math.max(maxU, pu[i]!)
      minV = Math.min(minV, pv[i]!)
      maxV = Math.max(maxV, pv[i]!)
    }
  }
  const G = 48
  const cw = (maxU - minU) / G || 1
  const ch = (maxV - minV) / G || 1
  const cells: number[][] = Array.from({ length: G * G }, () => [])
  const cell = (x: number, y: number) =>
    Math.min(G - 1, Math.max(0, Math.floor(x))) + Math.min(G - 1, Math.max(0, Math.floor(y))) * G
  for (const t of tris) {
    const ids = [mesh.triangles[t * 3]!, mesh.triangles[t * 3 + 1]!, mesh.triangles[t * 3 + 2]!]
    const x0 = Math.floor((Math.min(...ids.map((i) => pu[i]!)) - minU) / cw - 1e-6)
    const x1 = Math.floor((Math.max(...ids.map((i) => pu[i]!)) - minU) / cw + 1e-6)
    const y0 = Math.floor((Math.min(...ids.map((i) => pv[i]!)) - minV) / ch - 1e-6)
    const y1 = Math.floor((Math.max(...ids.map((i) => pv[i]!)) - minV) / ch + 1e-6)
    for (let y = Math.max(0, y0); y <= Math.min(G - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(G - 1, x1); x++) cells[x + y * G]!.push(t)
    }
  }

  return (u, v, w) => {
    if (u < minU - 1e-6 || u > maxU + 1e-6 || v < minV - 1e-6 || v > maxV + 1e-6) return false
    const list = cells[cell((u - minU) / cw, (v - minV) / ch)]!
    for (const t of list) {
      const i0 = mesh.triangles[t * 3]!
      const i1 = mesh.triangles[t * 3 + 1]!
      const i2 = mesh.triangles[t * 3 + 2]!
      const x0 = pu[i0]!
      const y0 = pv[i0]!
      const x1 = pu[i1]!
      const y1 = pv[i1]!
      const x2 = pu[i2]!
      const y2 = pv[i2]!
      const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
      const l0 = ((y1 - y2) * (u - x2) + (x2 - x1) * (v - y2)) / d
      const l1 = ((y2 - y0) * (u - x2) + (x0 - x2) * (v - y2)) / d
      const l2 = 1 - l0 - l1
      const tol = -1e-9
      if (l0 < tol || l1 < tol || l2 < tol) continue
      const depth = l0 * pw[i0]! + l1 * pw[i1]! + l2 * pw[i2]!
      if (depth < w - DEPTH_EPS) return true
    }
    return false
  }
}

/**
 * Sloučí úseky ležící na stejné přímce: viditelné mají přednost před skrytými,
 * navazující úseky stejného druhu se spojí do jednoho.
 */
function mergeCollinear(
  segs: readonly { a: Vec2; b: Vec2; visibility: EdgeVisibility; edgeId: string }[],
): ViewSegment[] {
  type Interval = { s0: number; s1: number; visibility: EdgeVisibility; edgeId: string }
  const lines = new Map<string, { dir: Vec2; origin: Vec2; intervals: Interval[] }>()
  for (const seg of segs) {
    let dx = seg.b[0] - seg.a[0]
    let dy = seg.b[1] - seg.a[1]
    const len = Math.hypot(dx, dy)
    dx /= len
    dy /= len
    // kanonický směr (úhel v [0, π))
    if (dy < -1e-12 || (Math.abs(dy) <= 1e-12 && dx < 0)) {
      dx = -dx
      dy = -dy
    }
    const offset = seg.a[0] * dy - seg.a[1] * dx
    const key = `${Math.round(dx * 1e6)},${Math.round(dy * 1e6)},${Math.round(offset * 1e4)}`
    let line = lines.get(key)
    if (!line) {
      line = { dir: [dx, dy], origin: [offset * dy, -offset * dx], intervals: [] }
      lines.set(key, line)
    }
    const pa = (seg.a[0] - line.origin[0]) * line.dir[0] + (seg.a[1] - line.origin[1]) * line.dir[1]
    const pb = (seg.b[0] - line.origin[0]) * line.dir[0] + (seg.b[1] - line.origin[1]) * line.dir[1]
    line.intervals.push({
      s0: Math.min(pa, pb),
      s1: Math.max(pa, pb),
      visibility: seg.visibility,
      edgeId: seg.edgeId,
    })
  }

  const out: ViewSegment[] = []
  const keys = [...lines.keys()].sort()
  for (const key of keys) {
    const line = lines.get(key)!
    // body zlomu na přímce
    const cuts = [
      ...new Set(
        line.intervals.flatMap((iv) => [iv.s0, iv.s1].map((s) => Math.round(s * 1e6) / 1e6)),
      ),
    ].sort((x, y) => x - y)
    type Piece = { s0: number; s1: number; visibility: EdgeVisibility; ids: Set<string> }
    const pieces: Piece[] = []
    for (let k = 0; k + 1 < cuts.length; k++) {
      const s0 = cuts[k]!
      const s1 = cuts[k + 1]!
      const mid = (s0 + s1) / 2
      const covering = line.intervals.filter((iv) => iv.s0 < mid && iv.s1 > mid)
      if (covering.length === 0) continue
      const visible = covering.filter((iv) => iv.visibility === 'visible')
      const chosen = visible.length > 0 ? visible : covering
      const piece: Piece = {
        s0,
        s1,
        visibility: visible.length > 0 ? 'visible' : 'hidden',
        ids: new Set(chosen.map((iv) => iv.edgeId)),
      }
      const last = pieces[pieces.length - 1]
      if (last && last.visibility === piece.visibility && Math.abs(last.s1 - s0) < 1e-6) {
        last.s1 = s1
        for (const id of piece.ids) last.ids.add(id)
      } else {
        pieces.push(piece)
      }
    }
    for (const p of pieces) {
      const at = (s: number): Vec2 => [
        round(line.origin[0] + line.dir[0] * s),
        round(line.origin[1] + line.dir[1] * s),
      ]
      out.push({ a: at(p.s0), b: at(p.s1), visibility: p.visibility, edgeIds: [...p.ids].sort() })
    }
  }
  return out
}
