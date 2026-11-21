/**
 * Generátory úloh, distraktory a hodnocení s kódy chyb. Bez UI, bez DOM.
 *
 * POZOR: generátor je zatím jen dočasná náhrada (vybírá z testovacích součástí), aby se dalo stavět UI.
 * Skutečný generátor součástí a distraktorů s kontrolou odlišnosti nahradí `generateTask`
 * a `generatePart` se stejnými signaturami.
 */
import { FIRST_ANGLE_LAYOUT, type GridPosition } from '@vykresovna/drafting-standards'
import { ENGINE_VERSION, TEST_PARTS, type Drawing, type PartSpec } from '@vykresovna/engine'
import type { ManifoldToplevel } from 'manifold-3d'
import type {
  Answer,
  ChoiceOption,
  Difficulty,
  DrawingMutation,
  ExerciseKind,
  Task,
  TaskError,
  TaskResult,
} from './types'

export * from './types'

/** Deterministický generátor náhodných čísel (mulberry32). */
export function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    shuffle: <T>(items: readonly T[]): T[] => {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j]!, out[i]!]
      }
      return out
    },
  }
}
export type Rng = ReturnType<typeof createRng>

/** DOČASNÉ: součást podle seedu z testovacích součástí. */
export function generatePart(seed: number, _difficulty: Difficulty): PartSpec {
  return TEST_PARTS[Math.abs(seed) % TEST_PARTS.length]!
}

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

/** Použije mutaci výkresu na pohled (DOČASNÉ: zatím beze změny). */
export function applyDrawingMutation(drawing: Drawing, _mutation: DrawingMutation): Drawing {
  return drawing
}
