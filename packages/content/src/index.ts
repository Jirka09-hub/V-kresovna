/**
 * Obsah modulů: modul → lekce → úvodní obrazovky a plán úloh. Jen data (texty jsou v aplikaci).
 * Závisí jen na typech z `@vykresovna/exercises`.
 */
import {
  INTRO_PART_FEATURES,
  INTRO_PART_HIDDEN,
  INTRO_PART_HOLES,
  INTRO_PART_READING,
  INTRO_PART_VIEWS,
} from './parts'
import type { FixedTask, Lesson, Module, TaskPlanItem } from './types'

export * from './types'
export * from './parts'

/** Pilotní modul „Pohledy a řezy jednoduchých součástí“ (docs/plan.md, 5.4). */
export const PILOT_MODULE: Module = {
  slug: 'pohledy-a-rezy',
  lessons: [
    {
      slug: 'jak-vznikaji-pohledy',
      status: 'available',
      intro: [
        { id: 'rozlozeni', part: INTRO_PART_VIEWS, demo: { kind: 'unfold' } },
        { id: 'hrany', part: INTRO_PART_VIEWS, demo: { kind: 'linked' } },
      ],
      plan: [
        { kind: 'assign-views', difficulty: 1, count: 2 },
        { kind: 'assign-views', difficulty: 2, count: 1 },
      ],
    },
    {
      slug: 'viditelne-a-skryte-hrany',
      status: 'available',
      intro: [{ id: 'rentgen', part: INTRO_PART_HIDDEN, demo: { kind: 'linked', xray: true } }],
      plan: [
        { kind: 'assign-views', difficulty: 2, count: 1 },
        { kind: 'missing-view', difficulty: 1, count: 2 },
      ],
    },
    {
      slug: 'diry-a-osy',
      status: 'available',
      intro: [
        {
          id: 'diry',
          part: INTRO_PART_HOLES,
          demo: {
            kind: 'linked',
            xray: true,
            features: [
              { featureId: 'd1', term: 'throughHole' },
              { featureId: 'd2', term: 'blindHole' },
            ],
          },
        },
      ],
      plan: [
        { kind: 'missing-view', difficulty: 2, count: 2 },
        { kind: 'drawing-to-model', difficulty: 2, count: 1 },
      ],
    },
    {
      slug: 'drazky-osazeni-zkoseni',
      status: 'available',
      intro: [
        {
          id: 'prvky',
          part: INTRO_PART_FEATURES,
          demo: {
            kind: 'linked',
            features: [
              { featureId: 's1', term: 'slot' },
              { featureId: 'o1', term: 'step' },
              { featureId: 'z1', term: 'chamfer' },
            ],
          },
        },
      ],
      plan: [
        { kind: 'missing-view', difficulty: 3, count: 2 },
        { kind: 'drawing-to-model', difficulty: 3, count: 1 },
      ],
    },
    {
      slug: 'chybejici-pohled-a-model',
      status: 'available',
      intro: [
        { id: 'cteni', part: INTRO_PART_READING, demo: { kind: 'linked', reveal: true } },
        {
          id: 'kontrola',
          part: INTRO_PART_READING,
          demo: {
            kind: 'linked',
            xray: true,
            features: [
              { featureId: 's1', term: 'slot' },
              { featureId: 'd1', term: 'throughHole' },
              { featureId: 'v1', term: 'cutout' },
            ],
          },
        },
      ],
      plan: [
        { kind: 'missing-view', difficulty: 3, count: 1 },
        { kind: 'drawing-to-model', difficulty: 3, count: 2 },
        { kind: 'drawing-to-model', difficulty: 4, count: 1 },
      ],
    },
    { slug: 'chyby-ve-vykresu', status: 'coming-soon', intro: [], plan: [] },
    { slug: 'rez-a-srafovani', status: 'coming-soon', intro: [], plan: [] },
    { slug: 'koty', status: 'coming-soon', intro: [], plan: [] },
    { slug: 'zaverecny-test', status: 'coming-soon', intro: [], plan: [] },
  ],
}

export const MODULES: readonly Module[] = [PILOT_MODULE]

export function getModule(slug: string): Module | undefined {
  return MODULES.find((m) => m.slug === slug)
}

export function getLesson(slug: string): { module: Module; lesson: Lesson } | undefined {
  for (const module of MODULES) {
    const lesson = module.lessons.find((l) => l.slug === slug)
    if (lesson) return { module, lesson }
  }
  return undefined
}

/** Rozvine plán úloh na seznam jednotlivých úloh v pořadí. */
export function expandPlan(
  plan: readonly TaskPlanItem[],
): Pick<TaskPlanItem, 'kind' | 'difficulty'>[] {
  return plan.flatMap((item) =>
    Array.from({ length: item.count }, () => ({ kind: item.kind, difficulty: item.difficulty })),
  )
}

/** Součást pro 3D ukázku na začátku dema (animace rozložení). */
export const DEMO_SHOWCASE_PART = INTRO_PART_VIEWS

/** Pět pevných úloh dema (předvídatelná ukázka); „Další varianta“ mění jen seedy. */
export const DEMO_TASKS: readonly FixedTask[] = [
  { kind: 'assign-views', seed: 1101, difficulty: 1 },
  { kind: 'missing-view', seed: 2202, difficulty: 2 },
  { kind: 'drawing-to-model', seed: 3303, difficulty: 2 },
  { kind: 'assign-views', seed: 4404, difficulty: 3 },
  { kind: 'missing-view', seed: 5505, difficulty: 3 },
]
