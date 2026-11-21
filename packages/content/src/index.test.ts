import { describe, expect, it } from 'vitest'
import { DEMO_TASKS, expandPlan, getLesson, PILOT_MODULE } from './index'

describe('pilotní modul', () => {
  it('má 9 lekcí s unikátními slugy, 1–5 dostupné, 6–9 připravujeme', () => {
    const { lessons } = PILOT_MODULE
    expect(lessons).toHaveLength(9)
    expect(new Set(lessons.map((l) => l.slug)).size).toBe(9)
    expect(lessons.slice(0, 5).every((l) => l.status === 'available')).toBe(true)
    expect(lessons.slice(5).every((l) => l.status === 'coming-soon')).toBe(true)
  })

  it('každá dostupná lekce má 1–2 úvodní obrazovky a aspoň jednu úlohu', () => {
    for (const lesson of PILOT_MODULE.lessons.filter((l) => l.status === 'available')) {
      expect(lesson.intro.length).toBeGreaterThanOrEqual(1)
      expect(lesson.intro.length).toBeLessThanOrEqual(2)
      expect(new Set(lesson.intro.map((s) => s.id)).size).toBe(lesson.intro.length)
      expect(expandPlan(lesson.plan).length).toBeGreaterThan(0)
    }
  })

  it('zvýrazňované prvky v úvodu existují v součásti', () => {
    for (const lesson of PILOT_MODULE.lessons) {
      for (const screen of lesson.intro) {
        if (screen.demo.kind !== 'linked') continue
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
  it('má 5 úloh a obsahuje všechny tři typy cvičení', () => {
    expect(DEMO_TASKS).toHaveLength(5)
    expect(new Set(DEMO_TASKS.map((t) => t.kind))).toEqual(
      new Set(['assign-views', 'missing-view', 'drawing-to-model']),
    )
    expect(new Set(DEMO_TASKS.map((t) => t.seed)).size).toBe(5)
  })
})
