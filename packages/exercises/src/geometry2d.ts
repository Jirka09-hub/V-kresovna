/**
 * Rovinná geometrie úseků v souřadnicích pohledu (mm): kolinearita, překryv, vzdálenost bodu od úseku,
 * průnik úseku s obdélníkem. Pomocníci pro mutace výkresu a hodnocení „najdi chybu“.
 */
import type { Vec2 } from '@vykresovna/engine'
import type { Area2, LineSegment2 } from './types'

/** Tolerance pro „leží na stejné přímce“ (mm). */
export const COLLINEAR_EPS_MM = 1e-3

export const segmentLength = (s: LineSegment2) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])

/** Vzdálenost bodu od přímky dané úsekem (nekonečné). */
function lineDistance(p: Vec2, s: LineSegment2): number {
  const dx = s.b[0] - s.a[0]
  const dy = s.b[1] - s.a[1]
  const len = Math.hypot(dx, dy)
  if (len < 1e-12) return Math.hypot(p[0] - s.a[0], p[1] - s.a[1])
  return Math.abs((p[0] - s.a[0]) * dy - (p[1] - s.a[1]) * dx) / len
}

/** Leží úsek `s` na přímce úseku `line`? */
export function collinear(s: LineSegment2, line: LineSegment2, eps = COLLINEAR_EPS_MM): boolean {
  return lineDistance(s.a, line) < eps && lineDistance(s.b, line) < eps
}

/** Parametr bodu podél směru úseku `line` (mm od bodu a). */
function along(p: Vec2, line: LineSegment2): number {
  const dx = line.b[0] - line.a[0]
  const dy = line.b[1] - line.a[1]
  const len = Math.hypot(dx, dy)
  return ((p[0] - line.a[0]) * dx + (p[1] - line.a[1]) * dy) / len
}

/** Délka překryvu dvou úseků na stejné přímce (0, když nejsou kolineární). */
export function collinearOverlap(s: LineSegment2, t: LineSegment2): number {
  if (!collinear(t, s)) return 0
  const s0 = 0
  const s1 = segmentLength(s)
  const ta = along(t.a, s)
  const tb = along(t.b, s)
  return Math.max(0, Math.min(s1, Math.max(ta, tb)) - Math.max(s0, Math.min(ta, tb)))
}

/** Je úsek `s` celý zakrytý sjednocením kolineárních úseků `others`? */
export function coveredBy(s: LineSegment2, others: readonly LineSegment2[]): boolean {
  const len = segmentLength(s)
  const intervals = others
    .filter((t) => collinear(t, s))
    .map((t) => {
      const ta = along(t.a, s)
      const tb = along(t.b, s)
      return [Math.min(ta, tb), Math.max(ta, tb)] as const
    })
    .sort((x, y) => x[0] - y[0])
  let reach = 0
  for (const [lo, hi] of intervals) {
    if (lo > reach + COLLINEAR_EPS_MM) break
    reach = Math.max(reach, hi)
    if (reach >= len - COLLINEAR_EPS_MM) return true
  }
  return reach >= len - COLLINEAR_EPS_MM
}

/** Nejmenší vzdálenost bodu od úseku. */
export function pointSegmentDistance(p: Vec2, s: LineSegment2): number {
  const dx = s.b[0] - s.a[0]
  const dy = s.b[1] - s.a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 < 1e-12 ? 0 : ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / len2
  const c = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (s.a[0] + c * dx), p[1] - (s.a[1] + c * dy))
}

/** Protíná (nebo se dotýká) úsek obdélníku? (Liang–Barsky ořezání.) */
export function segmentIntersectsArea(s: LineSegment2, area: Area2): boolean {
  let t0 = 0
  let t1 = 1
  const d = [s.b[0] - s.a[0], s.b[1] - s.a[1]] as const
  for (let axis = 0; axis < 2; axis++) {
    const p0 = s.a[axis]!
    const dd = d[axis]!
    const lo = area.min[axis]!
    const hi = area.max[axis]!
    if (Math.abs(dd) < 1e-12) {
      if (p0 < lo - 1e-9 || p0 > hi + 1e-9) return false
      continue
    }
    let ta = (lo - p0) / dd
    let tb = (hi - p0) / dd
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta)
    t1 = Math.min(t1, tb)
    if (t0 > t1 + 1e-12) return false
  }
  return true
}

/** Střed úseku. */
export const midpoint = (s: LineSegment2): Vec2 => [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2]
