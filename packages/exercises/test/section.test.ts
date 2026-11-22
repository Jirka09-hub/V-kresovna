import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { STANDARD_VIEWS } from '@vykresovna/drafting-standards'
import { ENGINE_VERSION, loadManifold, viewFingerprint } from '@vykresovna/engine'
import {
  buildSectionViews,
  DIFFICULTIES,
  distanceToAccepted,
  evaluate,
  generateTask,
  givenRender,
  layoutOk,
  optionRender,
  SECTION_PLACE_MIN_TOLERANCE_MM,
  SECTION_PLACE_TOLERANCE_MM,
  targetRender,
  type SectionChooseTask,
  type SectionPlaceTask,
  type SectionTask,
} from '../src'
import { seeds } from './helpers'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await loadManifold()
})

const SEEDS = seeds(10)

/** Otisk pohledu v řezu tak, jak ho uživatel uvidí (nezávisle na generátoru). */
const sectionFp = (render: Parameters<typeof buildSectionViews>[1]) =>
  viewFingerprint(buildSectionViews(wasm, render)[0]!.views[0]!)

function section(seed: number, d: (typeof DIFFICULTIES)[number]): SectionTask {
  const t = generateTask(wasm, 'section', seed, d)
  if (t.kind !== 'section') throw new Error('špatný typ úlohy')
  return t
}

function checkChoose(task: SectionChooseTask) {
  expect(task.options.map((o) => o.id)).toEqual(['m1', 'm2', 'm3', 'm4'])
  const correct = task.options.filter((o) => o.errorCode === null)
  expect(correct).toHaveLength(1)
  expect(correct[0]!.mutation).toBeUndefined()
  expect(correct[0]!.section).toEqual(task.section)
  expect(correct[0]!.view).toBe(task.view)
  expect(JSON.stringify(correct[0]!.part.features)).toBe(JSON.stringify(task.part.features))
  // každá možnost vypadá jinak (otisk pohledu v řezu včetně ploch řezu a šraf)
  const fps = task.options.map((o) => sectionFp(optionRender(o)))
  expect(new Set(fps).size).toBe(4)
  for (const o of task.options) {
    expect(layoutOk(o.part)).toBe(true)
    expect(o.part.id).toBe(`${task.part.id}/${o.id}`)
    const r = evaluate(task, { kind: 'section', optionId: o.id })
    expect(r.correct).toBe(o.errorCode === null)
    if (o.errorCode) expect(r.errors[0]!.code).toBe(o.errorCode)
  }
  // dané pohledy: všechny kromě nahrazeného řezem, stopa roviny řezu v pohledu `cuttingPlaneView`
  expect(task.givenViews).toEqual(STANDARD_VIEWS.filter((v) => v !== task.view))
  const given = buildSectionViews(wasm, givenRender(task))
  const marked = given.find((d) => d.views[0]!.view === task.cuttingPlaneView)!
  expect(marked.views[0]!.cuttingPlanes).toHaveLength(1)
  expect(marked.views[0]!.cuttingPlanes![0]!.label).toBe('A')
}

function checkPlace(task: SectionPlaceTask) {
  const { at } = task.section
  expect(task.toleranceMm).toBeGreaterThanOrEqual(SECTION_PLACE_MIN_TOLERANCE_MM)
  expect(SECTION_PLACE_MIN_TOLERANCE_MM).toBeGreaterThanOrEqual(2 * task.step)
  expect(task.toleranceMm).toBeLessThanOrEqual(SECTION_PLACE_TOLERANCE_MM[task.difficulty])
  expect(at).toBeGreaterThanOrEqual(task.range.min)
  expect(at).toBeLessThanOrEqual(task.range.max)
  expect(task.start).toBeGreaterThanOrEqual(task.range.min)
  expect(task.start).toBeLessThanOrEqual(task.range.max)
  const ok = (x: number) => evaluate(task, { kind: 'section', at: x }).correct
  expect(ok(at)).toBe(true)
  expect(ok(at + task.toleranceMm)).toBe(true)
  expect(ok(at - task.toleranceMm)).toBe(true)
  // výchozí poloha správná není (uživatel musí rovinu posunout)
  expect(ok(task.start)).toBe(false)
  expect(evaluate(task, { kind: 'section', at: task.start }).errors[0]!.code).toBe(
    'WRONG_SECTION_PLANE',
  )
  // každý přijatý úsek dává opravdu stejný řez (ověřeno nezávisle: otisk uprostřed úseku)
  const target = sectionFp(targetRender(task))
  for (const iv of task.accepted) {
    const mid = (iv.min + iv.max) / 2
    expect(sectionFp({ ...targetRender(task), section: { ...task.section, at: mid } })).toBe(target)
  }
  expect(distanceToAccepted(task, at)).toBe(0)
}

describe('cvičení „řez“', () => {
  for (const d of DIFFICULTIES) {
    it(`obtížnost ${d}: možnosti se liší, rovina prochází prvkem, hodnocení sedí`, () => {
      const variants = new Set<string>()
      for (const seed of SEEDS) {
        const task = section(seed, d)
        expect(task.engineVersion).toBe(ENGINE_VERSION)
        expect(task.difficulty).toBe(d)
        expect(task.part.features.map((f) => f.id)).toContain(task.featureId)
        expect(task.part.features.some((f) => f.kind === 'hole')).toBe(true)
        expect(task.section.label).toBe('A')
        variants.add(task.variant)
        if (task.variant === 'choose') checkChoose(task)
        else checkPlace(task)
      }
      expect(variants.size).toBe(2)
    })
  }

  it('je deterministická ze seedu a obtížnosti', () => {
    for (const d of [2, 5] as const) {
      expect(section(4242, d)).toEqual(section(4242, d))
    }
  })

  it('těžší úlohy mají pestřejší distraktory (skryté hrany, pohled z druhé strany, jiná součást)', () => {
    const codes = new Set<string>()
    for (const seed of SEEDS) {
      for (const d of [3, 4, 5] as const) {
        const t = section(seed, d)
        if (t.variant === 'choose') for (const o of t.options) codes.add(String(o.errorCode))
      }
    }
    expect(codes).toContain('SECTION_HIDDEN_EDGES')
    expect(codes).toContain('SECTION_WRONG_DIRECTION')
    expect(codes).toContain('SECTION_HOLE_HATCHED')
    expect([...codes].some((c) => c.startsWith('FEATURE_') || c === 'THROUGH_VS_BLIND')).toBe(true)
  })

  it('lehké úlohy používají hrubé chyby (šrafy přes díru, bez šraf, jiná rovina)', () => {
    const codes = new Set<string>()
    for (const seed of SEEDS) {
      const t = section(seed, 1)
      if (t.variant === 'choose') for (const o of t.options) codes.add(String(o.errorCode))
    }
    expect(codes).toContain('SECTION_HOLE_HATCHED')
    expect(codes).toContain('SECTION_NOT_HATCHED')
  })

  it('odpověď jiného druhu (poloha u výběru) se odmítne', () => {
    for (const seed of SEEDS) {
      const t = section(seed, 2)
      if (t.variant === 'choose') {
        expect(() => evaluate(t, { kind: 'section', at: 1 })).toThrow()
        return
      }
    }
  })
})
