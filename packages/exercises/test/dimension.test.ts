import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { ENGINE_VERSION, loadManifold } from '@vykresovna/engine'
import {
  DIFFICULTIES,
  drawingDimensionsOf,
  evaluate,
  evaluateDimension,
  generateTask,
  type DimensionTask,
} from '../src'
import { seeds } from './helpers'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await loadManifold()
})

const SEEDS = seeds(16)

function dimension(seed: number, d: (typeof DIFFICULTIES)[number]): DimensionTask {
  const t = generateTask(wasm, 'dimension', seed, d)
  if (t.kind !== 'dimension') throw new Error('špatný typ úlohy')
  return t
}

const answer = (t: DimensionTask, value: number) => evaluate(t, { kind: 'dimension', value })

describe('cvičení „odečti kótu“', () => {
  for (const d of DIFFICULTIES) {
    it(`obtížnost ${d}: odpověď je celé číslo z kót výkresu, hodnocení sedí`, () => {
      for (const seed of SEEDS) {
        const t = dimension(seed, d)
        expect(t.engineVersion).toBe(ENGINE_VERSION)
        expect(Number.isInteger(t.answer)).toBe(true)
        expect(t.answer).toBeGreaterThan(0)
        // kóty v úloze jsou přesně kóty výkresu, který uživatel uvidí
        const drawn = drawingDimensionsOf(wasm, t.part)
        expect(t.drawingDimensions.map((x) => x.id)).toEqual(drawn.map((x) => x.id))
        const ids = new Set(drawn.map((x) => x.id))
        for (const id of t.dimensionIds) expect(ids, id).toContain(id)
        if (t.question.featureId) {
          expect(t.part.features.map((f) => f.id)).toContain(t.question.featureId)
        }
        const values = t.drawingDimensions.map((x) => x.value)
        if (t.combined) {
          // složená otázka: hodnota sama na výkrese není, počítá se ze 2–3 kót
          expect(d).toBeGreaterThanOrEqual(4)
          expect(t.dimensionIds.length).toBeGreaterThanOrEqual(2)
          expect(values).not.toContain(t.answer)
        } else {
          expect(t.dimensionIds).toHaveLength(1)
          const dim = t.drawingDimensions.find((x) => x.id === t.dimensionIds[0])!
          expect(dim.value).toBe(t.answer)
        }
        expect(answer(t, t.answer)).toEqual({ correct: true, score: 1, errors: [] })
        const wrong = answer(t, t.answer + 1)
        expect(wrong.correct).toBe(false)
        expect(wrong.errors).toHaveLength(1)
      }
    })
  }

  it('obtížnost 4–5 klade i složené otázky, 1–3 jen přímé', () => {
    const combined = new Set<string>()
    for (const seed of SEEDS) {
      for (const d of [1, 2, 3] as const) expect(dimension(seed, d).combined).toBe(false)
      for (const d of [4, 5] as const) {
        const t = dimension(seed, d)
        if (t.combined) combined.add(t.question.kind)
      }
    }
    expect(combined.size).toBeGreaterThanOrEqual(2)
  })

  it('je deterministická ze seedu a obtížnosti', () => {
    expect(dimension(77, 4)).toEqual(dimension(77, 4))
  })

  it('kódy chyb: jiná kóta, jen jedna z kót, početní chyba, hodnota mimo výkres', () => {
    const base: DimensionTask = {
      kind: 'dimension',
      seed: 1,
      difficulty: 4,
      engineVersion: ENGINE_VERSION,
      part: { id: 'p', base: { kind: 'block', size: [60, 40, 30] }, features: [] },
      question: { kind: 'wallBeyond', featureId: 's1', featureKind: 'slot', axis: 'z' },
      answer: 18,
      dimensionIds: ['dim:part:overall:z', 'dim:s1:size:z'],
      combined: true,
      drawingDimensions: [
        { id: 'dim:part:overall:x', value: 60, featureId: null },
        { id: 'dim:part:overall:z', value: 30, featureId: null },
        { id: 'dim:s1:size:z', value: 12, featureId: 's1' },
        { id: 'dim:s1:size:x', value: 10, featureId: 's1' },
      ],
    }
    const code = (t: DimensionTask, value: number) =>
      evaluateDimension(t, { kind: 'dimension', value }).errors[0]?.code
    expect(code(base, 18)).toBeUndefined()
    expect(code(base, 12)).toBe('DIMENSION_NOT_COMBINED')
    expect(code(base, 30)).toBe('DIMENSION_NOT_COMBINED')
    expect(code(base, 10)).toBe('DIMENSION_WRONG_FEATURE')
    expect(code(base, 42)).toBe('DIMENSION_ARITHMETIC')
    const direct: DimensionTask = {
      ...base,
      question: { kind: 'slotWidth', featureId: 's1', featureKind: 'slot', axis: 'x' },
      answer: 10,
      dimensionIds: ['dim:s1:size:x'],
      combined: false,
    }
    expect(code(direct, 12)).toBe('DIMENSION_WRONG_FEATURE')
    expect(code(direct, 11)).toBe('DIMENSION_WRONG')
    expect(evaluateDimension(direct, { kind: 'dimension', value: 12 }).errors[0]!.featureId).toBe(
      's1',
    )
  })
})
