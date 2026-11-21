import {
  formatChamfer,
  formatDiameter,
  formatDimensionValue,
  type Vec3,
} from '@vykresovna/drafting-standards'
import { AXIS_INDEX, otherAxes, type Axis, type Box, type PartSpec } from '../part/spec'
import type { PartDimension } from './types'

/**
 * Kóty součásti z jejího popisu (`PartSpec`), bez pohledů.
 *
 * Postup (pravidla v `DIMENSIONING_RULES`):
 * 1. Pro každou osu se sestaví kandidáti v pořadí důležitosti: celkový rozměr, rozměr základní desky,
 *    velikosti prvků (včetně hloubky slepé díry), polohy prvků od základny.
 * 2. Kandidát se přijme, jen když spojuje dvě souřadnice, které ještě nejsou určené jinými kótami
 *    (union-find). Tím je každý rozměr na výkrese jen jednou a nevznikne uzavřený řetězec kót.
 * 3. Průměry děr a zkosení se přidají vždy (každý prvek jednou).
 */

export type SymmetryInfo = { readonly axis: Axis; readonly at: number }

export type PartDimensionOptions = {
  /** Roviny souměrnosti, které výkres kreslí jako osy: poloha prvku na nich se nekótuje. */
  readonly symmetry?: readonly SymmetryInfo[]
}

const EPS = 1e-6
const AXES: readonly Axis[] = ['x', 'y', 'z']

/** Obalový kvádr součásti z popisu: základ a přidaná žebra (odebírání ho nezvětší). */
export function partBounds(spec: PartSpec): Box {
  const min: [number, number, number] = [0, 0, 0]
  const max: [number, number, number] = [spec.base.size[0], spec.base.size[1], spec.base.size[2]]
  for (const f of spec.features) {
    if (f.kind !== 'rib') continue
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, f.box.min[i]!)
      max[i] = Math.max(max[i]!, f.box.max[i]!)
    }
  }
  return { min, max }
}

type Candidate = PartDimension & { readonly priority: number }

/** Union-find nad souřadnicemi jedné osy. */
class CoordinateSets {
  private readonly parent = new Map<string, string>()
  private key(v: number) {
    return String(Math.round(v * 1000) / 1000 + 0)
  }
  private find(k: string): string {
    let p = this.parent.get(k) ?? k
    if (p !== k) {
      p = this.find(p)
      this.parent.set(k, p)
    }
    return p
  }
  /** Spojí dvě souřadnice; vrátí false, když už spojené byly (kóta by byla nadbytečná). */
  union(a: number, b: number): boolean {
    const ra = this.find(this.key(a))
    const rb = this.find(this.key(b))
    if (ra === rb) return false
    this.parent.set(ra, rb)
    return true
  }
}

function regionFromSpan(bounds: Box, axis: Axis, a: number, b: number, other?: Box): Box {
  const i = AXIS_INDEX[axis]
  const src = other ?? bounds
  const min: [number, number, number] = [src.min[0], src.min[1], src.min[2]]
  const max: [number, number, number] = [src.max[0], src.max[1], src.max[2]]
  min[i] = a
  max[i] = b
  return { min, max }
}

/** Všechny kóty součásti (bez přiřazení k pohledu). Pořadí je stabilní. */
export function partDimensions(
  spec: PartSpec,
  options: PartDimensionOptions = {},
): PartDimension[] {
  const bounds = partBounds(spec)
  const symmetry = options.symmetry ?? []
  const onSymmetry = (axis: Axis, c: number) =>
    symmetry.some((s) => s.axis === axis && Math.abs(s.at - c) < EPS)
  const linear: Candidate[] = []
  const other: PartDimension[] = []

  const pushLinear = (
    priority: number,
    id: string,
    featureId: string | null,
    role: PartDimension['role'],
    axis: Axis,
    a: number,
    b: number,
    region: Box,
    trueShapeAxes: readonly Axis[],
    extra: Partial<Pick<PartDimension, 'hole' | 'text'>> = {},
  ) => {
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    if (hi - lo < EPS) return
    linear.push({
      id,
      featureId,
      kind: 'linear',
      role,
      value: hi - lo,
      text: extra.text ?? formatDimensionValue(hi - lo),
      axis,
      span: [lo, hi],
      region,
      trueShapeAxes,
      priority,
      ...(extra.hole ? { hole: extra.hole } : {}),
    })
  }

  // 1. celkové rozměry
  for (const axis of AXES) {
    const i = AXIS_INDEX[axis]
    pushLinear(
      0,
      `dim:part:overall:${axis}`,
      null,
      'overall',
      axis,
      bounds.min[i]!,
      bounds.max[i]!,
      bounds,
      [],
    )
  }
  // 2. základní deska, pokud ji žebra přesahují
  const baseBox: Box = { min: [0, 0, 0], max: spec.base.size }
  for (const axis of AXES) {
    const i = AXIS_INDEX[axis]
    if (bounds.min[i]! < -EPS || bounds.max[i]! > spec.base.size[i]! + EPS) {
      pushLinear(1, `dim:part:base:${axis}`, null, 'base', axis, 0, spec.base.size[i]!, baseBox, [])
    }
  }

  // 3. velikosti a 4. polohy prvků
  spec.features.forEach((f) => {
    if (f.kind === 'slot' || f.kind === 'step' || f.kind === 'cutout' || f.kind === 'rib') {
      // skutečný tvar: pohled podél osy, ve které prvek prochází celou součástí
      const through = AXES.filter((axis) => {
        const i = AXIS_INDEX[axis]
        return f.box.min[i]! <= bounds.min[i]! + EPS && f.box.max[i]! >= bounds.max[i]! - EPS
      })
      for (const axis of AXES) {
        const i = AXIS_INDEX[axis]
        const lo = f.box.min[i]!
        const hi = f.box.max[i]!
        const touchMin = lo <= bounds.min[i]! + EPS
        const touchMax = hi >= bounds.max[i]! - EPS
        if (touchMin && touchMax) continue
        const region = f.box
        if (touchMin) {
          pushLinear(
            2,
            `dim:${f.id}:size:${axis}`,
            f.id,
            'size',
            axis,
            bounds.min[i]!,
            hi,
            region,
            through,
          )
        } else if (touchMax) {
          pushLinear(
            2,
            `dim:${f.id}:size:${axis}`,
            f.id,
            'size',
            axis,
            lo,
            bounds.max[i]!,
            region,
            through,
          )
        } else {
          pushLinear(2, `dim:${f.id}:size:${axis}`, f.id, 'size', axis, lo, hi, region, through)
          if (!onSymmetry(axis, (lo + hi) / 2)) {
            pushLinear(
              3,
              `dim:${f.id}:position:${axis}`,
              f.id,
              'position',
              axis,
              bounds.min[i]!,
              lo,
              regionFromSpan(bounds, axis, bounds.min[i]!, hi, f.box),
              through,
            )
          }
        }
      }
    } else if (f.kind === 'hole') {
      const ai = AXIS_INDEX[f.axis]
      const [a, b] = otherAxes(f.axis)
      const r = f.diameter / 2
      const extent = spec.base.size[ai]
      const start = f.depth === undefined ? 0 : f.from === 'max' ? extent - f.depth : 0
      const end = f.depth === undefined ? extent : f.from === 'max' ? extent : f.depth
      const center: [number, number, number] = [0, 0, 0]
      center[ai] = f.from === 'max' && f.depth !== undefined ? extent : 0
      center[AXIS_INDEX[a]] = f.at[0]
      center[AXIS_INDEX[b]] = f.at[1]
      const hmin: [number, number, number] = [0, 0, 0]
      const hmax: [number, number, number] = [0, 0, 0]
      hmin[ai] = start
      hmax[ai] = end
      hmin[AXIS_INDEX[a]] = f.at[0] - r
      hmax[AXIS_INDEX[a]] = f.at[0] + r
      hmin[AXIS_INDEX[b]] = f.at[1] - r
      hmax[AXIS_INDEX[b]] = f.at[1] + r
      const region: Box = { min: hmin, max: hmax }
      const hole = { center: center as Vec3, radius: r, axis: f.axis }
      other.push({
        id: `dim:${f.id}:diameter`,
        featureId: f.id,
        kind: 'diameter',
        role: 'diameter',
        value: f.diameter,
        text: formatDiameter(f.diameter),
        axis: f.axis,
        span: [0, f.diameter],
        region,
        hole,
        trueShapeAxes: [f.axis],
      })
      if (f.depth !== undefined) {
        // hloubka slepé díry: jen válcová část, kuželové dno se nekótuje (D-017)
        pushLinear(2, `dim:${f.id}:depth`, f.id, 'depth', f.axis, start, end, region, [])
      }
      for (const [axis, c] of [
        [a, f.at[0]],
        [b, f.at[1]],
      ] as const) {
        if (onSymmetry(axis, c)) continue
        const i = AXIS_INDEX[axis]
        pushLinear(
          3,
          `dim:${f.id}:position:${axis}`,
          f.id,
          'position',
          axis,
          bounds.min[i]!,
          c,
          regionFromSpan(bounds, axis, bounds.min[i]!, c + r, region),
          [f.axis],
          { hole },
        )
      }
    } else if (f.kind === 'chamfer') {
      // zkosení: kótuje se odvěsna podél první zbývající osy textem „velikost × 45°“
      const [a, b] = otherAxes(f.along)
      const min: [number, number, number] = [bounds.min[0], bounds.min[1], bounds.min[2]]
      const max: [number, number, number] = [bounds.max[0], bounds.max[1], bounds.max[2]]
      for (const [axis, side] of [
        [a, f.edge[0]],
        [b, f.edge[1]],
      ] as const) {
        const i = AXIS_INDEX[axis]
        if (side === 'min') max[i] = bounds.min[i]! + f.size
        else min[i] = bounds.max[i]! - f.size
      }
      const ia = AXIS_INDEX[a]
      other.push({
        id: `dim:${f.id}:chamfer`,
        featureId: f.id,
        kind: 'chamfer',
        role: 'chamfer',
        value: f.size,
        text: formatChamfer(f.size),
        axis: a,
        span: [min[ia]!, max[ia]!],
        region: { min, max },
        trueShapeAxes: [f.along],
      })
    }
  })

  // výběr bez nadbytečných kót: po osách, v pořadí priority a popisu
  const accepted: PartDimension[] = []
  for (const axis of AXES) {
    const sets = new CoordinateSets()
    const list = linear
      .map((d, order) => ({ d, order }))
      .filter(({ d }) => d.axis === axis)
      .sort((p, q) => p.d.priority - q.d.priority || p.order - q.order)
    for (const { d } of list) {
      if (sets.union(d.span[0], d.span[1])) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- priority se do výstupu nedává
        const { priority, ...dim } = d
        accepted.push(dim)
      }
    }
  }
  // stabilní pořadí: jak vznikaly
  const order = new Map(linear.map((d, i) => [d.id, i]))
  accepted.sort((p, q) => order.get(p.id)! - order.get(q.id)!)
  return [...accepted, ...other]
}
