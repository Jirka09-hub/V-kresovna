import type { Vec3 } from '@vykresovna/drafting-standards'
import { AXIS_INDEX, type Axis, type PartSpec } from '../part/spec'
import type { ViewBasis, Vec2 } from '../projection/hlr'
import type { Segment2 } from './types'

/**
 * Žebro řezané podélně (rovina řezu jde po jeho délce, rovnoběžně s velkými stěnami) se podle
 * zvyklosti nešrafuje, jen se ohraničí: šrafy by vyvolaly dojem plného masivního tělesa.
 */

export type Rect2 = { readonly id: string; readonly min: Vec2; readonly max: Vec2 }

const ROUND = 1e4
const round = (x: number) => Math.round(x * ROUND) / ROUND + 0

/** Obdélníky žeber, která rovina řeže podélně (v souřadnicích pohledu). */
export function lengthwiseRibRects(
  spec: PartSpec,
  axis: Axis,
  at: number,
  basis: ViewBasis,
): Rect2[] {
  const ai = AXIS_INDEX[axis]
  const rects: Rect2[] = []
  for (const f of spec.features) {
    if (f.kind !== 'rib') continue
    const size = [0, 1, 2].map((k) => f.box.max[k]! - f.box.min[k]!)
    const thinnest = size.every((d, k) => k === ai || d > size[ai]!)
    if (!thinnest || !(f.box.min[ai] < at && at < f.box.max[ai])) continue
    const corners: Vec3[] = [f.box.min, f.box.max].map((c): Vec3 => {
      const p: [number, number, number] = [c[0], c[1], c[2]]
      p[ai] = at
      return p
    })
    const uv = corners.map((p): Vec2 => [
      p[0] * basis.right[0] + p[1] * basis.right[1] + p[2] * basis.right[2],
      p[0] * basis.up[0] + p[1] * basis.up[1] + p[2] * basis.up[2],
    ])
    rects.push({
      id: f.id,
      min: [round(Math.min(uv[0]![0], uv[1]![0])), round(Math.min(uv[0]![1], uv[1]![1]))],
      max: [round(Math.max(uv[0]![0], uv[1]![0])), round(Math.max(uv[0]![1], uv[1]![1]))],
    })
  }
  return rects
}

/** Odebere z úseček části ležící uvnitř obdélníků (Liang–Barsky). */
export function subtractRects(segments: readonly Segment2[], rects: readonly Rect2[]): Segment2[] {
  let current = [...segments]
  for (const r of rects) {
    const next: Segment2[] = []
    for (const s of current) {
      const dx = s.b[0] - s.a[0]
      const dy = s.b[1] - s.a[1]
      let t0 = 0
      let t1 = 1
      const clip = (p: number, q: number) => {
        if (Math.abs(p) < 1e-12) return q >= 0
        const t = q / p
        if (p < 0) t0 = Math.max(t0, t)
        else t1 = Math.min(t1, t)
        return true
      }
      const inside =
        clip(-dx, s.a[0] - r.min[0]) &&
        clip(dx, r.max[0] - s.a[0]) &&
        clip(-dy, s.a[1] - r.min[1]) &&
        clip(dy, r.max[1] - s.a[1]) &&
        t1 - t0 > 1e-9
      if (!inside) {
        next.push(s)
        continue
      }
      const at = (t: number): Vec2 => [round(s.a[0] + dx * t), round(s.a[1] + dy * t)]
      if (t0 > 1e-9) next.push({ a: s.a, b: at(t0) })
      if (t1 < 1 - 1e-9) next.push({ a: at(t1), b: s.b })
    }
    current = next
  }
  return current
}

function insideLoops(p: Vec2, loops: readonly (readonly Vec2[])[]): boolean {
  let inside = false
  for (const ring of loops) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]!
      const b = ring[j]!
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      ) {
        inside = !inside
      }
    }
  }
  return inside
}

/**
 * Hrany obdélníku žebra, které leží uvnitř plochy řezu (styk žebra se zbytkem součásti). Hrany na
 * obrysu plochy řezu už ve výkresu jsou.
 */
export function interiorRectEdges(rect: Rect2, loops: readonly (readonly Vec2[])[]): Segment2[] {
  const { min, max } = rect
  const edges: [Vec2, Vec2][] = [
    [min, [max[0], min[1]]],
    [[max[0], min[1]], max],
    [max, [min[0], max[1]]],
    [[min[0], max[1]], min],
  ]
  const out: Segment2[] = []
  const probe = 0.01
  for (const [a, b] of edges) {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len < 1e-9) continue
    // rozdělit v místech, kde hranu kříží obrys plochy řezu (a ve vrcholech obrysu na hraně)
    const ts = [0, 1]
    for (const ring of loops) {
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i]!
        const q = ring[(i + 1) % ring.length]!
        const ex = q[0] - p[0]
        const ey = q[1] - p[1]
        const denom = dx * ey - dy * ex
        if (Math.abs(denom) > 1e-12) {
          const t = ((p[0] - a[0]) * ey - (p[1] - a[1]) * ex) / denom
          const u = ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / denom
          if (t > 0 && t < 1 && u >= -1e-9 && u <= 1 + 1e-9) ts.push(t)
        } else {
          const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len)
          if (t > 0 && t < 1) ts.push(t)
        }
      }
    }
    ts.sort((x, y) => x - y)
    const nx = -dy / len
    const ny = dx / len
    let start: number | null = null
    let end = 0
    const flush = () => {
      if (start !== null) {
        out.push({
          a: [round(a[0] + dx * start), round(a[1] + dy * start)],
          b: [round(a[0] + dx * end), round(a[1] + dy * end)],
        })
      }
      start = null
    }
    for (let k = 0; k + 1 < ts.length; k++) {
      const t0 = ts[k]!
      const t1 = ts[k + 1]!
      if (t1 - t0 < 1e-9) continue
      const tm = (t0 + t1) / 2
      const m: Vec2 = [a[0] + dx * tm, a[1] + dy * tm]
      const both =
        insideLoops([m[0] + nx * probe, m[1] + ny * probe], loops) &&
        insideLoops([m[0] - nx * probe, m[1] - ny * probe], loops)
      if (both) {
        if (start === null) start = t0
        end = t1
      } else {
        flush()
      }
    }
    flush()
  }
  return out
}
