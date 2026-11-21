import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { STANDARD_VIEWS } from '@vykresovna/drafting-standards'
import { ENGINE_VERSION, loadManifold } from '@vykresovna/engine'
import {
  DIFFICULTIES,
  evaluate,
  generatePart,
  generateTask,
  layoutOk,
  type DrawingToModelTask,
  type MissingViewTask,
} from '../src'
import { optionFingerprints, seeds } from './helpers'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await loadManifold()
})

const SEEDS = seeds(8)
const sameFeatures = (a: { features: unknown }, b: { features: unknown }) =>
  JSON.stringify(a.features) === JSON.stringify(b.features)

function checkOptionsShape(task: MissingViewTask | DrawingToModelTask) {
  expect(task.engineVersion).toBe(ENGINE_VERSION)
  expect(task.options.map((o) => o.id)).toEqual(['m1', 'm2', 'm3', 'm4'])
  const correct = task.options.filter((o) => o.errorCode === null)
  expect(correct).toHaveLength(1)
  expect(sameFeatures(correct[0]!.part, task.part)).toBe(true)
  expect(correct[0]!.drawingMutation).toBeUndefined()
  for (const o of task.options) {
    expect(layoutOk(o.part)).toBe(true)
    // id součásti nesmí prozradit správnou odpověď
    expect(o.part.id).toBe(`${task.part.id}/${o.id}`)
    const result = evaluate(task, { kind: task.kind, optionId: o.id })
    expect(result.correct).toBe(o.errorCode === null)
    expect(result.score).toBe(o.errorCode === null ? 1 : 0)
    if (o.errorCode !== null) {
      expect(result.errors[0]!.code).toBe(o.errorCode)
      expect(result.errors[0]!.featureId).toBe(o.featureId)
    }
  }
}

describe('cvičení „chybějící pohled“', () => {
  for (const d of DIFFICULTIES) {
    it(`obtížnost ${d}: chybějící pohled každé možnosti se liší, distraktor není druhá správná odpověď`, () => {
      let drawingDistractors = 0
      let hard = 0
      for (const seed of SEEDS) {
        const task = generateTask(wasm, 'missing-view', seed, d)
        if (task.kind !== 'missing-view') throw new Error('špatný typ úlohy')
        checkOptionsShape(task)
        expect(task.givenViews).toHaveLength(2)
        expect(task.givenViews).toContain('front')
        expect(['top', 'left']).toContain(task.missingView)
        expect(task.givenViews).not.toContain(task.missingView)

        const correct = task.options.find((o) => o.errorCode === null)!
        const correctFps = optionFingerprints(wasm, correct)
        const missingFps = new Set<string>()
        let hardInTask = 0
        for (const o of task.options) {
          const fps = optionFingerprints(wasm, o)
          missingFps.add(fps[task.missingView])
          expect(evaluate(task, { kind: 'missing-view', optionId: o.id }).errors[0]?.view).toBe(
            o.errorCode === null ? undefined : task.missingView,
          )
          if (o.errorCode === null) continue
          const sameGiven = task.givenViews.filter((v) => fps[v] === correctFps[v]).length
          if (o.drawingMutation) {
            drawingDistractors++
            hardInTask++
            expect(sameFeatures(o.part, task.part)).toBe(true)
            expect(o.drawingMutation.view).toBe(task.missingView)
            expect(sameGiven).toBe(2)
          } else {
            // stejné dané pohledy by znamenaly druhou správnou odpověď
            expect(sameGiven).toBeLessThan(2)
            if (sameGiven === 1) hardInTask++
          }
        }
        expect(missingFps.size).toBe(4)
        if (hardInTask > 0) hard++
      }
      if (d <= 2) expect(drawingDistractors).toBeLessThanOrEqual(SEEDS.length * 3 * 0.1)
      if (d >= 4) expect(hard).toBe(SEEDS.length)
    })
  }
})

describe('cvičení „výkres → model“', () => {
  for (const d of DIFFICULTIES) {
    it(`obtížnost ${d}: všechny 4 modely mají navzájem různý výkres (nárys, půdorys, bokorys)`, () => {
      for (const seed of SEEDS) {
        const task = generateTask(wasm, 'drawing-to-model', seed, d)
        if (task.kind !== 'drawing-to-model') throw new Error('špatný typ úlohy')
        checkOptionsShape(task)
        const correctFps = optionFingerprints(
          wasm,
          task.options.find((o) => !o.errorCode)!,
        )
        const combined = new Set<string>()
        for (const o of task.options) {
          expect(o.drawingMutation).toBeUndefined()
          const fps = optionFingerprints(wasm, o)
          combined.add(STANDARD_VIEWS.map((v) => fps[v]).join('|'))
          if (o.errorCode !== null) {
            expect(sameFeatures(o.part, task.part)).toBe(false)
            // pohled s rozdílem je opravdu jiný
            expect(fps[o.view!]).not.toBe(correctFps[o.view!])
          }
        }
        expect(combined.size).toBe(4)
      }
    })
  }
})

describe('determinismus úloh', () => {
  it('stejné vstupy dají stejnou úlohu (deep equal)', () => {
    for (const kind of ['missing-view', 'drawing-to-model'] as const) {
      for (const d of [1, 3, 5] as const) {
        expect(generateTask(wasm, kind, 4242, d)).toEqual(generateTask(wasm, kind, 4242, d))
      }
    }
  })

  it('součást úlohy je obvykle generatePart(seed, obtížnost)', () => {
    let same = 0
    for (const seed of SEEDS) {
      const task = generateTask(wasm, 'drawing-to-model', seed, 3)
      if (JSON.stringify(task.part) === JSON.stringify(generatePart(seed, 3))) same++
    }
    expect(same).toBeGreaterThanOrEqual(SEEDS.length - 1)
  })
})
