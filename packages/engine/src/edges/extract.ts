import type { Vec3 } from '@vykresovna/drafting-standards'
import type { SolidMesh } from '../mesh/types'

/**
 * Hrana mezi dvěma plochami, pod kterou je ostrý úhel (skutečná hrana tělesa).
 * Teselační hrany válců (malý úhel) sem nepatří.
 */
export const SHARP_EDGE_ANGLE_DEG = 20

/** Hrana sítě (mezi dvěma trojúhelníky). */
export type MeshEdge = {
  readonly a: number
  readonly b: number
  readonly t0: number
  readonly t1: number
  readonly sharp: boolean
}

/** Logická hrana tělesa: souvislý řetězec ostrých hran sítě mezi stejnou dvojicí ploch. */
export type LogicalEdge = {
  readonly id: string
  /** Indexy vrcholů po sobě (u uzavřené hrany se první vrchol na konci neopakuje). */
  readonly vertices: readonly number[]
  readonly closed: boolean
  readonly surfaces: readonly [number, number]
  readonly featureIds: readonly string[]
}

export type EdgeModel = {
  readonly meshEdges: readonly MeshEdge[]
  readonly logicalEdges: readonly LogicalEdge[]
}

/** Spojí vrcholy se stejnou polohou (manifold je obvykle sdílí, ale pro jistotu). */
function weld(mesh: SolidMesh): Uint32Array {
  const map = new Map<string, number>()
  const n = mesh.positions.length / 3
  const remap = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(mesh.positions[i * 3]! * 1e5)},${Math.round(mesh.positions[i * 3 + 1]! * 1e5)},${Math.round(mesh.positions[i * 3 + 2]! * 1e5)}`
    const existing = map.get(key)
    if (existing === undefined) {
      map.set(key, i)
      remap[i] = i
    } else {
      remap[i] = existing
    }
  }
  return remap
}

export function extractEdges(mesh: SolidMesh): EdgeModel {
  const remap = weld(mesh)
  const cosSharp = Math.cos((SHARP_EDGE_ANGLE_DEG * Math.PI) / 180)
  const triCount = mesh.triangles.length / 3
  const edgeTris = new Map<string, { a: number; b: number; tris: number[] }>()

  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const p = remap[mesh.triangles[t * 3 + k]!]!
      const q = remap[mesh.triangles[t * 3 + ((k + 1) % 3)]!]!
      if (p === q) continue
      const a = Math.min(p, q)
      const b = Math.max(p, q)
      const key = `${a}_${b}`
      const entry = edgeTris.get(key)
      if (entry) entry.tris.push(t)
      else edgeTris.set(key, { a, b, tris: [t] })
    }
  }

  const meshEdges: MeshEdge[] = []
  for (const { a, b, tris } of edgeTris.values()) {
    if (tris.length !== 2) continue // uzavřená síť má vždy právě 2
    const [t0, t1] = tris as [number, number]
    const n = mesh.triNormals
    const dot =
      n[t0 * 3]! * n[t1 * 3]! + n[t0 * 3 + 1]! * n[t1 * 3 + 1]! + n[t0 * 3 + 2]! * n[t1 * 3 + 2]!
    meshEdges.push({ a, b, t0, t1, sharp: dot < cosSharp })
  }

  // seskupení ostrých hran podle dvojice ploch a rozdělení na souvislé řetězce
  const groups = new Map<string, MeshEdge[]>()
  for (const e of meshEdges) {
    if (!e.sharp) continue
    const s0 = mesh.triSurface[e.t0]!
    const s1 = mesh.triSurface[e.t1]!
    if (s0 === s1) continue
    const k0 = mesh.surfaces[s0]!.key
    const k1 = mesh.surfaces[s1]!.key
    const key = k0 < k1 ? `${k0}|${k1}` : `${k1}|${k0}`
    const list = groups.get(key)
    if (list) list.push(e)
    else groups.set(key, [e])
  }

  const logicalEdges: LogicalEdge[] = []
  const sortedKeys = [...groups.keys()].sort()
  for (const key of sortedKeys) {
    const list = groups.get(key)!
    const first = list[0]!
    const surfaces: [number, number] = [mesh.triSurface[first.t0]!, mesh.triSurface[first.t1]!]
    const featureIds = [
      ...new Set(
        surfaces.map((s) => mesh.surfaces[s]!.featureId).filter((f): f is string => f !== null),
      ),
    ]
    for (const [i, chain] of chains(list).entries()) {
      logicalEdges.push({
        id: `${key}#${i}`,
        vertices: chain.vertices,
        closed: chain.closed,
        surfaces,
        featureIds,
      })
    }
  }
  return { meshEdges, logicalEdges }
}

/** Rozdělí množinu hran na souvislé řetězce (lomené čáry). Deterministicky podle indexů vrcholů. */
function chains(edges: readonly MeshEdge[]): { vertices: number[]; closed: boolean }[] {
  const adj = new Map<number, number[]>()
  for (const e of edges) {
    for (const [p, q] of [
      [e.a, e.b],
      [e.b, e.a],
    ] as const) {
      const l = adj.get(p)
      if (l) l.push(q)
      else adj.set(p, [q])
    }
  }
  for (const l of adj.values()) l.sort((x, y) => x - y)
  const used = new Set<string>()
  const ek = (p: number, q: number) => (p < q ? `${p}_${q}` : `${q}_${p}`)
  const result: { vertices: number[]; closed: boolean }[] = []

  const walk = (start: number) => {
    const vertices = [start]
    let cur = start
    for (;;) {
      const next = (adj.get(cur) ?? []).find((q) => !used.has(ek(cur, q)))
      if (next === undefined) break
      used.add(ek(cur, next))
      if (next === start) return { vertices, closed: true }
      vertices.push(next)
      cur = next
    }
    return { vertices, closed: false }
  }

  // nejdřív otevřené řetězce (začínají ve vrcholu se stupněm ≠ 2), pak uzavřené smyčky
  const verts = [...adj.keys()].sort((x, y) => x - y)
  for (const v of verts) {
    if (adj.get(v)!.length !== 2) {
      while ((adj.get(v) ?? []).some((q) => !used.has(ek(v, q)))) result.push(walk(v))
    }
  }
  for (const v of verts) {
    while ((adj.get(v) ?? []).some((q) => !used.has(ek(v, q)))) result.push(walk(v))
  }
  return result
}

export function vertexOf(mesh: SolidMesh, i: number): Vec3 {
  return [mesh.positions[i * 3]!, mesh.positions[i * 3 + 1]!, mesh.positions[i * 3 + 2]!]
}
