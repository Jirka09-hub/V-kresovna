/**
 * Cvičení 6 „Odečti kótu“ (D-024): zakótovaný výkres (kóty z `partDimensions`, rozmístěné enginem),
 * otázka slovy na jednu hodnotu, odpověď celé číslo v mm (tolerance 0). U obtížnosti 4–5 se část
 * otázek ptá na rozměr, který na výkrese není a musí se spočítat ze dvou nebo tří kót.
 */
import {
  AXIS_INDEX,
  buildPart,
  createDrawing,
  partBounds,
  type Axis,
  type DrawingDimension,
  type Feature,
  type PartSpec,
} from '@vykresovna/engine'
import type { ManifoldToplevel } from 'manifold-3d'
import type { Rng } from './rng'
import type {
  Difficulty,
  DimensionAnswer,
  DimensionFeatureKind,
  DimensionQuestion,
  DimensionQuestionKind,
  DimensionTask,
  DrawingDimensionRef,
  PartWall,
  TaskResult,
} from './types'

/** Stěna na straně menších (min) a větších (max) souřadnic osy. */
export const WALLS: Readonly<Record<Axis, { readonly min: PartWall; readonly max: PartWall }>> = {
  x: { min: 'left', max: 'right' },
  y: { min: 'front', max: 'back' },
  z: { min: 'bottom', max: 'top' },
}

type Candidate = {
  readonly question: DimensionQuestion
  readonly answer: number
  readonly dimensionIds: readonly string[]
  readonly combined: boolean
}

type Built<T> = Omit<T, 'seed' | 'difficulty' | 'engineVersion'>

/** Osa z id kóty (`dim:<prvek>:<role>:<osa>`), pokud ji id má. */
function axisOf(id: string): Axis | null {
  const last = id.split(':').pop()
  return last === 'x' || last === 'y' || last === 'z' ? last : null
}

const featureKindOf = (f: Feature): DimensionFeatureKind => f.kind

/** Prvek se dotýká stěny na straně min / max dané osy? */
function touches(
  f: Feature & { box: { min: readonly number[]; max: readonly number[] } },
  i: number,
  size: readonly number[],
) {
  return { min: f.box.min[i]! <= 1e-9, max: f.box.max[i]! >= size[i]! - 1e-9 }
}

/** Otázky, na které jde odpovědět přímo jednou kótou z výkresu. */
function directCandidates(spec: PartSpec, dims: readonly DrawingDimension[]): Candidate[] {
  const out: Candidate[] = []
  const size = spec.base.size
  const feature = (id: string | null) => spec.features.find((f) => f.id === id)
  for (const d of dims) {
    if (!Number.isInteger(d.value) || d.value <= 0) continue
    const axis = axisOf(d.id)
    const f = feature(d.featureId)
    let question: DimensionQuestion | null = null
    switch (d.role) {
      case 'overall':
        if (axis) question = { kind: 'overall', featureId: null, axis }
        break
      case 'base':
        if (axis === 'z') question = { kind: 'baseThickness', featureId: null, axis }
        break
      case 'diameter':
        if (f) question = { kind: 'diameter', featureId: f.id, featureKind: 'hole' }
        break
      case 'depth':
        if (f) question = { kind: 'holeDepth', featureId: f.id, featureKind: 'hole' }
        break
      case 'chamfer':
        if (f) question = { kind: 'chamfer', featureId: f.id, featureKind: 'chamfer' }
        break
      case 'size': {
        if (!f || !axis || !('box' in f)) break
        let kind: DimensionQuestionKind = 'size'
        if (f.kind === 'slot') {
          const t = touches(f, AXIS_INDEX[axis], size)
          kind = t.min !== t.max ? 'slotDepth' : 'slotWidth'
        }
        question = { kind, featureId: f.id, featureKind: featureKindOf(f), axis }
        break
      }
      case 'position':
        if (!f || !axis) break
        question = {
          kind: f.kind === 'hole' ? 'holePosition' : 'featurePosition',
          featureId: f.id,
          featureKind: featureKindOf(f),
          axis,
          wall: WALLS[axis].min,
        }
        break
    }
    if (question) out.push({ question, answer: d.value, dimensionIds: [d.id], combined: false })
  }
  return out
}

/** Otázky, na které je potřeba spočítat rozměr ze dvou nebo tří kót (hodnota na výkrese není). */
function combinedCandidates(
  spec: PartSpec,
  dims: readonly DrawingDimension[],
  difficulty: Difficulty,
): Candidate[] {
  const out: Candidate[] = []
  const size = spec.base.size
  const bounds = partBounds(spec)
  const byId = new Map(dims.map((d) => [d.id, d]))
  const values = new Set(dims.map((d) => d.value))
  const ok = (answer: number) => Number.isInteger(answer) && answer > 0 && !values.has(answer)
  for (const axis of ['x', 'y', 'z'] as const) {
    const i = AXIS_INDEX[axis]
    const overall = byId.get(`dim:part:overall:${axis}`)
    // jen osy, ve kterých je součást celá ze základního kvádru (žebro by „stěnu“ znejasnilo)
    if (!overall || bounds.min[i]! !== 0 || bounds.max[i]! !== size[i]) continue
    for (const f of spec.features) {
      if (f.kind === 'hole') {
        const pos = byId.get(`dim:${f.id}:position:${axis}`)
        if (!pos) continue
        const answer = size[i]! - pos.value
        if (ok(answer)) {
          out.push({
            question: {
              kind: 'holeFromFar',
              featureId: f.id,
              featureKind: 'hole',
              axis,
              wall: WALLS[axis].max,
            },
            answer,
            dimensionIds: [overall.id, pos.id],
            combined: true,
          })
        }
        continue
      }
      if (f.kind !== 'slot' && f.kind !== 'step' && f.kind !== 'cutout') continue
      const sizeDim = byId.get(`dim:${f.id}:size:${axis}`)
      if (!sizeDim) continue
      const t = touches(f, i, size)
      if (t.min !== t.max) {
        // prvek u jedné stěny: kolik materiálu zbývá k protější stěně
        const answer = size[i]! - sizeDim.value
        if (ok(answer)) {
          out.push({
            question: {
              kind: 'wallBeyond',
              featureId: f.id,
              featureKind: f.kind,
              axis,
              wall: t.max ? WALLS[axis].min : WALLS[axis].max,
            },
            answer,
            dimensionIds: [overall.id, sizeDim.id],
            combined: true,
          })
        }
      } else if (!t.min && !t.max && difficulty >= 5) {
        // prvek uvnitř: vzdálenost od vzdálenější stěny ze tří kót
        const pos = byId.get(`dim:${f.id}:position:${axis}`)
        if (!pos) continue
        const answer = size[i]! - pos.value - sizeDim.value
        if (ok(answer)) {
          out.push({
            question: {
              kind: 'featureFromFar',
              featureId: f.id,
              featureKind: f.kind,
              axis,
              wall: WALLS[axis].max,
            },
            answer,
            dimensionIds: [overall.id, pos.id, sizeDim.id],
            combined: true,
          })
        }
      }
    }
  }
  return out
}

/** Váha otázky podle obtížnosti (lehčí obtížnosti se ptají na výrazné rozměry). */
function weight(c: Candidate, difficulty: Difficulty): number {
  const k = c.question.kind
  if (difficulty === 1) return k === 'overall' ? 1 : k === 'size' || k === 'slotDepth' ? 2 : 0.5
  if (difficulty === 2) return k === 'overall' ? 0.5 : 1
  if (k === 'overall') return 0.25
  if (k === 'featureFromFar') return 2
  return 1
}

/** Pravděpodobnost složené otázky podle obtížnosti (když nějaká jde položit). */
const COMBINED_CHANCE: Readonly<Record<Difficulty, number>> = {
  1: 0,
  2: 0,
  3: 0,
  4: 0.6,
  5: 0.85,
}

/** Kóty výkresu tak, jak je uvidí uživatel (výkres nárys, půdorys, bokorys s kótami). */
export function drawingDimensionsOf(wasm: ManifoldToplevel, part: PartSpec): DrawingDimension[] {
  const drawing = createDrawing(part, buildPart(wasm, part), { dimensions: true })
  return drawing.views.flatMap((v) => v.dimensions ?? [])
}

/** Úloha „odečti kótu“ pro součást (null = pro ni nejde položit vhodnou otázku). */
export function buildDimensionTask(
  wasm: ManifoldToplevel,
  rng: Rng,
  part: PartSpec,
  difficulty: Difficulty,
): Built<DimensionTask> | null {
  const dims = drawingDimensionsOf(wasm, part)
  const direct = directCandidates(part, dims)
  const combined = difficulty >= 4 ? combinedCandidates(part, dims, difficulty) : []
  const useCombined = combined.length > 0 && rng.chance(COMBINED_CHANCE[difficulty])
  const pool = (useCombined ? combined : direct).filter((c) => weight(c, difficulty) > 0)
  if (pool.length === 0) return null
  const c = rng.weighted(pool.map((x) => [x, weight(x, difficulty)] as const))
  const drawingDimensions: DrawingDimensionRef[] = dims.map((d) => ({
    id: d.id,
    value: d.value,
    featureId: d.featureId,
  }))
  return {
    kind: 'dimension',
    part,
    question: c.question,
    answer: c.answer,
    dimensionIds: c.dimensionIds,
    combined: c.combined,
    drawingDimensions,
  }
}

/** Hodnocení zapsaného čísla (tolerance 0). */
export function evaluateDimension(task: DimensionTask, answer: DimensionAnswer): TaskResult {
  const value = answer.value
  if (value === task.answer) return { correct: true, score: 1, errors: [] }
  const operands = task.drawingDimensions.filter((d) => task.dimensionIds.includes(d.id))
  const others = task.drawingDimensions.filter((d) => !task.dimensionIds.includes(d.id))
  const code =
    task.combined && operands.some((d) => d.value === value)
      ? 'DIMENSION_NOT_COMBINED'
      : others.some((d) => d.value === value)
        ? 'DIMENSION_WRONG_FEATURE'
        : task.combined
          ? 'DIMENSION_ARITHMETIC'
          : 'DIMENSION_WRONG'
  return {
    correct: false,
    score: 0,
    errors: [{ code, ...(task.question.featureId ? { featureId: task.question.featureId } : {}) }],
  }
}
