import type { Vec3 } from '@vykresovna/drafting-standards'
import type { SolidMesh, SurfaceInfo } from '../mesh/types'
import { AXIS_INDEX, otherAxes, type Axis } from '../part/spec'
import { groupRings, triangulateFace, type RingPoint } from './triangulate'

/**
 * Rozříznutí tělesa rovinou kolmou na hlavní osu (čistý TypeScript nad sítí trojúhelníků, bez WASM,
 * takže běží i v hlavním vlákně prohlížeče pro interaktivní řez ve 3D).
 *
 * 1. Trojúhelníky na odebírané straně se zahodí, protnuté se oříznou (nové vrcholy na hranách sítě).
 * 2. Hranice oříznuté sítě leží celá v rovině řezu; její smyčky jsou obrysy plochy řezu (díry v ploše
 *    jsou smyčky s opačnou orientací).
 * 3. Plocha řezu se triangulací uzavře, takže zbytek součásti je opět uzavřené těleso.
 */

/** Rovina řezu `axis = at`; `keep` = strana, která zůstane (max = větší souřadnice). */
export type CutPlane = { readonly axis: Axis; readonly at: number; readonly keep: 'min' | 'max' }

/** Minimální vstup: vrcholy a trojúhelníky (stačí i data pro 3D prohlížeč). */
export type MeshInput = {
  readonly positions: ArrayLike<number>
  readonly triangles: ArrayLike<number>
}

/** Vrchol blíž k rovině než tato vzdálenost (mm) leží v rovině. */
const SNAP = 1e-6
/**
 * Když rovina leží přesně ve stěně součásti, posune se o tolik (mm) na zachovávanou stranu.
 * Výsledek je pak jednoznačný: stěna patří odebrané části a řez prochází materiálem těsně za ní.
 */
export const COPLANAR_NUDGE_MM = 1e-4

type ClipResult = {
  readonly positions: number[]
  /** Zachované trojúhelníky (indexy vrcholů) a trojúhelník vstupu, ze kterého vznikly. */
  readonly kept: { tri: [number, number, number]; source: number }[]
  /** Trojúhelníky plochy řezu. */
  readonly cap: [number, number, number][]
  /** Obrysy plochy řezu (indexy vrcholů), orientované souhlasně s normálou plochy řezu. */
  readonly loops: number[][]
  /** Skutečná poloha roviny (po případném posunu ze stěny). */
  readonly at: number
  /** Normála plochy řezu (míří k pozorovateli, tedy na odebranou stranu). */
  readonly normal: Vec3
}

function clip(input: MeshInput, plane: CutPlane): ClipResult {
  const ai = AXIS_INDEX[plane.axis]
  const sign = plane.keep === 'max' ? 1 : -1
  const src = input.positions
  const n = src.length / 3
  const triCount = input.triangles.length / 3

  // sloučení vrcholů se stejnou polohou (síť z manifoldu je sdílí, data pro prohlížeč také)
  const canon = new Uint32Array(n)
  const seen = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(src[i * 3]! * 1e5)},${Math.round(src[i * 3 + 1]! * 1e5)},${Math.round(src[i * 3 + 2]! * 1e5)}`
    const hit = seen.get(key)
    if (hit === undefined) {
      seen.set(key, i)
      canon[i] = i
    } else {
      canon[i] = hit
    }
  }

  const distances = (at: number) => {
    const d = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      const v = sign * (src[i * 3 + ai]! - at)
      d[i] = Math.abs(v) < SNAP ? 0 : v
    }
    return d
  }
  const coplanarFace = (d: Float64Array) => {
    for (let t = 0; t < triCount; t++) {
      const i0 = input.triangles[t * 3]!
      const i1 = input.triangles[t * 3 + 1]!
      const i2 = input.triangles[t * 3 + 2]!
      if (d[i0] === 0 && d[i1] === 0 && d[i2] === 0) return true
    }
    return false
  }
  let at = plane.at
  let d = distances(at)
  if (coplanarFace(d)) {
    at = plane.at + sign * COPLANAR_NUDGE_MM
    d = distances(at)
  }

  const positions: number[] = Array.from(src)
  const edgeVertex = new Map<string, number>()
  const cutVertex = (p: number, q: number): number => {
    const a = Math.min(p, q)
    const b = Math.max(p, q)
    const key = `${a}_${b}`
    const hit = edgeVertex.get(key)
    if (hit !== undefined) return hit
    const u = d[a]! / (d[a]! - d[b]!)
    const idx = positions.length / 3
    for (let k = 0; k < 3; k++) {
      const v = k === ai ? at : src[a * 3 + k]! + (src[b * 3 + k]! - src[a * 3 + k]!) * u
      positions.push(Math.round(v * 1e6) / 1e6)
    }
    edgeVertex.set(key, idx)
    return idx
  }

  const kept: { tri: [number, number, number]; source: number }[] = []
  for (let t = 0; t < triCount; t++) {
    const ids = [
      canon[input.triangles[t * 3]!]!,
      canon[input.triangles[t * 3 + 1]!]!,
      canon[input.triangles[t * 3 + 2]!]!,
    ]
    const ds = ids.map((i) => d[i]!)
    if (ds.every((v) => v >= 0)) {
      if (ds.every((v) => v === 0)) continue // degenerovaný trojúhelník v rovině
      kept.push({ tri: [ids[0]!, ids[1]!, ids[2]!], source: t })
      continue
    }
    if (ds.every((v) => v <= 0)) continue
    // Sutherland–Hodgman proti polorovině d ≥ 0
    const poly: number[] = []
    for (let k = 0; k < 3; k++) {
      const p = ids[k]!
      const q = ids[(k + 1) % 3]!
      const dp = d[p]!
      const dq = d[q]!
      if (dp >= 0) poly.push(p)
      if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) poly.push(cutVertex(p, q))
    }
    for (let k = 1; k + 1 < poly.length; k++) {
      kept.push({ tri: [poly[0]!, poly[k]!, poly[k + 1]!], source: t })
    }
  }

  // hranice oříznuté sítě: orientované hrany bez protějšku
  const directed = new Set<string>()
  for (const { tri } of kept) {
    for (let k = 0; k < 3; k++) directed.add(`${tri[k]}_${tri[(k + 1) % 3]}`)
  }
  const onPlane = (i: number) => Math.abs(positions[i * 3 + ai]! - at) < SNAP
  const outgoing = new Map<number, number[]>()
  let capEdges = 0
  for (const { tri } of kept) {
    for (let k = 0; k < 3; k++) {
      const u = tri[k]!
      const v = tri[(k + 1) % 3]!
      if (directed.has(`${v}_${u}`) || !onPlane(u) || !onPlane(v)) continue
      // obrys plochy řezu jde opačně než hrana oříznuté sítě
      const list = outgoing.get(v)
      if (list) list.push(u)
      else outgoing.set(v, [u])
      capEdges++
    }
  }

  // 2D souřadnice v rovině; zrcadlí se tak, aby normála plochy řezu mířila „k nám“ (obrysy proti
  // směru hodinových ručiček, díry po směru)
  const [a, b] = otherAxes(plane.axis)
  const ia = AXIS_INDEX[a]
  const ib = AXIS_INDEX[b]
  const frameSign = plane.axis === 'y' ? -1 : 1 // e_a × e_b = frameSign · e_osa
  const mirror = -sign !== frameSign
  const pt = (i: number): RingPoint => ({
    x: positions[i * 3 + ia]!,
    y: mirror ? -positions[i * 3 + ib]! : positions[i * 3 + ib]!,
    id: i,
  })

  const loops: number[][] = []
  const usedEdge = new Set<string>()
  const starts = [...outgoing.keys()].sort((x, y) => x - y)
  for (const s of starts) {
    for (;;) {
      const first = (outgoing.get(s) ?? []).find((q) => !usedEdge.has(`${s}_${q}`))
      if (first === undefined) break
      const loop = [s]
      usedEdge.add(`${s}_${first}`)
      let prev = s
      let cur = first
      let guard = 0
      while (cur !== s && guard++ <= capEdges) {
        loop.push(cur)
        const cands = (outgoing.get(cur) ?? []).filter((q) => !usedEdge.has(`${cur}_${q}`))
        if (cands.length === 0) break
        let nextV = cands[0]!
        if (cands.length > 1) {
          // více možností (smyčky se dotýkají ve vrcholu): nejmenší otočení po směru hodinových ručiček
          // od zpětného směru, aby každá smyčka zůstala jednoduchá
          const pc = pt(cur)
          const pp = pt(prev)
          const back = Math.atan2(pp.y - pc.y, pp.x - pc.x)
          let best = Infinity
          for (const q of cands) {
            const pq = pt(q)
            let cw = back - Math.atan2(pq.y - pc.y, pq.x - pc.x)
            while (cw <= 1e-12) cw += 2 * Math.PI
            while (cw > 2 * Math.PI) cw -= 2 * Math.PI
            if (cw < best) {
              best = cw
              nextV = q
            }
          }
        }
        usedEdge.add(`${cur}_${nextV}`)
        prev = cur
        cur = nextV
      }
      if (loop.length >= 3) loops.push(loop)
    }
  }

  const cap: [number, number, number][] = []
  for (const face of groupRings(loops.map((l) => l.map(pt)))) {
    cap.push(...triangulateFace(face.outer, face.holes))
  }

  const normal: [number, number, number] = [0, 0, 0]
  normal[ai] = -sign
  return { positions, kept, cap, loops, at, normal }
}

/**
 * Zbytek tělesa za rovinou řezu jako uzavřená síť. Plocha řezu dostane vlastní plochu s klíčem
 * `capKey` (např. `section:A`), takže její hrany s ostatními plochami jsou běžné ostré hrany.
 */
export function cutSolid(mesh: SolidMesh, plane: CutPlane, capKey: string): SolidMesh {
  return cutSolidWithCap(mesh, plane, capKey).solid
}

/** Jako `cutSolid`, navíc vrátí obrysy plochy řezu (3D) a skutečnou polohu roviny. */
export function cutSolidWithCap(
  mesh: SolidMesh,
  plane: CutPlane,
  capKey: string,
): { solid: SolidMesh; loops: Vec3[][]; at: number } {
  const r = clip(mesh, plane)
  const capSurface: SurfaceInfo = { key: capKey, featureId: null }
  const surfaces = [...mesh.surfaces, capSurface]
  const capIndex = surfaces.length - 1

  const tris: [number, number, number][] = [...r.kept.map((k) => k.tri), ...r.cap]
  // jen použité vrcholy, v pořadí prvního použití (stabilní výstup)
  const remap = new Map<number, number>()
  const positions: number[] = []
  const triangles = new Uint32Array(tris.length * 3)
  tris.forEach((tri, t) => {
    tri.forEach((v, k) => {
      let idx = remap.get(v)
      if (idx === undefined) {
        idx = remap.size
        remap.set(v, idx)
        positions.push(r.positions[v * 3]!, r.positions[v * 3 + 1]!, r.positions[v * 3 + 2]!)
      }
      triangles[t * 3 + k] = idx
    })
  })

  const triSurface = new Int32Array(tris.length)
  const triNormals = new Float64Array(tris.length * 3)
  r.kept.forEach((k, t) => {
    triSurface[t] = mesh.triSurface[k.source]!
    for (let c = 0; c < 3; c++) triNormals[t * 3 + c] = mesh.triNormals[k.source * 3 + c]!
  })
  for (let t = r.kept.length; t < tris.length; t++) {
    triSurface[t] = capIndex
    for (let c = 0; c < 3; c++) triNormals[t * 3 + c] = r.normal[c]!
  }

  const pos = Float64Array.from(positions)
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      min[c] = Math.min(min[c]!, pos[i + c]!)
      max[c] = Math.max(max[c]!, pos[i + c]!)
    }
  }
  let volume = 0
  for (let t = 0; t < tris.length; t++) {
    const [p, q, s] = [triangles[t * 3]!, triangles[t * 3 + 1]!, triangles[t * 3 + 2]!]
    const ax = pos[p * 3]!
    const ay = pos[p * 3 + 1]!
    const az = pos[p * 3 + 2]!
    const bx = pos[q * 3]!
    const by = pos[q * 3 + 1]!
    const bz = pos[q * 3 + 2]!
    const cx = pos[s * 3]!
    const cy = pos[s * 3 + 1]!
    const cz = pos[s * 3 + 2]!
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
  }

  const solid: SolidMesh = {
    positions: pos,
    triangles,
    triSurface,
    triNormals,
    surfaces,
    bbox: { min, max },
    volume,
  }
  return { solid, loops: loopPoints(r), at: r.at }
}

function loopPoints(r: ClipResult): Vec3[][] {
  return r.loops.map((l) =>
    l.map((v): Vec3 => [r.positions[v * 3]!, r.positions[v * 3 + 1]!, r.positions[v * 3 + 2]!]),
  )
}

/** Plocha řezu pro 3D prohlížeč: trojúhelníky (bez indexů) a obrysy, v souřadnicích enginu. */
export type SectionCap = {
  /** x, y, z po vrcholech, tři vrcholy na trojúhelník. */
  readonly triangles: Float32Array
  readonly loops: readonly (readonly Vec3[])[]
  /** Normála plochy řezu (míří na odebranou stranu, k pozorovateli). */
  readonly normal: Vec3
  /** Skutečná poloha roviny (po případném posunu ze stěny součásti). */
  readonly at: number
}

export function sectionCap(input: MeshInput, plane: CutPlane): SectionCap {
  const r = clip(input, plane)
  const triangles = new Float32Array(r.cap.length * 9)
  r.cap.forEach((tri, t) => {
    tri.forEach((v, k) => {
      for (let c = 0; c < 3; c++) triangles[t * 9 + k * 3 + c] = r.positions[v * 3 + c]!
    })
  })
  return { triangles, loops: loopPoints(r), normal: r.normal, at: r.at }
}
