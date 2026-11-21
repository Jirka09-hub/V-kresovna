'use client'

import type { ViewName } from '@vykresovna/drafting-standards'
import type { PartRenderData, PartSpec } from '@vykresovna/engine'
import type {
  Answer,
  Difficulty,
  DrawingMutation,
  ExerciseKind,
  Task,
  TaskResult,
} from '@vykresovna/exercises'
import type {
  EngineCall,
  EngineRequest,
  EngineResponse,
  EngineResult,
  ViewsSvg,
} from './protocol'

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

/** Postaví součást a celý výkres (3D síť, hrany, SVG). */
export function renderPart(spec: PartSpec, svgTitle?: string): Promise<PartRenderData> {
  return callEngine(
    svgTitle ? { type: 'render-part', spec, svgTitle } : { type: 'render-part', spec },
  )
}

/** Vygeneruje úlohu ze seedu (generátor potřebuje WASM, proto běží ve workeru). */
export function generateTask(
  kind: ExerciseKind,
  seed: number,
  difficulty: Difficulty,
): Promise<Task> {
  return callEngine({ type: 'generate-task', kind, seed, difficulty })
}

/** SVG vybraných pohledů součásti, volitelně s mutací výkresu (distraktor). */
export function renderViews(
  spec: PartSpec,
  views: readonly ViewName[],
  options: { mutation?: DrawingMutation; svgTitle?: string } = {},
): Promise<ViewsSvg> {
  return callEngine({
    type: 'render-views',
    spec,
    views,
    ...(options.mutation ? { mutation: options.mutation } : {}),
    ...(options.svgTitle ? { svgTitle: options.svgTitle } : {}),
  })
}

/** Vyhodnotí odpověď (ve workeru, aby se kód enginu nedostal do hlavního bundlu). */
export function evaluateAnswer(task: Task, answer: Answer): Promise<TaskResult> {
  return callEngine({ type: 'evaluate', task, answer })
}
