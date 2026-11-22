import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { FIRST_ANGLE_LAYOUT, STANDARD_VIEWS } from '@vykresovna/drafting-standards'
import {
  buildPart,
  createDrawing,
  ENGINE_VERSION,
  loadManifold,
  viewFingerprint,
  type Drawing,
} from '@vykresovna/engine'
import {
  applyFindErrorMutation,
  buildFindErrorDrawing,
  DIFFICULTIES,
  ERROR_CODES,
  ERROR_PRACTICE,
  evaluate,
  findErrorFamilyFor,
  FIND_ERROR_CODE,
  FIND_ERROR_FAMILIES,
  generatePart,
  generateTask,
  midpoint,
  placedDrawingFingerprint,
  placeViews,
  segmentLength,
  viewPlacements,
  type FindErrorTask,
  type LineSegment2,
} from '../src'
import { seeds } from './helpers'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await loadManifold()
})

const SEEDS = seeds(30)

function findError(
  seed: number,
  d: (typeof DIFFICULTIES)[number],
  focus?: FindErrorTask['errorCode'],
) {
  const task = generateTask(wasm, 'find-error', seed, d, focus ? { focus } : {})
  if (task.kind !== 'find-error') throw new Error('špatný typ úlohy')
  return task
}

/** Bod daleko od všech míst chyby (pro test minutí), nebo null. */
function farPoint(task: FindErrorTask, drawing: Drawing) {
  for (const v of drawing.views) {
    const { min, max } = v.projection.bounds
    for (const fx of [0.1, 0.5, 0.9]) {
      for (const fy of [0.1, 0.5, 0.9]) {
        const p = [min[0] + fx * (max[0] - min[0]), min[1] + fy * (max[1] - min[1])] as const
        const near = task.targets.some(
          (t) =>
            t.view === v.view &&
            (t.kind === 'view' ||
              t.segments.some(
                (s) =>
                  Math.min(
                    Math.hypot(p[0] - s.a[0], p[1] - s.a[1]),
                    Math.hypot(p[0] - s.b[0], p[1] - s.b[1]),
                    Math.hypot(p[0] - midpoint(s)[0], p[1] - midpoint(s)[1]),
                  ) <
                  task.toleranceMm + segmentLength(s),
              )),
        )
        if (!near) return { view: v.view, point: p }
      }
    }
  }
  return null
}

describe('cvičení „najdi chybu“', () => {
  for (const d of DIFFICULTIES) {
    it(`obtížnost ${d}: výkres má právě jednu viditelnou chybu a místo chyby jde trefit`, () => {
      for (const seed of SEEDS) {
        const task = findError(seed, d)
        expect(task.engineVersion).toBe(ENGINE_VERSION)
        expect(task.views).toEqual(STANDARD_VIEWS)
        expect(task.targets.length).toBeGreaterThan(0)
        expect(ERROR_CODES).toContain(task.errorCode)

        // otisk chybného výkresu se liší od správného (nezávisle na generátoru)
        const correct = buildFindErrorDrawing(wasm, task, { correct: true })
        const shown = buildFindErrorDrawing(wasm, task)
        expect(placedDrawingFingerprint(shown)).not.toBe(placedDrawingFingerprint(correct))

        const layout =
          task.mutation.kind === 'third-angle-layout' || task.mutation.kind === 'swap-top-left'
        expect(task.layoutError).toBe(layout)
        if (layout) {
          // stejné pohledy, jen jinak rozmístěné
          for (const v of STANDARD_VIEWS) {
            const a = shown.views.find((x) => x.view === v)!
            const b = correct.views.find((x) => x.view === v)!
            expect(viewFingerprint(a)).toBe(viewFingerprint(b))
          }
          expect(task.targets.every((t) => t.kind === 'view')).toBe(true)
        } else {
          // chyba je jen v jednom pohledu, ostatní jsou správně
          const changed = STANDARD_VIEWS.filter(
            (v) =>
              viewFingerprint(shown.views.find((x) => x.view === v)!) !==
              viewFingerprint(correct.views.find((x) => x.view === v)!),
          )
          expect(changed).toEqual(['view' in task.mutation ? task.mutation.view : null])
          expect(task.targets).toHaveLength(1)
          const target = task.targets[0]!
          expect(target.kind).toBe('lines')
          if (target.kind !== 'lines') continue
          expect(target.view).toBe(changed[0])
          expect(target.segments.length).toBeGreaterThan(0)
          // pohled se pořád vejde do svého obdélníku (chyba nemění rozměry pohledu)
          const bounds = correct.views.find((v) => v.view === target.view)!.projection.bounds
          for (const s of target.segments) {
            for (const p of [s.a, s.b]) {
              expect(p[0]).toBeGreaterThanOrEqual(bounds.min[0] - 1e-6)
              expect(p[0]).toBeLessThanOrEqual(bounds.max[0] + 1e-6)
              expect(p[1]).toBeGreaterThanOrEqual(bounds.min[1] - 1e-6)
              expect(p[1]).toBeLessThanOrEqual(bounds.max[1] + 1e-6)
            }
          }
          // klik doprostřed čáry chyby je správně, kousek vedle (v toleranci) taky
          const s = target.segments[0]!
          const m = midpoint(s)
          const ok = (point: readonly [number, number]) =>
            evaluate(task, { kind: 'find-error', pick: 'point', view: target.view, point })
          expect(ok(m).correct).toBe(true)
          expect(ok([m[0] + task.toleranceMm * 0.7, m[1]]).correct).toBe(true)
          // oblast z klávesnice kolem středu čáry
          const area = {
            min: [m[0] - 1, m[1] - 1] as const,
            max: [m[0] + 1, m[1] + 1] as const,
          }
          expect(
            evaluate(task, { kind: 'find-error', pick: 'area', view: target.view, area }).correct,
          ).toBe(true)
          // tlačítko „rozmístění je špatně“ je u chyby čáry špatná odpověď
          const r = evaluate(task, { kind: 'find-error', pick: 'layout' })
          expect(r.correct).toBe(false)
          expect(r.errors.map((e) => e.code)).toEqual([task.errorCode, 'MISSED_ERROR'])
        }

        // klik jinam: kód skutečné chyby + MISSED_ERROR
        const far = farPoint(task, correct)
        if (far) {
          const r = evaluate(task, { kind: 'find-error', pick: 'point', ...far })
          expect(r.correct).toBe(false)
          expect(r.score).toBe(0)
          expect(r.errors[0]).toMatchObject({ code: task.errorCode, view: task.targets[0]!.view })
          expect(r.errors[1]).toEqual({ code: 'MISSED_ERROR', view: far.view })
        }
      }
    })
  }

  it('obtížnost 1 dává hrubé chyby, obtížnost 5 jemné (často na díře)', () => {
    const size = (t: FindErrorTask) =>
      t.targets.reduce(
        (n, x) =>
          n + (x.kind === 'lines' ? x.segments.reduce((m, s) => m + segmentLength(s), 0) : 999),
        0,
      )
    const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
    const easy = SEEDS.map((s) => findError(s, 1))
    const hard = SEEDS.map((s) => findError(s, 5))
    expect(new Set(easy.map((t) => t.errorCode))).toEqual(
      new Set(['MISSING_EDGE', 'LAYOUT_THIRD_ANGLE', 'TOP_SIDE_SWAPPED']),
    )
    expect(median(easy.map(size))).toBeGreaterThanOrEqual(20)
    expect(median(hard.map(size))).toBeLessThanOrEqual(12)
    const holes = hard.filter(
      (t) => t.targets[0]?.kind === 'lines' && /(cyl|cone):/.test(t.targets[0].edgeIds[0]!),
    )
    expect(holes.length).toBeGreaterThanOrEqual(SEEDS.length / 3)
    expect(hard.some((t) => t.errorCode === 'HIDDEN_AS_VISIBLE')).toBe(true)
  })

  it('všechny druhy chyb se objevují', () => {
    const codes = new Set<string>()
    for (const d of DIFFICULTIES)
      for (const s of SEEDS.slice(0, 15)) codes.add(findError(s, d).errorCode)
    expect(codes).toEqual(new Set(FIND_ERROR_FAMILIES.map((f) => FIND_ERROR_CODE[f])))
  })

  it('upřednostněný druh chyby (focus) se použije, když to součást dovolí', () => {
    for (const code of ['HIDDEN_AS_VISIBLE', 'EXTRA_EDGE', 'TOP_SIDE_SWAPPED'] as const) {
      const hits = SEEDS.slice(0, 15).filter((s) => findError(s, 3, code).errorCode === code)
      expect(hits.length, code).toBeGreaterThanOrEqual(10)
    }
    expect(findError(77, 3, 'EXTRA_EDGE').focus).toBe('EXTRA_EDGE')
  })

  it('je deterministická ze seedu (deep equal)', () => {
    for (const d of [1, 3, 5] as const) {
      expect(findError(4242, d)).toEqual(findError(4242, d))
      expect(findError(4242, d, 'MISSING_EDGE')).toEqual(findError(4242, d, 'MISSING_EDGE'))
    }
    expect(findError(4242, 3).part).toEqual(generatePart(4242, 3))
  })

  it('kódy chyb pro focus v adaptivitě odpovídají generátoru', () => {
    for (const code of ERROR_CODES) {
      expect(!!ERROR_PRACTICE[code].focus, code).toBe(findErrorFamilyFor(code) !== undefined)
    }
  })
})

describe('rozmístění pohledů', () => {
  it('placeViews s evropským rozmístěním dá totéž co engine', () => {
    const part = generatePart(5, 3)
    const drawing = createDrawing(part, buildPart(wasm, part))
    expect(placeViews(drawing, FIRST_ANGLE_LAYOUT)).toEqual(drawing)
  })

  it('americké rozmístění a prohození mění polohu pohledů, ne pohledy', () => {
    const part = generatePart(5, 3)
    const drawing = createDrawing(part, buildPart(wasm, part))
    const at = (d: Drawing, v: string) => d.views.find((x) => x.view === v)!.origin
    const third = applyFindErrorMutation(drawing, { kind: 'third-angle-layout' })
    expect(third.layout).toBe('third-angle-demo')
    expect(at(third, 'top')[1]).toBeLessThan(at(third, 'front')[1]) // půdorys nad nárysem
    expect(at(third, 'left')[0]).toBeLessThan(at(third, 'front')[0]) // bokorys vlevo
    const swap = applyFindErrorMutation(drawing, { kind: 'swap-top-left' })
    expect(at(swap, 'top')[0]).toBeGreaterThan(at(swap, 'front')[0])
    expect(at(swap, 'left')[1]).toBeGreaterThan(at(swap, 'front')[1])
    for (const d of [third, swap])
      expect(placedDrawingFingerprint(d)).not.toBe(placedDrawingFingerprint(drawing))
    expect(viewPlacements(swap).map((p) => p.view)).toEqual(STANDARD_VIEWS)
  })
})

describe('hodnocení „najdi chybu“', () => {
  const line: LineSegment2 = { a: [10, 10], b: [30, 10] }
  const base = {
    kind: 'find-error' as const,
    seed: 1,
    difficulty: 3 as const,
    engineVersion: ENGINE_VERSION,
    part: generatePart(1, 1),
    views: STANDARD_VIEWS,
    toleranceMm: 4,
  }
  const lineTask: FindErrorTask = {
    ...base,
    mutation: { kind: 'remove-edge', view: 'top', edgeIds: ['e'] },
    errorCode: 'MISSING_EDGE',
    featureId: 'v1',
    targets: [{ kind: 'lines', view: 'top', segments: [line], edgeIds: ['e'] }],
    layoutError: false,
  }
  const layoutTask: FindErrorTask = {
    ...base,
    mutation: { kind: 'swap-top-left' },
    errorCode: 'TOP_SIDE_SWAPPED',
    targets: [
      { kind: 'view', view: 'top' },
      { kind: 'view', view: 'left' },
    ],
    layoutError: true,
  }
  const point = (view: 'front' | 'top' | 'left', p: readonly [number, number]) =>
    ({ kind: 'find-error', pick: 'point', view, point: p }) as const

  it('klik v toleranci od čáry je správně, dál ne', () => {
    expect(evaluate(lineTask, point('top', [20, 13.9])).correct).toBe(true)
    expect(evaluate(lineTask, point('top', [33.5, 11])).correct).toBe(true)
    expect(evaluate(lineTask, point('top', [20, 14.5])).correct).toBe(false)
    expect(evaluate(lineTask, point('front', [20, 10])).correct).toBe(false)
  })

  it('oblast musí čáru protnout', () => {
    const area = (min: [number, number], max: [number, number]) =>
      ({ kind: 'find-error', pick: 'area', view: 'top', area: { min, max } }) as const
    expect(evaluate(lineTask, area([0, 0], [10, 10])).correct).toBe(true) // dotyk v rohu
    expect(evaluate(lineTask, area([15, 5], [18, 20])).correct).toBe(true)
    expect(evaluate(lineTask, area([15, 11], [18, 20])).correct).toBe(false)
  })

  it('minutí: skutečná chyba s prvkem a pohledem + MISSED_ERROR', () => {
    expect(evaluate(lineTask, point('left', [0, 0]))).toEqual({
      correct: false,
      score: 0,
      errors: [
        { code: 'MISSING_EDGE', featureId: 'v1', view: 'top' },
        { code: 'MISSED_ERROR', view: 'left' },
      ],
    })
  })

  it('chyba rozmístění: správně je tlačítko nebo klik do špatně umístěného pohledu', () => {
    expect(evaluate(layoutTask, { kind: 'find-error', pick: 'layout' }).correct).toBe(true)
    expect(evaluate(layoutTask, point('top', [0, 0])).correct).toBe(true)
    expect(evaluate(layoutTask, point('left', [5, 5])).correct).toBe(true)
    const r = evaluate(layoutTask, point('front', [5, 5]))
    expect(r.errors.map((e) => e.code)).toEqual(['TOP_SIDE_SWAPPED', 'MISSED_ERROR'])
  })

  it('odpověď jiného typu se odmítne', () => {
    expect(() => evaluate(lineTask, { kind: 'missing-view', optionId: 'm1' })).toThrow()
  })
})
