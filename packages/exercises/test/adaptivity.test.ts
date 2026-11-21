import { describe, expect, it } from 'vitest'
import {
  ADAPTIVITY,
  errorWeights,
  nextDifficulty,
  pickNextTask,
  type AdaptivePlan,
  type AttemptRecord,
} from '../src/adaptivity'
import type { Difficulty, ErrorCode, ExerciseKind } from '../src/types'
import { seeds } from './helpers'

const ok = (kind: ExerciseKind, difficulty: Difficulty, extra: Partial<AttemptRecord> = {}) =>
  ({ kind, difficulty, correct: true, errorCodes: [], ...extra }) as AttemptRecord
const bad = (
  kind: ExerciseKind,
  difficulty: Difficulty,
  codes: ErrorCode[],
  extra: Partial<AttemptRecord> = {},
) => ({ kind, difficulty, correct: false, errorCodes: codes, ...extra }) as AttemptRecord

const PLAN: AdaptivePlan = {
  kinds: ['find-error', 'missing-view', 'drawing-to-model'],
  minDifficulty: 1,
  maxDifficulty: 5,
  baseDifficulty: 2,
}

describe('váhy kódů chyb', () => {
  it('nejnovější pokus má váhu 1, o poločas starší polovinu', () => {
    const h = [
      bad('find-error', 2, ['MISSING_EDGE']),
      ...Array.from({ length: ADAPTIVITY.HALF_LIFE - 1 }, () => ok('find-error', 2)),
      bad('find-error', 2, ['HIDDEN_AS_VISIBLE', 'HIDDEN_AS_VISIBLE']),
    ]
    const w = errorWeights(h)
    expect(w.HIDDEN_AS_VISIBLE).toBeCloseTo(1) // stejný kód v pokusu se počítá jednou
    expect(w.MISSING_EDGE).toBeCloseTo(0.5)
    expect(w.MIRRORED).toBeUndefined()
  })

  it('umí i časová razítka (poločas v ms)', () => {
    const h = [
      bad('missing-view', 2, ['MIRRORED'], { at: 0 }),
      bad('missing-view', 2, ['FEATURE_SHIFTED'], { at: 60_000 }),
    ]
    const w = errorWeights(h, { halfLife: 30_000 })
    expect(w.FEATURE_SHIFTED).toBeCloseTo(1)
    expect(w.MIRRORED).toBeCloseTo(0.25)
  })

  it('správná odpověď na úlohu zaměřenou na chybu váhu sníží', () => {
    const h = [
      bad('find-error', 3, ['HIDDEN_AS_VISIBLE', 'MISSED_ERROR']),
      ok('find-error', 3, { focus: 'HIDDEN_AS_VISIBLE' }),
    ]
    const w = errorWeights(h)
    expect(w.HIDDEN_AS_VISIBLE!).toBeLessThan(w.MISSED_ERROR! - 0.4)
    expect(w.HIDDEN_AS_VISIBLE!).toBeGreaterThanOrEqual(0)
  })
})

describe('obtížnost', () => {
  it('bez historie výchozí, po třech správných nahoru, po dvou chybách dolů', () => {
    expect(nextDifficulty([], 'find-error', PLAN)).toBe(2)
    const up = [ok('find-error', 2), ok('missing-view', 2), ok('find-error', 2)]
    expect(nextDifficulty(up, 'find-error', PLAN)).toBe(3)
    expect(nextDifficulty(up.slice(1), 'find-error', PLAN)).toBe(2)
    const down = [bad('find-error', 3, ['MISSING_EDGE']), bad('find-error', 3, ['EXTRA_EDGE'])]
    expect(nextDifficulty(down, 'find-error', PLAN)).toBe(2)
  })

  it('po změně se série počítá znovu (neskáče o víc než 1)', () => {
    const h = [ok('find-error', 2), ok('find-error', 2), ok('find-error', 2), ok('find-error', 3)]
    expect(nextDifficulty(h, 'find-error', PLAN)).toBe(3)
    const d = [
      bad('find-error', 3, ['MISSING_EDGE']),
      bad('find-error', 3, ['MISSING_EDGE']),
      bad('find-error', 2, ['MISSING_EDGE']),
    ]
    expect(nextDifficulty(d, 'find-error', PLAN)).toBe(2)
  })

  it('drží se rozsahu plánu', () => {
    const plan = { ...PLAN, minDifficulty: 2 as const, maxDifficulty: 3 as const }
    const many = Array.from({ length: 6 }, () => ok('find-error', 3))
    expect(nextDifficulty(many, 'find-error', plan)).toBe(3)
    const wrong = Array.from({ length: 4 }, () => bad('find-error', 2, ['MISSING_EDGE']))
    expect(nextDifficulty(wrong, 'find-error', plan)).toBe(2)
    expect(nextDifficulty([ok('find-error', 5)], 'find-error', plan)).toBe(3)
  })
})

describe('výběr další úlohy', () => {
  it('je deterministický z historie a seedu', () => {
    const h = [bad('find-error', 2, ['HIDDEN_AS_VISIBLE']), ok('missing-view', 2)]
    for (const s of seeds(20)) expect(pickNextTask(h, s, PLAN)).toEqual(pickNextTask(h, s, PLAN))
  })

  it('bez historie: běžné procvičení na výchozí obtížnosti, všechny typy', () => {
    const picks = seeds(60).map((s) => pickNextTask([], s, PLAN))
    expect(picks.every((p) => p.reason === 'practice' && p.difficulty === 2)).toBe(true)
    expect(new Set(picks.map((p) => p.kind))).toEqual(new Set(PLAN.kinds))
    expect(picks.every((p) => p.focus === undefined)).toBe(true)
  })

  it('opakované plety skrytých hran → víc „najdi chybu“ se skrytou hranou plnou čarou', () => {
    const h = [
      bad('find-error', 3, ['HIDDEN_AS_VISIBLE', 'MISSED_ERROR']),
      ok('drawing-to-model', 3),
      bad('find-error', 3, ['HIDDEN_AS_VISIBLE', 'MISSED_ERROR']),
      ok('drawing-to-model', 3),
    ]
    const picks = seeds(100).map((s) => pickNextTask(h, s, PLAN))
    const findError = picks.filter((p) => p.kind === 'find-error')
    expect(findError.length).toBeGreaterThan(60)
    expect(findError.every((p) => p.focus === 'HIDDEN_AS_VISIBLE' && p.reason === 'weakness')).toBe(
      true,
    )
    // „výkres → model“ to netrénuje
    expect(picks.filter((p) => p.kind === 'drawing-to-model').length).toBeLessThan(15)
  })

  it('chyby z modelu táhnou k „výkres → model“ a „chybějící pohled“', () => {
    const h = [
      ok('find-error', 2),
      bad('drawing-to-model', 2, ['MIRRORED']),
      bad('drawing-to-model', 2, ['FEATURE_SHIFTED']),
    ]
    const picks = seeds(100).map((s) => pickNextTask(h, s, PLAN))
    expect(picks.filter((p) => p.kind !== 'find-error').length).toBeGreaterThan(80)
    // dvě chyby v řadě → o stupeň lehčí
    expect(picks.find((p) => p.kind === 'drawing-to-model')?.difficulty).toBe(1)
  })

  it('jen typy z plánu; focus jen u „najdi chybu“', () => {
    const plan: AdaptivePlan = { ...PLAN, kinds: ['missing-view'] }
    const h = [bad('find-error', 3, ['EXTRA_EDGE'])]
    for (const s of seeds(20)) {
      const p = pickNextTask(h, s, plan)
      expect(p.kind).toBe('missing-view')
      expect(p.focus).toBeUndefined()
      expect(p.reason).toBe('weakness')
    }
    expect(() => pickNextTask(h, 1, { ...PLAN, kinds: [] })).toThrow()
  })

  it('stará chyba vyprchá: po mnoha správných odpovědích už nejde o slabinu', () => {
    const h = [
      bad('find-error', 2, ['MISSING_EDGE']),
      ...Array.from({ length: 12 }, () => ok('missing-view', 3)),
    ]
    const p = pickNextTask(h, 5, { ...PLAN, kinds: ['find-error'] })
    expect(p.focus).toBeUndefined()
    expect(p.reason).toBe('practice')
  })
})
