'use client'

import type { ViewName } from '@vykresovna/drafting-standards'
import type { PartRenderData, PartSpec, SectionDrawingOptions } from '@vykresovna/engine'
import type {
  Answer,
  ChoiceOption,
  Difficulty,
  DrawingMutation,
  ErrorCode,
  ExerciseKind,
  FindErrorTask,
  SectionRender,
  Task,
  TaskResult,
} from '@vykresovna/exercises'
import type { EngineCall, EngineRequest, EngineResponse, EngineResult, ViewsSvg } from './protocol'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>()

/** Výsledky podle požadavku (LRU), aby se stejná součást, úloha nebo pohled nepočítaly znovu. */
const CACHE_SIZE = 160
const cache = new Map<string, Promise<unknown>>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../../workers/engine.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<EngineResponse>) => {
      const p = pending.get(event.data.id)
      if (!p) return
      pending.delete(event.data.id)
      if ('error' in event.data) p.reject(new Error(event.data.error))
      else p.resolve(event.data.result)
    }
  }
  return worker
}

/** Zavolá engine ve Web Workeru (mimo hlavní vlákno). Výsledky se ukládají do cache. */
export function callEngine<C extends EngineCall>(call: C): Promise<EngineResult<C>> {
  const key = JSON.stringify(call)
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit as Promise<EngineResult<C>>
  }
  const promise = new Promise<unknown>((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, call } satisfies EngineRequest)
  })
  cache.set(key, promise)
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
  promise.catch(() => cache.delete(key))
  return promise as Promise<EngineResult<C>>
}

/** Pohledy s řezem (cvičení 5) jako samostatné výkresy, v pořadí `render.show`. */
export function renderSection(render: SectionRender): Promise<ViewsSvg[]> {
  return callEngine({ type: 'render-section', render })
}

/** Postaví součást a celý výkres (3D síť, hrany, SVG), volitelně s kótami. */
export function renderPart(
  spec: PartSpec,
  svgTitle?: string,
  options: { dimensions?: boolean } = {},
): Promise<PartRenderData> {
  return callEngine({
    type: 'render-part',
    spec,
    ...(svgTitle ? { svgTitle } : {}),
    ...(options.dimensions ? { dimensions: true } : {}),
  })
}

/** Vygeneruje úlohu ze seedu (generátor potřebuje WASM, proto běží ve workeru). */
export function generateTask(
  kind: ExerciseKind,
  seed: number,
  difficulty: Difficulty,
  focus?: ErrorCode,
): Promise<Task> {
  return callEngine({
    type: 'generate-task',
    kind,
    seed,
    difficulty,
    ...(focus ? { focus } : {}),
  })
}

/** Výkres úlohy „najdi chybu“ (s chybou, nebo správný) včetně polohy pohledů. */
export function renderFindError(task: FindErrorTask, correct = false): Promise<ViewsSvg> {
  return callEngine(
    correct ? { type: 'render-find-error', task, correct } : { type: 'render-find-error', task },
  )
}

/** SVG vybraných pohledů součásti, volitelně s mutací výkresu (distraktor). */
export function renderViews(
  spec: PartSpec,
  views: readonly ViewName[],
  options: { mutation?: DrawingMutation; svgTitle?: string; section?: SectionDrawingOptions } = {},
): Promise<ViewsSvg> {
  return callEngine({
    type: 'render-views',
    spec,
    views,
    ...(options.mutation ? { mutation: options.mutation } : {}),
    ...(options.svgTitle ? { svgTitle: options.svgTitle } : {}),
    ...(options.section ? { section: options.section } : {}),
  })
}

/** SVG možnosti úlohy tak, jak ji má uživatel vidět (mutace výkresu použitá generátorem). */
export function renderOption(option: ChoiceOption, views: readonly ViewName[]): Promise<ViewsSvg> {
  return callEngine({ type: 'render-option', option, views })
}

/** Vyhodnotí odpověď (ve workeru, aby se kód enginu nedostal do hlavního bundlu). */
export function evaluateAnswer(task: Task, answer: Answer): Promise<TaskResult> {
  return callEngine({ type: 'evaluate', task, answer })
}
