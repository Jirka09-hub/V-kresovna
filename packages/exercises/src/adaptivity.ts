/**
 * Jednoduchá adaptivita (docs/plan.md, 5.5; D-023). Čisté funkce bez enginu: dají se volat
 * v prohlížeči i na serveru (subpath `@vykresovna/exercises/adaptivity`).
 *
 * - `errorWeights`: četnost kódů chyb s exponenciálně klesající vahou starších pokusů,
 * - `nextDifficulty`: po sérii správných odpovědí obtížnost nahoru, po opakovaných chybách dolů,
 * - `pickNextTask`: další úloha lekce (typ, obtížnost, případně upřednostněný druh chyby).
 *
 * Výběr je deterministický ze (historie, seed).
 */
import { createRng, deriveSeed } from './rng'
import { ERROR_CODES, type Difficulty, type ErrorCode, type ExerciseKind } from './types'

/** Jeden pokus z historie (nic víc se pro adaptivitu nepotřebuje). */
export type AttemptRecord = {
  readonly kind: ExerciseKind
  readonly difficulty: Difficulty
  readonly correct: boolean
  readonly errorCodes: readonly ErrorCode[]
  /**
   * Pořadí nebo čas pokusu (vyšší = novější), ve stejných jednotkách jako `halfLife`.
   * Když chybí aspoň u jednoho pokusu, použije se pořadí v poli.
   */
  readonly at?: number
  /** Upřednostněný druh chyby úlohy (správná odpověď na takovou úlohu váhu chyby snižuje). */
  readonly focus?: ErrorCode
}

/** Co smí adaptivní výběr v lekci použít. */
export type AdaptivePlan = {
  readonly kinds: readonly ExerciseKind[]
  readonly minDifficulty: Difficulty
  readonly maxDifficulty: Difficulty
  /** Výchozí obtížnost, když historie nic neříká. */
  readonly baseDifficulty: Difficulty
}

export type AdaptiveOptions = {
  /** Poločas zapomínání: po kolika pokusech (nebo ms, když `at` je čas) klesne váha na polovinu. */
  readonly halfLife?: number
}

export type AdaptivePick = {
  readonly kind: ExerciseKind
  readonly difficulty: Difficulty
  /** Upřednostněný druh chyby pro generátor (jen u „najdi chybu“). */
  readonly focus?: ErrorCode
  /** 'weakness' = vybráno podle chyb uživatele, 'practice' = běžné procvičení. */
  readonly reason: 'weakness' | 'practice'
}

/** Parametry adaptivity (nejde o normy, jen o nastavení výuky). */
export const ADAPTIVITY = {
  /** Výchozí poločas v pokusech. */
  HALF_LIFE: 4,
  /** Kolik správných odpovědí v řadě zvýší obtížnost. */
  STREAK_UP: 3,
  /** Kolik chyb v řadě obtížnost sníží. */
  STREAK_DOWN: 2,
  /** Od jaké váhy se chyba bere jako slabina. */
  WEAKNESS_THRESHOLD: 0.5,
  /** Jak silně chyby táhnou výběr typu cvičení. */
  ERROR_BOOST: 2,
  /** Stejný typ jako minule dostane menší šanci (pestrost). */
  REPEAT_PENALTY: 0.6,
  /** Jakou část váhy chyby ubere správná odpověď na úlohu zaměřenou na tuto chybu. */
  MASTERY_CREDIT: 0.5,
} as const

/**
 * Kde se chyba procvičuje: typy cvičení a zda ji umí generátor „najdi chybu“ vyvolat záměrně
 * (`focus`). Soulad s generátorem hlídá test.
 */
export const ERROR_PRACTICE: Readonly<
  Record<ErrorCode, { readonly kinds: readonly ExerciseKind[]; readonly focus?: true }>
> = {
  LAYOUT_THIRD_ANGLE: { kinds: ['assign-views', 'find-error'], focus: true },
  TOP_SIDE_SWAPPED: { kinds: ['assign-views', 'find-error'], focus: true },
  VIEW_MISPLACED: { kinds: ['assign-views'] },
  VIEW_MISSING: { kinds: ['assign-views'] },
  HIDDEN_AS_VISIBLE: { kinds: ['find-error', 'missing-view'], focus: true },
  VISIBLE_AS_HIDDEN: { kinds: ['find-error', 'missing-view'], focus: true },
  MISSING_EDGE: { kinds: ['find-error', 'missing-view'], focus: true },
  EXTRA_EDGE: { kinds: ['find-error', 'missing-view'], focus: true },
  MIRRORED: { kinds: ['drawing-to-model', 'missing-view'] },
  FEATURE_SHIFTED: { kinds: ['drawing-to-model', 'missing-view'] },
  FEATURE_MISSING: { kinds: ['drawing-to-model', 'missing-view'] },
  FEATURE_EXTRA: { kinds: ['drawing-to-model', 'missing-view'] },
  FEATURE_RESIZED: { kinds: ['drawing-to-model', 'missing-view'] },
  THROUGH_VS_BLIND: { kinds: ['drawing-to-model', 'missing-view'] },
  MISSED_ERROR: { kinds: ['find-error'] },
  SECTION_HOLE_HATCHED: { kinds: ['section'] },
  SECTION_NOT_HATCHED: { kinds: ['section'] },
  WRONG_SECTION_PLANE: { kinds: ['section'] },
  SECTION_HIDDEN_EDGES: { kinds: ['section'] },
  SECTION_WRONG_DIRECTION: { kinds: ['section'] },
  DIMENSION_WRONG_FEATURE: { kinds: ['dimension'] },
  DIMENSION_NOT_COMBINED: { kinds: ['dimension'] },
  DIMENSION_ARITHMETIC: { kinds: ['dimension'] },
  DIMENSION_WRONG: { kinds: ['dimension'] },
}

const clampDifficulty = (d: number, lo: Difficulty, hi: Difficulty): Difficulty =>
  Math.min(hi, Math.max(lo, Math.round(d))) as Difficulty

/** Váha každého pokusu (1 = nejnovější, starší exponenciálně méně). */
function attemptWeights(history: readonly AttemptRecord[], halfLife: number): number[] {
  const n = history.length
  if (n === 0) return []
  const timed = history.every((h) => h.at !== undefined)
  const newest = timed ? Math.max(...history.map((h) => h.at!)) : n - 1
  return history.map((h, i) => {
    const age = Math.max(0, newest - (timed ? h.at! : i))
    return Math.pow(0.5, age / halfLife)
  })
}

/**
 * Váhy kódů chyb: každý pokus přispěje svou vahou (nejnovější 1, o poločas starší 0,5…) ke každému
 * svému kódu chyby. Správná odpověď na úlohu zaměřenou na kód váhu tohoto kódu sníží.
 */
export function errorWeights(
  history: readonly AttemptRecord[],
  options: AdaptiveOptions = {},
): Partial<Record<ErrorCode, number>> {
  const halfLife = options.halfLife ?? ADAPTIVITY.HALF_LIFE
  const weights = attemptWeights(history, halfLife)
  const out: Partial<Record<ErrorCode, number>> = {}
  // od nejstaršího: kredit za správnou odpověď smaže jen chyby, které jí předcházely
  history.forEach((h, i) => {
    const w = weights[i]!
    for (const code of new Set(h.errorCodes)) out[code] = (out[code] ?? 0) + w
    if (h.correct && h.focus && out[h.focus] !== undefined) {
      out[h.focus] = Math.max(0, out[h.focus]! - w * ADAPTIVITY.MASTERY_CREDIT)
    }
  })
  return out
}

/**
 * Obtížnost další úlohy daného typu: naposledy použitá obtížnost tohoto typu (jinak poslední
 * vůbec, jinak výchozí). Série správných odpovědí na aspoň této obtížnosti ji zvýší, série chyb
 * na nejvýš této obtížnosti sníží. Pokusy z dřívější úrovně se do série nepočítají, takže
 * obtížnost neskáče o víc než 1.
 */
export function nextDifficulty(
  history: readonly AttemptRecord[],
  kind: ExerciseKind,
  plan: Pick<AdaptivePlan, 'minDifficulty' | 'maxDifficulty' | 'baseDifficulty'>,
): Difficulty {
  const lastOfKind = [...history].reverse().find((h) => h.kind === kind)
  let level: number = lastOfKind?.difficulty ?? history.at(-1)?.difficulty ?? plan.baseDifficulty
  level = clampDifficulty(level, plan.minDifficulty, plan.maxDifficulty)
  const trailing = (pred: (h: AttemptRecord) => boolean) => {
    let n = 0
    for (let i = history.length - 1; i >= 0 && pred(history[i]!); i--) n++
    return n
  }
  const up = trailing((h) => h.correct && h.difficulty >= level)
  const down = trailing((h) => !h.correct && h.difficulty <= level)
  if (up >= ADAPTIVITY.STREAK_UP) level++
  else if (down >= ADAPTIVITY.STREAK_DOWN) level--
  return clampDifficulty(level, plan.minDifficulty, plan.maxDifficulty)
}

/**
 * Další úloha lekce. Typ cvičení se losuje (deterministicky ze seedu) s vahou podle chyb, které
 * se v něm procvičují; u „najdi chybu“ se navíc upřednostní nejčastější chyba, kterou umí
 * generátor vyvolat. Obtížnost podle `nextDifficulty`.
 */
export function pickNextTask(
  history: readonly AttemptRecord[],
  seed: number,
  plan: AdaptivePlan,
  options: AdaptiveOptions = {},
): AdaptivePick {
  if (plan.kinds.length === 0) throw new Error('adaptivní plán nemá žádný typ cvičení')
  const rng = createRng(deriveSeed(seed, history.length, 0xada9))
  const weights = errorWeights(history, options)
  const last = history.at(-1)
  const errorPull = (kind: ExerciseKind) =>
    ERROR_CODES.reduce(
      (sum, code) => sum + (ERROR_PRACTICE[code].kinds.includes(kind) ? (weights[code] ?? 0) : 0),
      0,
    )
  const scored = plan.kinds.map((kind) => {
    let score = 1 + ADAPTIVITY.ERROR_BOOST * errorPull(kind)
    if (last?.kind === kind && plan.kinds.length > 1) score *= ADAPTIVITY.REPEAT_PENALTY
    return [kind, score] as const
  })
  const kind = rng.weighted(scored)

  let focus: ErrorCode | undefined
  if (kind === 'find-error') {
    let best: number = ADAPTIVITY.WEAKNESS_THRESHOLD
    for (const code of ERROR_CODES) {
      const w = weights[code] ?? 0
      if (ERROR_PRACTICE[code].focus && w >= best && (focus === undefined || w > best)) {
        focus = code
        best = w
      }
    }
  }
  const weakness = focus !== undefined || errorPull(kind) >= ADAPTIVITY.WEAKNESS_THRESHOLD
  return {
    kind,
    difficulty: nextDifficulty(history, kind, plan),
    ...(focus ? { focus } : {}),
    reason: weakness ? 'weakness' : 'practice',
  }
}
