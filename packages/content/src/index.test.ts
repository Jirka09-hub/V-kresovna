import { describe, expect, it } from 'vitest'
import { EXERCISE_KINDS } from '@vykresovna/exercises'
import {
  DEMO_TASKS,
  expandPlan,
  FINAL_TEST,
  FINAL_TEST_PASS_THRESHOLD,
  finalTestTasks,
  getLesson,
  lessonTaskCount,
  PILOT_MODULE,
} from './index'

describe('pilotní modul', () => {
  it('má 9 lekcí s unikátními slugy, všechny dostupné', () => {
    const { lessons } = PILOT_MODULE
    expect(lessons).toHaveLength(9)
    expect(new Set(lessons.map((l) => l.slug)).size).toBe(9)
    expect(lessons.every((l) => l.status === 'available')).toBe(true)
  })

  it('lekce 7 procvičuje řez, lekce 8 kóty, obě mají živý úvod', () => {
    const rez = getLesson('rez-a-srafovani')!.lesson
    expect(rez.plan.every((p) => p.kind === 'section')).toBe(true)
    expect(rez.intro.every((s) => s.demo.kind === 'section')).toBe(true)
    const koty = getLesson('koty')!.lesson
    expect(koty.plan.every((p) => p.kind === 'dimension')).toBe(true)
    expect(koty.intro.every((s) => s.demo.kind === 'dimensions')).toBe(true)
    // složené otázky (obtížnost 4) jsou v plánu
    expect(koty.plan.some((p) => p.difficulty >= 4)).toBe(true)
  })

  it('lekce 6 procvičuje hledání chyb, adaptivní úlohy jsou v rozumném rozsahu', () => {
    const lesson = getLesson('chyby-ve-vykresu')!.lesson
    expect(lesson.plan.every((p) => p.kind === 'find-error')).toBe(true)
    expect(lesson.intro.some((s) => s.demo.kind === 'error-example')).toBe(true)
    expect(lessonTaskCount(lesson)).toBe(5)
    for (const l of PILOT_MODULE.lessons) {
      if (!l.adaptive) continue
      expect(l.adaptive.count).toBeGreaterThan(0)
      expect(l.adaptive.kinds.length).toBeGreaterThan(0)
      expect(l.adaptive.minDifficulty).toBeLessThanOrEqual(l.adaptive.maxDifficulty)
    }
  })

  it('každá dostupná lekce (kromě testu) má 1–2 úvodní obrazovky a aspoň jednu úlohu', () => {
    for (const lesson of PILOT_MODULE.lessons.filter((l) => l.status === 'available' && !l.test)) {
      expect(lesson.intro.length).toBeGreaterThanOrEqual(1)
      expect(lesson.intro.length).toBeLessThanOrEqual(2)
      expect(new Set(lesson.intro.map((s) => s.id)).size).toBe(lesson.intro.length)
      expect(expandPlan(lesson.plan).length).toBeGreaterThan(0)
    }
  })

  it('zvýrazňované prvky v úvodu existují v součásti', () => {
    for (const lesson of PILOT_MODULE.lessons) {
      for (const screen of lesson.intro) {
        if (screen.demo.kind !== 'linked' && screen.demo.kind !== 'dimensions') continue
        for (const f of screen.demo.features ?? []) {
          expect(screen.part.features.map((x) => x.id)).toContain(f.featureId)
        }
      }
    }
  })

  it('najde lekci podle slugu', () => {
    expect(getLesson('diry-a-osy')?.lesson.slug).toBe('diry-a-osy')
    expect(getLesson('neexistuje')).toBeUndefined()
  })

  it('rozvine plán podle počtu', () => {
    expect(
      expandPlan([
        { kind: 'assign-views', difficulty: 1, count: 2 },
        { kind: 'missing-view', difficulty: 2, count: 1 },
      ]),
    ).toEqual([
      { kind: 'assign-views', difficulty: 1 },
      { kind: 'assign-views', difficulty: 1 },
      { kind: 'missing-view', difficulty: 2 },
    ])
  })
})

describe('demo', () => {
  it('má 5 úloh pěti různých typů včetně řezu', () => {
    expect(DEMO_TASKS).toHaveLength(5)
    expect(new Set(DEMO_TASKS.map((t) => t.kind))).toEqual(
      new Set(['assign-views', 'missing-view', 'drawing-to-model', 'find-error', 'section']),
    )
    expect(new Set(DEMO_TASKS.map((t) => t.seed)).size).toBe(5)
  })
})

describe('závěrečný test', () => {
  const lesson = getLesson('zaverecny-test')!.lesson

  it('je poslední lekce: 12 úloh ze všech šesti typů, obtížnost 2–4, bez úvodu a plánu', () => {
    expect(PILOT_MODULE.lessons.at(-1)).toBe(lesson)
    expect(lesson.test).toBe(FINAL_TEST)
    expect(lesson.intro).toHaveLength(0)
    expect(lesson.plan).toHaveLength(0)
    expect(FINAL_TEST.plan).toHaveLength(12)
    expect(new Set(FINAL_TEST.plan.map((p) => p.kind))).toEqual(new Set(EXERCISE_KINDS))
    for (const p of FINAL_TEST.plan) {
      expect(p.difficulty).toBeGreaterThanOrEqual(2)
      expect(p.difficulty).toBeLessThanOrEqual(4)
    }
    // po sobě nejdou dvě úlohy stejného typu
    FINAL_TEST.plan.slice(1).forEach((p, i) => expect(p.kind).not.toBe(FINAL_TEST.plan[i]!.kind))
    expect(lessonTaskCount(lesson)).toBe(12)
  })

  it('hranice splnění je 75 %', () => {
    expect(FINAL_TEST.passThreshold).toBe(FINAL_TEST_PASS_THRESHOLD)
    expect(FINAL_TEST_PASS_THRESHOLD).toBe(0.75)
  })

  it('seedy úloh plynou deterministicky z jednoho seedu testu a liší se', () => {
    const a = finalTestTasks(123456)
    expect(finalTestTasks(123456)).toEqual(a)
    expect(new Set(a.map((t) => t.seed)).size).toBe(a.length)
    expect(finalTestTasks(123457).map((t) => t.seed)).not.toEqual(a.map((t) => t.seed))
    expect(a.map((t) => t.kind)).toEqual(FINAL_TEST.plan.map((p) => p.kind))
    for (const t of a) expect(Number.isInteger(t.seed) && t.seed >= 0).toBe(true)
  })
})
