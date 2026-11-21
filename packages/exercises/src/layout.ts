/**
 * Pravidla čitelnosti vygenerovaných součástí: prvky mají rozumnou velikost, nechávají dost materiálu
 * a navzájem se nedotýkají (žádné tenké stěny, splývající plochy ani prvek uvnitř jiného prvku).
 *
 * Nejde o normu technického kreslení, jen o parametry generátoru úloh, proto jsou tady a ne
 * v drafting-standards.
 */
import { drillPointHeight, type Vec3 } from '@vykresovna/drafting-standards'
import {
  AXIS_INDEX,
  otherAxes,
  validatePart,
  type Box,
  type Feature,
  type PartSpec,
} from '@vykresovna/engine'

/** Nejmenší tloušťka materiálu (stěna, mezera mezi prvky) v mm. */
export const MIN_WALL_MM = 3
/** Nejmenší rozměr prvku v mm (menší by ve výkresu splýval). */
export const MIN_FEATURE_MM = 4
/** Průměry děr, které generátor používá (sudé, aby osy ležely na celých milimetrech). */
export const HOLE_DIAMETERS: readonly number[] = [6, 8, 10, 12, 14, 16]
/** Největší zkosení v mm. */
export const MAX_CHAMFER_MM = 10

type MutableVec3 = [number, number, number]

/** Obalový kvádr oblasti, kterou prvek ovlivní (u odebíraných prvků oříznutý na základ). */
export function featureRegion(f: Feature, size: Vec3): Box {
  switch (f.kind) {
    case 'hole': {
      const ai = AXIS_INDEX[f.axis]
      const [a, b] = otherAxes(f.axis)
      const r = f.diameter / 2
      const min: MutableVec3 = [0, 0, 0]
      const max: MutableVec3 = [size[0], size[1], size[2]]
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
      const min: MutableVec3 = [0, 0, 0]
      const max: MutableVec3 = [size[0], size[1], size[2]]
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
    case 'rib':
      return f.box
    default: {
      const min = f.box.min.map((v) => Math.max(0, v)) as MutableVec3
      const max = f.box.max.map((v, i) => Math.min(size[i]!, v)) as MutableVec3
      return { min, max }
    }
  }
}

/** Jak odebíraný kvádr leží v ose: přes celou délku, u jedné stěny, nebo uvnitř. */
export type AxisPlacement = 'span' | 'min' | 'max' | 'inner'

export function boxPlacement(box: Box, size: Vec3): [AxisPlacement, AxisPlacement, AxisPlacement] {
  return [0, 1, 2].map((i) => {
    const atMin = box.min[i]! <= 0
    const atMax = box.max[i]! >= size[i]!
    if (atMin && atMax) return 'span'
    if (atMin) return 'min'
    if (atMax) return 'max'
    return 'inner'
  }) as [AxisPlacement, AxisPlacement, AxisPlacement]
}

const count = (list: readonly AxisPlacement[], p: (x: AxisPlacement) => boolean) =>
  list.filter(p).length

/** Je jednotlivý prvek čitelný a dostatečně daleko od okrajů? */
export function featureOk(f: Feature, size: Vec3): boolean {
  switch (f.kind) {
    case 'hole': {
      if (!HOLE_DIAMETERS.includes(f.diameter)) return false
      const r = f.diameter / 2
      const [a, b] = otherAxes(f.axis)
      for (const [c, axis] of [
        [f.at[0], a],
        [f.at[1], b],
      ] as const) {
        if (!Number.isInteger(c)) return false
        if (c - r < MIN_WALL_MM || c + r > size[AXIS_INDEX[axis]] - MIN_WALL_MM) return false
      }
      if (f.depth !== undefined) {
        const ext = size[AXIS_INDEX[f.axis]]
        if (!Number.isInteger(f.depth) || f.depth < MIN_FEATURE_MM) return false
        if (f.depth + drillPointHeight(f.diameter) > ext - MIN_WALL_MM) return false
        if (!f.from) return false
      }
      return true
    }
    case 'chamfer': {
      const [a, b] = otherAxes(f.along)
      const limit = Math.min(
        MAX_CHAMFER_MM,
        Math.floor(Math.min(size[AXIS_INDEX[a]], size[AXIS_INDEX[b]]) / 3),
      )
      return Number.isInteger(f.size) && f.size >= MIN_FEATURE_MM && f.size <= limit
    }
    case 'rib': {
      const { min, max } = f.box
      if (min[2] !== size[2]) return false // žebro stojí na horní stěně
      if (max[2] - min[2] < MIN_FEATURE_MM) return false
      for (const i of [0, 1]) {
        if (min[i]! < 0 || max[i]! > size[i]!) return false
        if (max[i]! - min[i]! < MIN_FEATURE_MM) return false
      }
      return [...min, ...max].every(Number.isInteger)
    }
    default: {
      const { min, max } = f.box
      if (![...min, ...max].every(Number.isInteger)) return false
      for (let i = 0; i < 3; i++) {
        if (min[i]! < 0 || max[i]! > size[i]!) return false
        const len = max[i]! - min[i]!
        if (len < MIN_FEATURE_MM) return false
      }
      const placement = boxPlacement(f.box, size)
      for (let i = 0; i < 3; i++) {
        const p = placement[i]!
        const len = max[i]! - min[i]!
        if (p === 'inner' && (min[i]! < MIN_WALL_MM || max[i]! > size[i]! - MIN_WALL_MM)) {
          return false
        }
        if ((p === 'min' || p === 'max') && size[i]! - len < MIN_WALL_MM) return false
      }
      const span = count(placement, (p) => p === 'span')
      const side = count(placement, (p) => p === 'min' || p === 'max')
      if (f.kind === 'slot') return span === 1 && side === 1
      if (f.kind === 'step') return span === 1 && side === 2
      // výřez: roh (3 stěny), hrana (2 stěny) nebo kapsa (1 stěna), nikdy přes celou délku
      return span === 0 && side >= 1
    }
  }
}

/** Mezera mezi dvěma kvádry (největší vzdálenost v některé ose; záporná = překryv). */
export function boxGap(a: Box, b: Box): number {
  let gap = -Infinity
  for (let i = 0; i < 3; i++) {
    gap = Math.max(gap, b.min[i]! - a.max[i]!, a.min[i]! - b.max[i]!)
  }
  return gap
}

/** Celá součást: validní pro engine, každý prvek čitelný a prvky od sebe aspoň MIN_WALL_MM. */
export function layoutOk(spec: PartSpec): boolean {
  if (validatePart(spec).length > 0) return false
  const size = spec.base.size
  const regions: Box[] = []
  for (const f of spec.features) {
    if (!featureOk(f, size)) return false
    const region = featureRegion(f, size)
    if (regions.some((r) => boxGap(r, region) < MIN_WALL_MM - 1e-9)) return false
    regions.push(region)
  }
  return true
}

/** Hranice oblastí prvků v dané ose (kandidáti na „souběžné“ hrany u nejvyšší obtížnosti). */
export function featureLevels(spec: PartSpec, axis: 0 | 1 | 2): number[] {
  const size = spec.base.size
  const levels = new Set<number>()
  for (const f of spec.features) {
    const r = featureRegion(f, size)
    for (const v of [r.min[axis]!, r.max[axis]!]) {
      if (Number.isInteger(v) && v > 0 && v < size[axis]) levels.add(v)
    }
  }
  return [...levels].sort((x, y) => x - y)
}
