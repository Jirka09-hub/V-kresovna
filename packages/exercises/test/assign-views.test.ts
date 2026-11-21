import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import {
  FIRST_ANGLE_LAYOUT,
  THIRD_ANGLE_DEMO_ONLY,
  type GridPosition,
  type ViewName,
} from '@vykresovna/drafting-standards'
import {
  buildPart,
  createDrawing,
  ENGINE_VERSION,
  loadManifold,
  TEST_PARTS,
  viewFingerprint,
} from '@vykresovna/engine'
import {
  assignViewCards,
  DIFFICULTIES,
  evaluate,
  generateTask,
  SLOTS_AROUND_FRONT,
  type AssignViewsTask,
  type Difficulty,
  type MissingViewTask,
} from '../src'
import { seeds } from './helpers'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await loadManifold()
})

const EXPECTED_CARDS: Record<Difficulty, ViewName[]> = {
  1: ['left', 'top'],
  2: ['left', 'top'],
  3: ['left', 'right', 'top'],
  4: ['left', 'right', 'top'],
  5: ['bottom', 'left', 'right', 'top'],
}

describe('cvičení „přiřaď pohledy“', () => {
  for (const d of DIFFICULTIES) {
    it(`obtížnost ${d}: karty, místa a navzájem rozlišitelné pohledy`, () => {
      for (const seed of seeds(15)) {
        const task = generateTask(wasm, 'assign-views', seed, d)
        if (task.kind !== 'assign-views') throw new Error('špatný typ úlohy')
        expect(task.engineVersion).toBe(ENGINE_VERSION)
        expect(task.cards.map((c) => c.view).sort()).toEqual(EXPECTED_CARDS[d])
        expect(task.cards.map((c) => c.id)).toEqual(task.cards.map((_, i) => `k${i + 1}`))
        expect(task.slots).toEqual([
          [0, 1],
          [-1, 0],
          [1, 0],
          [0, -1],
        ])
        // každá karta má své místo mezi volnými místy
        for (const c of task.cards) {
          const pos = FIRST_ANGLE_LAYOUT[c.view]
          expect(task.slots.some((s) => s[0] === pos[0] && s[1] === pos[1])).toBe(true)
        }
        const drawing = createDrawing(task.part, buildPart(wasm, task.part), {
          views: task.cards.map((c) => c.view),
        })
        const fps = drawing.views.map(viewFingerprint)
        expect(new Set(fps).size).toBe(fps.length)
      }
    })
  }

  it('je deterministické a karty se míchají', () => {
    expect(generateTask(wasm, 'assign-views', 7, 5)).toEqual(
      generateTask(wasm, 'assign-views', 7, 5),
    )
    const orders = new Set(
      seeds(12).map((s) =>
        (generateTask(wasm, 'assign-views', s, 5) as AssignViewsTask).cards
          .map((c) => c.view)
          .join(),
      ),
    )
    expect(orders.size).toBeGreaterThan(3)
  })

  it('karty podle obtížnosti a místa kolem nárysu', () => {
    expect(assignViewCards(1)).toEqual(['top', 'left'])
    expect(assignViewCards(5)).toEqual(['top', 'left', 'right', 'bottom'])
    expect(SLOTS_AROUND_FRONT).toHaveLength(4)
  })
})

describe('hodnocení „přiřaď pohledy“', () => {
  const task: AssignViewsTask = {
    kind: 'assign-views',
    seed: 1,
    difficulty: 5,
    engineVersion: ENGINE_VERSION,
    part: TEST_PARTS[1]!,
    cards: [
      { id: 'k1', view: 'left' },
      { id: 'k2', view: 'bottom' },
      { id: 'k3', view: 'top' },
      { id: 'k4', view: 'right' },
    ],
    slots: SLOTS_AROUND_FRONT,
  }
  const place = (layout: Partial<Record<ViewName, GridPosition | null>>) =>
    evaluate(task, {
      kind: 'assign-views',
      placement: Object.fromEntries(task.cards.map((c) => [c.id, layout[c.view] ?? null])),
    })
  const codes = (r: ReturnType<typeof place>) =>
    Object.fromEntries(r.errors.map((e) => [e.view!, e.code]))

  it('správné evropské rozmístění', () => {
    const r = place(FIRST_ANGLE_LAYOUT)
    expect(r).toEqual({ correct: true, score: 1, errors: [] })
  })

  it('americké rozmístění se pozná zvlášť', () => {
    const r = place(THIRD_ANGLE_DEMO_ONLY)
    expect(r.correct).toBe(false)
    expect(r.score).toBe(0)
    expect(codes(r)).toEqual({
      left: 'LAYOUT_THIRD_ANGLE',
      bottom: 'LAYOUT_THIRD_ANGLE',
      top: 'LAYOUT_THIRD_ANGLE',
      right: 'LAYOUT_THIRD_ANGLE',
    })
    // stačí dvě položené karty, ostatní chybí
    const partial = place({ top: THIRD_ANGLE_DEMO_ONLY.top, left: THIRD_ANGLE_DEMO_ONLY.left })
    expect(codes(partial)).toEqual({
      top: 'LAYOUT_THIRD_ANGLE',
      left: 'LAYOUT_THIRD_ANGLE',
      bottom: 'VIEW_MISSING',
      right: 'VIEW_MISSING',
    })
    // jedna karta nestačí na závěr „americké promítání“
    const single = place({ top: THIRD_ANGLE_DEMO_ONLY.top })
    expect(codes(single).top).toBe('VIEW_MISPLACED')
  })

  it('prohozený půdorys a bokorys', () => {
    const r = place({
      ...FIRST_ANGLE_LAYOUT,
      top: FIRST_ANGLE_LAYOUT.left,
      left: FIRST_ANGLE_LAYOUT.top,
    })
    expect(r.score).toBe(0.5)
    expect(codes(r)).toEqual({ top: 'TOP_SIDE_SWAPPED', left: 'TOP_SIDE_SWAPPED' })
  })

  it('jiné chybné umístění a nepoložená karta', () => {
    const r = place({
      ...FIRST_ANGLE_LAYOUT,
      right: FIRST_ANGLE_LAYOUT.bottom,
      bottom: FIRST_ANGLE_LAYOUT.right,
      left: null,
    })
    expect(r.score).toBe(0.25)
    expect(codes(r)).toEqual({
      right: 'VIEW_MISPLACED',
      bottom: 'VIEW_MISPLACED',
      left: 'VIEW_MISSING',
    })
    expect(r.errors.find((e) => e.view === 'left')!.cardId).toBe('k1')
  })

  it('odpověď jiného typu je chyba programu', () => {
    expect(() => evaluate(task, { kind: 'missing-view', optionId: 'm1' })).toThrow()
  })
})

describe('hodnocení výběru 1 ze 4', () => {
  const part = TEST_PARTS[2]!
  const task: MissingViewTask = {
    kind: 'missing-view',
    seed: 1,
    difficulty: 3,
    engineVersion: ENGINE_VERSION,
    part,
    givenViews: ['front', 'top'],
    missingView: 'left',
    options: [
      { id: 'm1', part, errorCode: null },
      {
        id: 'm2',
        part,
        errorCode: 'HIDDEN_AS_VISIBLE',
        featureId: 'd1',
        drawingMutation: { kind: 'hidden-as-visible', view: 'left', edgeIds: ['sil:cyl:d1'] },
      },
      { id: 'm3', part, errorCode: 'FEATURE_SHIFTED', featureId: 'd1', view: 'left' },
      { id: 'm4', part, errorCode: 'MIRRORED' },
    ],
  }

  it('správná možnost', () => {
    expect(evaluate(task, { kind: 'missing-view', optionId: 'm1' })).toEqual({
      correct: true,
      score: 1,
      errors: [],
    })
  })

  it('špatná možnost vrací kód chyby, prvek a pohled', () => {
    expect(evaluate(task, { kind: 'missing-view', optionId: 'm2' }).errors).toEqual([
      { code: 'HIDDEN_AS_VISIBLE', featureId: 'd1', view: 'left' },
    ])
    expect(evaluate(task, { kind: 'missing-view', optionId: 'm3' }).errors).toEqual([
      { code: 'FEATURE_SHIFTED', featureId: 'd1', view: 'left' },
    ])
    // bez prvku i bez pohledu u možnosti: pohled je chybějící pohled úlohy
    expect(evaluate(task, { kind: 'missing-view', optionId: 'm4' }).errors).toEqual([
      { code: 'MIRRORED', view: 'left' },
    ])
  })

  it('neznámá možnost je chyba programu', () => {
    expect(() => evaluate(task, { kind: 'missing-view', optionId: 'x' })).toThrow()
  })
})
