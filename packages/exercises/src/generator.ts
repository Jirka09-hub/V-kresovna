/**
 * Generátor náhodných, ale čitelných součástí podle obtížnosti 1–5.
 *
 * Postup: zvolí se kvádr a plán prvků (podle obtížnosti), pak se každý prvek losuje opakovaně, dokud
 * nesplní pravidla čitelnosti (layout.ts). Když se prvek nedaří umístit, začne se znovu s jiným
 * kvádrem. Vše je deterministické ze seedu.
 */
import { drillPointHeight, type Vec3 } from '@vykresovna/drafting-standards'
import { AXIS_INDEX, otherAxes, type Axis, type Feature, type PartSpec } from '@vykresovna/engine'
import {
  featureLevels,
  HOLE_DIAMETERS,
  layoutOk,
  MAX_CHAMFER_MM,
  MIN_FEATURE_MM,
  MIN_WALL_MM,
} from './layout'
import { createRng, deriveSeed, type Rng } from './rng'
import type { Difficulty } from './types'

type Side = 'min' | 'max'
type Interval = [number, number]
type MutableVec3 = [number, number, number]

/** Druhy prvků, které generátor umí vytvořit (jemnější než `Feature['kind']`). */
export type FeatureRecipe =
  | 'corner' // výřez v rohu
  | 'pocket' // kapsa v jedné stěně
  | 'step' // osazení podél hrany
  | 'slot' // drážka
  | 'throughHole'
  | 'blindHole'
  | 'anyHole'
  | 'chamfer'
  | 'rib'

type GenContext = {
  readonly rng: Rng
  readonly size: Vec3
  readonly existing: PartSpec
  /** Velké, výrazné prvky (obtížnost 1). */
  readonly big: boolean
  /** Prvek na horní straně (aby byl vidět v nárysu i půdorysu). */
  readonly top: boolean
  /** Pravděpodobnost, že se rozměr „přichytí“ k hraně jiného prvku (souběžné čáry). */
  readonly snap: number
}

const even = (x: number) => 2 * Math.round(x / 2)
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Délka úseku jako zlomek rozměru, zaokrouhlená na sudé mm a omezená pravidly čitelnosti. */
function fraction(c: GenContext, ext: number, lo: number, hi: number, minLen = MIN_FEATURE_MM) {
  const frac = lo + (hi - lo) * c.rng.next()
  return clamp(even(ext * frac), minLen, ext - MIN_WALL_MM)
}

function snapPick(c: GenContext, candidates: readonly number[]): number | null {
  if (candidates.length === 0 || !c.rng.chance(c.snap)) return null
  return c.rng.pick(candidates)
}

/** Interval u jedné stěny (min = od nuly, max = ke konci). */
function oneSided(c: GenContext, i: 0 | 1 | 2, side: Side, lo: number, hi: number): Interval {
  const ext = c.size[i]
  const valid = (len: number) => len >= MIN_FEATURE_MM && len <= ext - MIN_WALL_MM
  const levels = featureLevels(c.existing, i).map((l) => (side === 'min' ? l : ext - l))
  const len = snapPick(c, levels.filter(valid)) ?? fraction(c, ext, lo, hi)
  return side === 'min' ? [0, len] : [ext - len, ext]
}

/** Interval uvnitř (od obou stěn aspoň MIN_WALL_MM); `len` pevná délka, jinak zlomek rozměru. */
function inner(
  c: GenContext,
  i: 0 | 1 | 2,
  lo: number,
  hi: number,
  opts: { len?: number; minLen?: number; centerChance?: number } = {},
): Interval | null {
  const ext = c.size[i]
  const len = opts.len ?? fraction(c, ext, lo, hi, opts.minLen)
  const sMin = MIN_WALL_MM
  const sMax = ext - MIN_WALL_MM - len
  if (sMax < sMin) return null
  const levels = featureLevels(c.existing, i)
  const snapped = snapPick(
    c,
    levels.flatMap((l) => [l, l - len]).filter((s) => s >= sMin && s <= sMax),
  )
  let start: number
  if (snapped !== null) start = snapped
  else if (c.rng.chance(opts.centerChance ?? 0.3) && Number.isInteger((ext - len) / 2)) {
    start = (ext - len) / 2
  } else start = c.rng.int(sMin, sMax)
  return [start, start + len]
}

function boxFrom(intervals: readonly Interval[]) {
  const min = intervals.map((iv) => iv[0]) as MutableVec3
  const max = intervals.map((iv) => iv[1]) as MutableVec3
  return { min, max }
}

const randomSide = (c: GenContext, pMin = 0.5): Side => (c.rng.chance(pMin) ? 'min' : 'max')
/** Strana v ose z: obvykle nahoře (tam je prvek vidět v nárysu i půdorysu). */
const zSide = (c: GenContext, pTop = 0.8): Side => (c.top || c.rng.chance(pTop) ? 'max' : 'min')

function corner(c: GenContext, id: string): Feature {
  const [lo, hi] = c.big ? [0.4, 0.6] : [0.25, 0.5]
  const sides: Side[] = [randomSide(c), randomSide(c, 0.7), zSide(c)]
  const ivs = ([0, 1, 2] as const).map((i) => oneSided(c, i, sides[i]!, lo, hi))
  return { kind: 'cutout', id, box: boxFrom(ivs) }
}

function pocket(c: GenContext, id: string): Feature | null {
  const n = c.top
    ? 2
    : c.rng.weighted<0 | 1 | 2>([
        [2, 0.6],
        [1, 0.25],
        [0, 0.15],
      ])
  const side: Side = n === 2 ? zSide(c, 0.85) : n === 1 ? randomSide(c, 0.75) : randomSide(c)
  const ivs: Interval[] = []
  for (const i of [0, 1, 2] as const) {
    if (i === n) ivs.push(oneSided(c, i, side, 0.25, 0.55))
    else {
      const iv = inner(c, i, 0.25, 0.5, { minLen: 6 })
      if (!iv) return null
      ivs.push(iv)
    }
  }
  return { kind: 'cutout', id, box: boxFrom(ivs) }
}

function step(c: GenContext, id: string): Feature {
  const along: Axis = c.top
    ? c.rng.pick(['x', 'y'] as const)
    : c.rng.weighted<Axis>([
        ['x', 0.45],
        ['y', 0.4],
        ['z', 0.15],
      ])
  const [lo, hi] = c.big ? [0.35, 0.55] : [0.25, 0.5]
  const ivs: Interval[] = []
  for (const i of [0, 1, 2] as const) {
    if (i === AXIS_INDEX[along]) ivs.push([0, c.size[i]])
    else ivs.push(oneSided(c, i, i === 2 ? zSide(c, 0.75) : randomSide(c, 0.6), lo, hi))
  }
  return { kind: 'step', id, box: boxFrom(ivs) }
}

function slot(c: GenContext, id: string): Feature | null {
  const along = c.rng.weighted<Axis>([
    ['x', 0.45],
    ['y', 0.4],
    ['z', 0.15],
  ])
  const others = otherAxes(along)
  let open: Axis
  if (along === 'z') open = c.rng.chance(0.7) ? 'y' : 'x'
  else open = c.top || c.rng.chance(0.65) ? 'z' : others[0] === 'z' ? others[1] : others[0]
  const side: Side = open === 'z' ? zSide(c, 0.85) : randomSide(c, open === 'y' ? 0.7 : 0.5)
  const ivs: Interval[] = []
  for (const axis of ['x', 'y', 'z'] as const) {
    const i = AXIS_INDEX[axis]
    if (axis === along) ivs.push([0, c.size[i]])
    else if (axis === open) ivs.push(oneSided(c, i, side, 0.25, 0.5))
    else {
      const iv = inner(c, i, 0.15, 0.35, { minLen: 6, centerChance: 0.4 })
      if (!iv) return null
      ivs.push(iv)
    }
  }
  return { kind: 'slot', id, box: boxFrom(ivs) }
}

function hole(c: GenContext, id: string, mode: 'through' | 'blind' | 'any'): Feature | null {
  const axis = c.rng.weighted<Axis>([
    ['z', 0.5],
    ['y', 0.3],
    ['x', 0.2],
  ])
  const [a, b] = otherAxes(axis)
  const ea = c.size[AXIS_INDEX[a]]
  const eb = c.size[AXIS_INDEX[b]]
  const maxD = Math.min(ea, eb) - 2 * MIN_WALL_MM - 4
  const diameters = HOLE_DIAMETERS.filter((d) => d <= maxD)
  if (diameters.length === 0) return null
  const diameter = c.rng.pick(diameters)
  const r = diameter / 2
  const at: number[] = []
  for (const axisName of [a, b]) {
    const i = AXIS_INDEX[axisName]
    const ext = c.size[i]
    const lo = r + MIN_WALL_MM
    const hi = ext - r - MIN_WALL_MM
    if (lo > hi) return null
    // přichycení: obrys díry na hraně jiného prvku
    const snapped = snapPick(
      c,
      featureLevels(c.existing, i)
        .flatMap((l) => [l - r, l + r])
        .filter((v) => v >= lo && v <= hi),
    )
    if (snapped !== null) at.push(snapped)
    else if (c.rng.chance(0.3) && Number.isInteger(ext / 2)) at.push(ext / 2)
    else at.push(c.rng.int(lo, hi))
  }
  const blind = mode === 'blind' || (mode === 'any' && c.rng.chance(0.4))
  const base = { kind: 'hole' as const, id, axis, at: [at[0]!, at[1]!] as const, diameter }
  if (!blind) return base
  const ext = c.size[AXIS_INDEX[axis]]
  const tip = drillPointHeight(diameter)
  const dLo = Math.max(MIN_FEATURE_MM, Math.ceil(0.3 * ext))
  const dHi = Math.floor(ext - MIN_WALL_MM - tip)
  if (dLo > dHi) return mode === 'blind' ? null : base
  const from: Side = axis === 'z' ? zSide(c, 0.8) : randomSide(c, axis === 'y' ? 0.7 : 0.5)
  return { ...base, depth: c.rng.int(dLo, dHi), from }
}

function chamfer(c: GenContext, id: string): Feature | null {
  const along = c.rng.weighted<Axis>([
    ['x', 0.4],
    ['y', 0.35],
    ['z', 0.25],
  ])
  const [a, b] = otherAxes(along)
  const sideFor = (axis: Axis): Side => (axis === 'z' ? zSide(c, 0.8) : randomSide(c, 0.6))
  const limit = Math.min(
    MAX_CHAMFER_MM,
    Math.floor(Math.min(c.size[AXIS_INDEX[a]], c.size[AXIS_INDEX[b]]) / 3),
  )
  if (limit < MIN_FEATURE_MM) return null
  const size = even(c.rng.int(MIN_FEATURE_MM, limit))
  return {
    kind: 'chamfer',
    id,
    along,
    edge: [sideFor(a), sideFor(b)],
    size: clamp(size, MIN_FEATURE_MM, limit),
  }
}

function rib(c: GenContext, id: string): Feature | null {
  const along = c.rng.pick([0, 1] as const)
  const across = along === 0 ? 1 : 0
  const thickness = c.rng.pick([4, 6, 8])
  const ivAcross = inner(c, across, 0, 0, { len: thickness, centerChance: 0.4 })
  const ivAlong = inner(c, along, 0.5, 0.85)
  if (!ivAcross || !ivAlong) return null
  const sz = c.size[2]
  const height = even(c.rng.int(8, Math.max(8, Math.min(24, sz))))
  const ivs: Interval[] = [
    [0, 0],
    [0, 0],
    [sz, sz + height],
  ]
  ivs[along] = ivAlong
  ivs[across] = ivAcross
  return { kind: 'rib', id, box: boxFrom(ivs) }
}

const ID_PREFIX: Readonly<Record<Feature['kind'], string>> = {
  hole: 'd',
  slot: 's',
  step: 'o',
  cutout: 'v',
  chamfer: 'z',
  rib: 'r',
}

/** Volné id prvku daného druhu (d1, d2, s1…). */
export function nextFeatureId(spec: PartSpec, kind: Feature['kind']): string {
  const used = new Set(spec.features.map((f) => f.id))
  for (let n = 1; ; n++) {
    const id = `${ID_PREFIX[kind]}${n}`
    if (!used.has(id)) return id
  }
}

const RECIPE_KIND: Readonly<Record<FeatureRecipe, Feature['kind']>> = {
  corner: 'cutout',
  pocket: 'cutout',
  step: 'step',
  slot: 'slot',
  throughHole: 'hole',
  blindHole: 'hole',
  anyHole: 'hole',
  chamfer: 'chamfer',
  rib: 'rib',
}

function makeFeature(c: GenContext, recipe: FeatureRecipe, id: string): Feature | null {
  switch (recipe) {
    case 'corner':
      return corner(c, id)
    case 'pocket':
      return pocket(c, id)
    case 'step':
      return step(c, id)
    case 'slot':
      return slot(c, id)
    case 'throughHole':
      return hole(c, id, 'through')
    case 'blindHole':
      return hole(c, id, 'blind')
    case 'anyHole':
      return hole(c, id, 'any')
    case 'chamfer':
      return chamfer(c, id)
    case 'rib':
      return rib(c, id)
  }
}

export type AddFeatureOptions = {
  readonly big?: boolean
  readonly top?: boolean
  readonly snap?: number
  readonly attempts?: number
}

/**
 * Přidá k součásti jeden prvek podle receptu tak, aby součást zůstala čitelná.
 * Vrací null, když se to nepodaří na daný počet pokusů.
 */
export function addRandomFeature(
  rng: Rng,
  spec: PartSpec,
  recipe: FeatureRecipe,
  opts: AddFeatureOptions = {},
): PartSpec | null {
  const c: GenContext = {
    rng,
    size: spec.base.size,
    existing: spec,
    big: opts.big ?? false,
    top: opts.top ?? false,
    snap: opts.snap ?? 0,
  }
  const id = nextFeatureId(spec, RECIPE_KIND[recipe])
  for (let attempt = 0; attempt < (opts.attempts ?? 25); attempt++) {
    const f = makeFeature(c, recipe, id)
    if (!f) continue
    const candidate: PartSpec = { ...spec, features: [...spec.features, f] }
    if (layoutOk(candidate)) return candidate
  }
  return null
}

/** Recepty prvků, ze kterých se losují „další“ prvky na dané obtížnosti. */
export const RECIPES_BY_DIFFICULTY: Readonly<
  Record<Difficulty, readonly (readonly [FeatureRecipe, number])[]>
> = {
  1: [
    ['corner', 1],
    ['step', 1],
  ],
  2: [
    ['corner', 1],
    ['step', 1],
    ['pocket', 0.6],
    ['slot', 1],
    ['throughHole', 1],
  ],
  3: [
    ['corner', 1],
    ['step', 1],
    ['pocket', 0.7],
    ['slot', 1],
    ['throughHole', 1],
    ['chamfer', 0.8],
  ],
  4: [
    ['corner', 1],
    ['step', 1],
    ['pocket', 0.8],
    ['slot', 1],
    ['anyHole', 1.2],
    ['chamfer', 0.7],
    ['rib', 0.4],
  ],
  5: [
    ['corner', 0.8],
    ['step', 1],
    ['pocket', 0.8],
    ['slot', 1],
    ['anyHole', 1.4],
    ['chamfer', 0.6],
    ['rib', 0.4],
  ],
}

/** Plán prvků pro obtížnost (povinné prvky první). */
function plan(rng: Rng, difficulty: Difficulty): FeatureRecipe[] {
  const extra = (n: number) =>
    Array.from({ length: n }, () => rng.weighted(RECIPES_BY_DIFFICULTY[difficulty]))
  switch (difficulty) {
    case 1:
      return [rng.pick(['corner', 'step'] as const)]
    case 2:
      return [
        rng.weighted<FeatureRecipe>([
          ['corner', 1],
          ['step', 1],
          ['pocket', 0.5],
        ]),
        rng.pick(['slot', 'throughHole'] as const),
      ]
    case 3:
      return [rng.pick(['throughHole', 'chamfer'] as const), ...extra(rng.int(1, 2))]
    case 4:
      return [
        rng.weighted<FeatureRecipe>([
          ['blindHole', 2],
          ['rib', 1],
        ]),
        ...extra(rng.int(2, 3)),
      ]
    case 5:
      return ['blindHole', 'anyHole', ...extra(rng.int(2, 3))]
  }
}

function randomBase(rng: Rng, difficulty: Difficulty): Vec3 {
  if (difficulty <= 2) return [5 * rng.int(12, 20), 5 * rng.int(8, 14), 5 * rng.int(6, 10)]
  return [5 * rng.int(10, 20), 5 * rng.int(8, 16), 5 * rng.int(6, 12)]
}

const MAX_RESTARTS = 60

/** Součást ze zadaného proudu náhodných čísel (používá i generátor úloh při zamítnutí součásti). */
export function generatePartWith(rng: Rng, difficulty: Difficulty, id: string): PartSpec {
  for (let restart = 0; restart < MAX_RESTARTS; restart++) {
    const recipes = plan(rng, difficulty)
    let spec: PartSpec = {
      id,
      base: { kind: 'block', size: randomBase(rng, difficulty) },
      features: [],
    }
    for (const recipe of recipes) {
      const next = addRandomFeature(rng, spec, recipe, {
        big: difficulty === 1,
        top: difficulty === 1,
        snap: difficulty === 5 ? 0.5 : difficulty === 4 ? 0.15 : 0,
      })
      if (!next) break
      spec = next
    }
    if (spec.features.length === recipes.length) return spec
  }
  // pojistka (v testech se nesmí stát): kvádr s výřezem v rohu
  return {
    id,
    base: { kind: 'block', size: [80, 50, 40] },
    features: [{ kind: 'cutout', id: 'v1', box: { min: [50, 0, 20], max: [80, 25, 40] } }],
  }
}

/** Náhodná, ale validní a čitelná součást. Id `gen-<obtížnost>-<seed>`. */
export function generatePart(seed: number, difficulty: Difficulty): PartSpec {
  const rng = createRng(deriveSeed(seed, difficulty, 0x9a27))
  return generatePartWith(rng, difficulty, `gen-${difficulty}-${seed}`)
}
