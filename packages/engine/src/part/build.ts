import type { Manifold, ManifoldToplevel } from 'manifold-3d'
import { drillPointHeight, type Vec3 } from '@vykresovna/drafting-standards'
import { CIRCULAR_SEGMENTS } from '../csg/manifold'
import type { SolidMesh, SurfaceInfo } from '../mesh/types'
import {
  AXIS_INDEX,
  otherAxes,
  type Axis,
  type Box,
  type ChamferFeature,
  type HoleFeature,
  type PartSpec,
} from './spec'
import { validatePart } from './validate'

/** O kolik mm přesahují odebírací tělesa základ, aby nevznikaly souběžné plochy. */
const OVERSHOOT = 1

function vec(axisValues: Partial<Record<Axis, number>>): Vec3 {
  return [axisValues.x ?? 0, axisValues.y ?? 0, axisValues.z ?? 0]
}

/** Kvádr nástroje; u odebírání se strany na hraně základu (nebo za ní) protáhnou o OVERSHOOT. */
function boxTool(wasm: ManifoldToplevel, box: Box, size: Vec3 | null): Manifold {
  const min = [0, 0, 0]
  const max = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    min[i] = size && box.min[i]! <= 0 ? -OVERSHOOT : box.min[i]!
    max[i] = size && box.max[i]! >= size[i]! ? size[i]! + OVERSHOOT : box.max[i]!
  }
  return wasm.Manifold.cube([max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!]).translate([
    min[0]!,
    min[1]!,
    min[2]!,
  ])
}

function holeTool(wasm: ManifoldToplevel, f: HoleFeature, size: Vec3): Manifold {
  const ai = AXIS_INDEX[f.axis]
  const extent = size[ai]
  let start: number
  let end: number
  if (f.depth === undefined) {
    start = -OVERSHOOT
    end = extent + OVERSHOOT
  } else if (f.from === 'max') {
    start = extent - f.depth
    end = extent + OVERSHOOT
  } else {
    start = -OVERSHOOT
    end = f.depth
  }
  const r = f.diameter / 2
  // válec manifoldu leží podél osy Z, od 0 do výšky; slepá díra má navíc kuželové dno (hrot vrtáku)
  let tool = wasm.Manifold.cylinder(end - start, r, r, CIRCULAR_SEGMENTS)
  if (f.depth !== undefined) {
    const h = drillPointHeight(f.diameter)
    const apexZ = f.from === 'max' ? -h : end - start + h
    // obal válce a vrcholu = válec + kužel bez vnitřní plochy na jejich styku
    const cyl = tool
    tool = wasm.Manifold.hull([cyl, [0, 0, apexZ]])
    cyl.delete()
  }
  // natočení do osy díry
  if (f.axis === 'x') tool = tool.rotate([0, 90, 0])
  if (f.axis === 'y') tool = tool.rotate([-90, 0, 0])
  const [a, b] = otherAxes(f.axis)
  return tool.translate(vec({ [f.axis]: start, [a]: f.at[0], [b]: f.at[1] }))
}

function chamferTool(wasm: ManifoldToplevel, f: ChamferFeature, size: Vec3): Manifold {
  const [a, b] = otherAxes(f.along)
  const ca = f.edge[0] === 'min' ? 0 : size[AXIS_INDEX[a]]
  const cb = f.edge[1] === 'min' ? 0 : size[AXIS_INDEX[b]]
  const da = f.edge[0] === 'min' ? 1 : -1
  const db = f.edge[1] === 'min' ? 1 : -1
  const m = OVERSHOOT
  const s = f.size
  // trojúhelník v rovině (a, b): přímka u + v = s odřízne roh kvádru
  const tri: [number, number][] = [
    [ca - da * m, cb - db * m],
    [ca + da * (s + m), cb - db * m],
    [ca - da * m, cb + db * (s + m)],
  ]
  const lo = -OVERSHOOT
  const hi = size[AXIS_INDEX[f.along]] + OVERSHOOT
  const points: Vec3[] = []
  for (const t of [lo, hi]) {
    for (const [pa, pb] of tri) points.push(vec({ [f.along]: t, [a]: pa, [b]: pb }))
  }
  return wasm.Manifold.hull(points as [number, number, number][])
}

export class InvalidPartError extends Error {}

/** Postaví těleso z parametrického popisu. Výsledek je uzavřená (manifold) síť s původem ploch. */
export function buildPart(wasm: ManifoldToplevel, spec: PartSpec): SolidMesh {
  const issues = validatePart(spec)
  if (issues.length > 0) {
    throw new InvalidPartError(
      `${spec.id}: ${issues.map((i) => `${i.featureId ?? 'základ'}: ${i.message}`).join('; ')}`,
    )
  }
  const size = spec.base.size
  const garbage: Manifold[] = []
  const keep = <T extends Manifold>(m: T) => {
    garbage.push(m)
    return m
  }

  let solid = keep(wasm.Manifold.cube([size[0], size[1], size[2]]).asOriginal())
  /** originalID nástroje → prvek */
  const featureByOriginal = new Map<number, string>()
  /**
   * originalID je globální počítadlo instance WASM (závisí na tom, co se stavělo dřív), proto ho v klíčích
   * ploch nahradíme pořadím: 0 = základ, 1… = prvky v pořadí. Klíče jsou tak stejné při každém sestavení.
   */
  const ordinalByOriginal = new Map<number, number>([[solid.originalID(), 0]])
  const holeByOriginal = new Map<number, HoleFeature>()

  for (const f of spec.features) {
    let tool: Manifold
    switch (f.kind) {
      case 'hole':
        tool = keep(holeTool(wasm, f, size))
        break
      case 'slot':
      case 'step':
      case 'cutout':
      case 'rib':
        tool = keep(boxTool(wasm, f.box, f.kind === 'rib' ? null : size))
        break
      case 'chamfer':
        tool = keep(chamferTool(wasm, f, size))
        break
    }
    tool = keep(tool.asOriginal())
    featureByOriginal.set(tool.originalID(), f.id)
    ordinalByOriginal.set(tool.originalID(), ordinalByOriginal.size)
    if (f.kind === 'hole') holeByOriginal.set(tool.originalID(), f)
    solid = keep(f.kind === 'rib' ? solid.add(tool) : solid.subtract(tool))
  }

  const mesh = solid.getMesh()
  const volume = solid.volume()
  const bboxRaw = solid.boundingBox()
  for (const g of garbage) g.delete()

  const numProp = mesh.numProp
  const vertCount = mesh.vertProperties.length / numProp
  const positions = new Float64Array(vertCount * 3)
  for (let i = 0; i < vertCount; i++) {
    for (let k = 0; k < 3; k++) {
      // float32 z WASM: zaokrouhlíme na 1e-6 mm, celá čísla se tak vrátí přesně
      positions[i * 3 + k] = Math.round(mesh.vertProperties[i * numProp + k]! * 1e6) / 1e6
    }
  }
  const triangles = Uint32Array.from(mesh.triVerts)
  const triCount = triangles.length / 3

  const triNormals = new Float64Array(triCount * 3)
  for (let t = 0; t < triCount; t++) {
    const [i0, i1, i2] = [triangles[t * 3]!, triangles[t * 3 + 1]!, triangles[t * 3 + 2]!]
    const ux = positions[i1 * 3]! - positions[i0 * 3]!
    const uy = positions[i1 * 3 + 1]! - positions[i0 * 3 + 1]!
    const uz = positions[i1 * 3 + 2]! - positions[i0 * 3 + 2]!
    const vx = positions[i2 * 3]! - positions[i0 * 3]!
    const vy = positions[i2 * 3 + 1]! - positions[i0 * 3 + 1]!
    const vz = positions[i2 * 3 + 2]! - positions[i0 * 3 + 2]!
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz) || 1
    triNormals[t * 3] = nx / len
    triNormals[t * 3 + 1] = ny / len
    triNormals[t * 3 + 2] = nz / len
  }

  // původ trojúhelníků: běhy (runs) podle originalID
  const triOriginal = new Int32Array(triCount)
  for (let r = 0; r < mesh.runOriginalID.length; r++) {
    const from = mesh.runIndex[r]! / 3
    const to = mesh.runIndex[r + 1]! / 3
    triOriginal.fill(mesh.runOriginalID[r]!, from, to)
  }

  const surfaces: SurfaceInfo[] = []
  const surfaceIndex = new Map<string, number>()
  const triSurface = new Int32Array(triCount)
  for (let t = 0; t < triCount; t++) {
    const orig = triOriginal[t]!
    const hole = holeByOriginal.get(orig)
    let info: SurfaceInfo
    if (hole) {
      const ai = AXIS_INDEX[hole.axis]
      const along = Math.abs(triNormals[t * 3 + ai]!)
      if (along < 1e-6) {
        const [a, b] = otherAxes(hole.axis)
        info = {
          key: `cyl:${hole.id}`,
          featureId: hole.id,
          cylinder: {
            axis: hole.axis,
            center: vec({ [hole.axis]: 0, [a]: hole.at[0], [b]: hole.at[1] }),
            radius: hole.diameter / 2,
          },
        }
      } else if (along < 1 - 1e-6) {
        // kuželové dno slepé díry
        info = { key: `cone:${hole.id}`, featureId: hole.id }
      } else {
        info = {
          key: `p:${ordinalByOriginal.get(orig) ?? orig}:${mesh.faceID[t]}`,
          featureId: hole.id,
        }
      }
    } else {
      info = {
        key: `p:${ordinalByOriginal.get(orig) ?? orig}:${mesh.faceID[t]}`,
        featureId: featureByOriginal.get(orig) ?? null,
      }
    }
    let idx = surfaceIndex.get(info.key)
    if (idx === undefined) {
      idx = surfaces.length
      surfaces.push(info)
      surfaceIndex.set(info.key, idx)
    }
    triSurface[t] = idx
  }

  return {
    positions,
    triangles,
    triSurface,
    triNormals,
    surfaces,
    bbox: {
      min: [bboxRaw.min[0], bboxRaw.min[1], bboxRaw.min[2]].map(
        (v) => Math.round(v * 1e6) / 1e6,
      ) as unknown as Vec3,
      max: [bboxRaw.max[0], bboxRaw.max[1], bboxRaw.max[2]].map(
        (v) => Math.round(v * 1e6) / 1e6,
      ) as unknown as Vec3,
    },
    volume,
  }
}
