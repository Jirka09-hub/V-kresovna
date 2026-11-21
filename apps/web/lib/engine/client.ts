'use client'

import type { PartRenderData, PartSpec } from '@vykresovna/engine'
import type { EngineRequest, EngineResponse } from '@/workers/engine.worker'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<
  number,
  { resolve: (d: PartRenderData) => void; reject: (e: Error) => void }
>()
const cache = new Map<string, Promise<PartRenderData>>()

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
      else p.resolve(event.data.data)
    }
  }
  return worker
}

/** Postaví součást a výkres ve Web Workeru (mimo hlavní vlákno). Výsledky se ukládají do cache. */
export function renderPart(spec: PartSpec, svgTitle?: string): Promise<PartRenderData> {
  const key = JSON.stringify([spec, svgTitle])
  const hit = cache.get(key)
  if (hit) return hit
  const promise = new Promise<PartRenderData>((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    const req: EngineRequest = svgTitle ? { id, spec, svgTitle } : { id, spec }
    getWorker().postMessage(req)
  })
  cache.set(key, promise)
  promise.catch(() => cache.delete(key))
  return promise
}
