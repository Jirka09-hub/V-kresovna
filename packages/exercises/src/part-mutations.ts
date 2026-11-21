/**
 * Mutace tělesa pro distraktory: posun, odebrání, přidání prvku, zrcadlení součásti, průchozí ↔ slepá
 * díra, změna rozměru. Každá mutace vrací validní a čitelnou součást (layoutOk), kód chyby a prvek.
 * Zda je mutace ve výkresu opravdu vidět, rozhoduje až otisk výkresu (tasks.ts).
 */
import { drillPointHeight, type Vec3 } from '@vykresovna/drafting-standards'
import {
  AXIS_INDEX,
  otherAxes,
  type Axis,
  type Box,
  type Feature,
  type HoleFeature,
  type PartSpec,
} from '@vykresovna/engine'
import { addRandomFeature, RECIPES_BY_DIFFICULTY } from './generator'
import { boxPlacement, featureRegion, layoutOk, MIN_FEATURE_MM, MIN_WALL_MM } from './layout'
import type { Rng } from './rng'
import type { Difficulty, ErrorCode } from './types'

export type PartMutationKind = 'shift' | 'remove' | 'add' | 'mirror' | 'through-blind' | 'resize'

export type PartMutation = {
  readonly kind: PartMutationKind
  readonly part: PartSpec
  readonly errorCode: ErrorCode
  /** Prvek, kterého se chyba týká (u zrcadlení první prvek, který se zrcadlením změní). */
  readonly featureId?: string
  /** Hrubá (na první pohled viditelná) změna, nebo jemná. */
  readonly gross: boolean
}

const ERROR_BY_KIND: Readonly<Record<PartMutationKind, ErrorCode>> = {
  shift: 'FEATURE_SHIFTED',
  remove: 'FEATURE_MISSING',
  add: 'FEATURE_EXTRA',
  mirror: 'MIRRORED',
  'through-blind': 'THROUGH_VS_BLIND',
  resize: 'FEATURE_RESIZED',
}

type MutableVec3 = [number, number, number]
const even = (x: number) => 2 * Math.round(x / 2)

const withFeature = (spec: PartSpec, f: Feature): PartSpec => ({
  ...spec,
  features: spec.features.map((g) => (g.id === f.id ? f : g)),
})

const boxWith = (box: Box, i: number, lo: number, hi: number): Box => {
  const min = [...box.min] as MutableVec3
  const max = [...box.max] as MutableVec3
  min[i] = lo
  max[i] = hi
  return { min, max }
}

const flip = (side: 'min' | 'max'): 'min' | 'max' => (side === 'min' ? 'max' : 'min')

/** Zrcadlení součásti podle střední roviny kolmé na osu x (0) nebo y (1). */
export function mirrorPart(spec: PartSpec, axis: 0 | 1): PartSpec {
  const ext = spec.base.size[axis]
  const axisName: Axis = axis === 0 ? 'x' : 'y'
  const features = spec.features.map((f): Feature => {
    switch (f.kind) {
      case 'hole': {
        if (f.axis === axisName) return f.from ? { ...f, from: flip(f.from) } : f
        const k = otherAxes(f.axis).indexOf(axisName)
        const at: [number, number] = [f.at[0], f.at[1]]
        at[k] = ext - at[k]!
        return { ...f, at }
      }
      case 'chamfer': {
        if (f.along === axisName) return f
        const k = otherAxes(f.along).indexOf(axisName)
        const edge: ['min' | 'max', 'min' | 'max'] = [f.edge[0], f.edge[1]]
        edge[k] = flip(edge[k]!)
        return { ...f, edge }
      }
      default:
        return { ...f, box: boxWith(f.box, axis, ext - f.box.max[axis], ext - f.box.min[axis]) }
    }
  })
  return { ...spec, features }
}

type Candidate = { kind: PartMutationKind; part: PartSpec; featureId?: string; gross: boolean }

/** Velký posun: aspoň čtvrtina rozměru, nejméně 8 mm. */
const grossDelta = (ext: number) => Math.max(8, even(ext * 0.25))
const SUBTLE_DELTAS = [MIN_FEATURE_MM, MIN_FEATURE_MM + 2]

function shiftCandidates(spec: PartSpec, f: Feature): Candidate[] {
  const size = spec.base.size
  const out: Candidate[] = []
  const push = (g: Feature, gross: boolean) =>
    out.push({ kind: 'shift', part: withFeature(spec, g), featureId: f.id, gross })
  switch (f.kind) {
    case 'hole': {
      otherAxes(f.axis).forEach((axis, k) => {
        const ext = size[AXIS_INDEX[axis]]
        const moveTo = (v: number, gross: boolean) => {
          const at: [number, number] = [f.at[0], f.at[1]]
          at[k] = v
          push({ ...f, at }, gross)
        }
        for (const d of SUBTLE_DELTAS) for (const s of [-1, 1]) moveTo(f.at[k]! + s * d, false)
        for (const s of [-1, 1]) moveTo(f.at[k]! + s * grossDelta(ext), true)
        if (Math.abs(ext - 2 * f.at[k]!) >= 8) moveTo(ext - f.at[k]!, true)
      })
      break
    }
    case 'chamfer':
      for (const k of [0, 1] as const) {
        const edge: ['min' | 'max', 'min' | 'max'] = [f.edge[0], f.edge[1]]
        edge[k] = flip(edge[k])
        push({ ...f, edge }, true)
      }
      break
    default: {
      const placement =
        f.kind === 'rib' ? (['inner', 'inner', 'span'] as const) : boxPlacement(f.box, size as Vec3)
      placement.forEach((p, i) => {
        const ext = size[i]!
        const lo = f.box.min[i]!
        const hi = f.box.max[i]!
        if (p === 'inner') {
          for (const d of SUBTLE_DELTAS) {
            for (const s of [-1, 1])
              push({ ...f, box: boxWith(f.box, i, lo + s * d, hi + s * d) }, false)
          }
          for (const s of [-1, 1]) {
            const d = grossDelta(ext)
            push({ ...f, box: boxWith(f.box, i, lo + s * d, hi + s * d) }, true)
          }
        } else if (p === 'min' || p === 'max') {
          // přemístění k protější stěně (např. osazení zepředu dozadu)
          push({ ...f, box: boxWith(f.box, i, ext - hi, ext - lo) }, true)
        }
      })
    }
  }
  return out
}

function resizeCandidates(spec: PartSpec, f: Feature): Candidate[] {
  const size = spec.base.size
  const out: Candidate[] = []
  const push = (g: Feature, gross: boolean) =>
    out.push({ kind: 'resize', part: withFeature(spec, g), featureId: f.id, gross })
  switch (f.kind) {
    case 'hole':
      for (const d of [-4, -2, 2, 4]) push({ ...f, diameter: f.diameter + d }, Math.abs(d) >= 4)
      if (f.depth !== undefined) {
        for (const d of [-8, -4, 4, 8]) push({ ...f, depth: f.depth + d }, Math.abs(d) >= 8)
      }
      break
    case 'chamfer':
      for (const d of [-4, -2, 2, 4]) push({ ...f, size: f.size + d }, Math.abs(d) >= 4)
      break
    default: {
      const placement =
        f.kind === 'rib' ? (['inner', 'inner', 'max'] as const) : boxPlacement(f.box, size)
      placement.forEach((p, i) => {
        if (p === 'span') return
        const lo = f.box.min[i]!
        const hi = f.box.max[i]!
        const len = hi - lo
        const deltas = [...SUBTLE_DELTAS, Math.max(8, even(len * 0.4))]
        for (const d of deltas) {
          for (const s of [-1, 1]) {
            const gross = d >= 8
            // u stěny se mění jen vnitřní konec, uvnitř se mění konec „max“
            if (p === 'max' && f.kind !== 'rib') {
              push({ ...f, box: boxWith(f.box, i, lo - s * d, hi) }, gross)
            } else push({ ...f, box: boxWith(f.box, i, lo, hi + s * d) }, gross)
          }
        }
      })
    }
  }
  return out
}

function throughBlindCandidates(spec: PartSpec, f: HoleFeature): Candidate[] {
  const out: Candidate[] = []
  const push = (g: HoleFeature) =>
    out.push({ kind: 'through-blind', part: withFeature(spec, g), featureId: f.id, gross: false })
  if (f.depth !== undefined) {
    push({ kind: 'hole', id: f.id, axis: f.axis, at: f.at, diameter: f.diameter })
    return out
  }
  const ext = spec.base.size[AXIS_INDEX[f.axis]]
  const maxDepth = Math.floor(ext - MIN_WALL_MM - drillPointHeight(f.diameter))
  for (const from of ['min', 'max'] as const) {
    for (const frac of [0.4, 0.6]) {
      const depth = Math.min(maxDepth, Math.max(MIN_FEATURE_MM, Math.round(ext * frac)))
      push({ ...f, depth, from })
    }
  }
  return out
}

const specKey = (spec: PartSpec) => JSON.stringify([spec.base, spec.features])

/**
 * Všechny platné mutace součásti v náhodném pořadí (deterministicky z rng). Shodné výsledky
 * (stejný popis součásti) se vynechají.
 */
export function partMutations(rng: Rng, spec: PartSpec, difficulty: Difficulty): PartMutation[] {
  const candidates: Candidate[] = []
  for (const f of spec.features) {
    candidates.push(
      {
        kind: 'remove',
        part: { ...spec, features: spec.features.filter((g) => g !== f) },
        featureId: f.id,
        gross: true,
      },
      ...shiftCandidates(spec, f),
      ...resizeCandidates(spec, f),
    )
    if (f.kind === 'hole') candidates.push(...throughBlindCandidates(spec, f))
  }
  for (const axis of [0, 1] as const) {
    const part = mirrorPart(spec, axis)
    const size = spec.base.size
    const changed = spec.features.find(
      (f, i) =>
        JSON.stringify(featureRegion(f, size)) !==
        JSON.stringify(featureRegion(part.features[i]!, size)),
    )
    candidates.push({ kind: 'mirror', part, featureId: changed?.id, gross: true })
  }
  for (let i = 0; i < 2; i++) {
    const recipe = rng.weighted(RECIPES_BY_DIFFICULTY[difficulty])
    const part = addRandomFeature(rng, spec, recipe, { attempts: 10 })
    if (part) {
      candidates.push({
        kind: 'add',
        part,
        featureId: part.features[part.features.length - 1]!.id,
        gross: true,
      })
    }
  }

  const original = specKey(spec)
  const seen = new Set<string>([original])
  const out: PartMutation[] = []
  for (const c of candidates) {
    const key = specKey(c.part)
    if (seen.has(key) || !layoutOk(c.part)) continue
    seen.add(key)
    out.push({
      kind: c.kind,
      part: c.part,
      errorCode: ERROR_BY_KIND[c.kind],
      ...(c.featureId ? { featureId: c.featureId } : {}),
      gross: c.gross,
    })
  }
  // zamíchat a pak střídat druhy mutací, aby distraktory nebyly všechny stejného druhu
  const byKind = new Map<PartMutationKind, PartMutation[]>()
  for (const m of rng.shuffle(out)) {
    const list = byKind.get(m.kind)
    if (list) list.push(m)
    else byKind.set(m.kind, [m])
  }
  const queues = rng.shuffle([...byKind.values()])
  const mixed: PartMutation[] = []
  while (mixed.length < out.length) {
    for (const q of queues) {
      const m = q.shift()
      if (m) mixed.push(m)
    }
  }
  return mixed
}
