/**
 * Generátory úloh, distraktory a hodnocení s kódy chyb. Bez UI, bez DOM.
 *
 * POZOR: `generateTask` je zatím dočasná náhrada (distraktory z testovacích součástí); skutečný
 * generátor s kontrolou odlišnosti ho nahradí se stejnou signaturou.
 */
import { FIRST_ANGLE_LAYOUT, type GridPosition } from '@vykresovna/drafting-standards'
import { ENGINE_VERSION, TEST_PARTS } from '@vykresovna/engine'
import { generatePart } from './generator'
import { createRng } from './rng'
import type { ManifoldToplevel } from 'manifold-3d'
import type {
  Answer,
  ChoiceOption,
  Difficulty,
  ExerciseKind,
  Task,
  TaskError,
  TaskResult,
} from './types'

export * from './types'

export { createRng, deriveSeed, type Rng } from './rng'
export { generatePart, generatePartWith, type FeatureRecipe } from './generator'
export { layoutOk, MIN_FEATURE_MM, MIN_WALL_MM, HOLE_DIAMETERS } from './layout'
export {
  partMutations,
  mirrorPart,
  type PartMutation,
  type PartMutationKind,
} from './part-mutations'
export {
  applyDrawingMutation,
  drawingMutationCandidates,
  DRAWING_MUTATION_ERROR,
  type DrawingMutationCandidate,
} from './drawing-mutations'

/** Místa kolem nárysu v mřížce. */
const AROUND_FRONT: readonly GridPosition[] = [
  [0, 1],
  [-1, 0],
  [1, 0],
  [0, -1],
]

/** DOČASNÉ: úloha daného typu ze seedu. `wasm` bude skutečný generátor potřebovat pro kontrolu odlišnosti. */
export function generateTask(
  _wasm: ManifoldToplevel,
  kind: ExerciseKind,
  seed: number,
  difficulty: Difficulty,
): Task {
  const rng = createRng(seed)
  const part = generatePart(seed, difficulty)
  const meta = { seed, difficulty, engineVersion: ENGINE_VERSION }
  if (kind === 'assign-views') {
    const views = difficulty >= 3 ? (['top', 'left', 'right'] as const) : (['top', 'left'] as const)
    return {
      ...meta,
      kind,
      part,
      cards: rng.shuffle(views).map((view, i) => ({ id: `k${i + 1}`, view })),
      slots: AROUND_FRONT,
    }
  }
  const others = rng.shuffle(TEST_PARTS.filter((p) => p.id !== part.id)).slice(0, 3)
  const options: ChoiceOption[] = rng.shuffle([
    { id: 'correct', part, errorCode: null },
    ...others.map((p) => ({ id: p.id, part: p, errorCode: 'FEATURE_MISSING' as const })),
  ])
  const withIds = options.map((o, i) => ({ ...o, id: `m${i + 1}` }))
  if (kind === 'missing-view') {
    return {
      ...meta,
      kind,
      part,
      givenViews: ['front', 'top'],
      missingView: 'left',
      options: withIds,
    }
  }
  return { ...meta, kind, part, options: withIds }
}

const samePos = (a: GridPosition | null | undefined, b: GridPosition) =>
  !!a && a[0] === b[0] && a[1] === b[1]

/** Vyhodnocení odpovědi s kódy chyb. */
export function evaluate(task: Task, answer: Answer): TaskResult {
  if (task.kind === 'assign-views') {
    if (answer.kind !== 'assign-views') throw new Error('odpověď neodpovídá typu úlohy')
    const errors: TaskError[] = []
    let ok = 0
    for (const card of task.cards) {
      const placed = answer.placement[card.id] ?? null
      if (samePos(placed, FIRST_ANGLE_LAYOUT[card.view])) ok++
      else
        errors.push({
          code: placed ? 'VIEW_MISPLACED' : 'VIEW_MISSING',
          cardId: card.id,
          view: card.view,
        })
    }
    return { correct: errors.length === 0, score: ok / task.cards.length, errors }
  }
  if (answer.kind === 'assign-views') throw new Error('odpověď neodpovídá typu úlohy')
  const option = task.options.find((o) => o.id === answer.optionId)
  if (!option) throw new Error(`neznámá možnost ${answer.optionId}`)
  if (option.errorCode === null) return { correct: true, score: 1, errors: [] }
  const error: TaskError = option.featureId
    ? { code: option.errorCode, featureId: option.featureId }
    : { code: option.errorCode }
  return { correct: false, score: 0, errors: [error] }
}
