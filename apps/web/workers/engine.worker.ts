/// <reference lib="webworker" />
import {
  buildPart,
  createDrawing,
  drawingToSvg,
  extractEdges,
  loadManifold,
  toRenderData,
  transferables,
  type EdgeModel,
  type PartSpec,
  type SolidMesh,
} from '@vykresovna/engine'
import {
  applyDrawingMutation,
  buildFindErrorDrawing,
  buildOptionDrawing,
  evaluate,
  generateTask,
  viewPlacements,
} from '@vykresovna/exercises'
import type { EngineCall, EngineRequest, EngineResponse, ViewsSvg } from '@/lib/engine/protocol'

const ctx = self as unknown as DedicatedWorkerGlobalScope

/** Postavené součásti (síť + hrany) podle popisu; několik pohledů téže součásti se nestaví znovu. */
const MAX_BUILT = 32
const built = new Map<string, { mesh: SolidMesh; edges: EdgeModel }>()

let wasmPromise: ReturnType<typeof loadManifold> | null = null
const wasm = () => (wasmPromise ??= loadManifold({ wasmUrl: '/wasm/manifold.wasm' }))

async function build(spec: PartSpec) {
  const key = JSON.stringify(spec)
  const hit = built.get(key)
  if (hit) {
    // naposledy použité na konec (jednoduché LRU)
    built.delete(key)
    built.set(key, hit)
    return hit
  }
  const mesh = buildPart(await wasm(), spec)
  const entry = { mesh, edges: extractEdges(mesh) }
  built.set(key, entry)
  if (built.size > MAX_BUILT) built.delete(built.keys().next().value!)
  return entry
}

async function handle(call: EngineCall): Promise<{ result: unknown; transfer: Transferable[] }> {
  switch (call.type) {
    case 'render-part': {
      const { mesh, edges } = await build(call.spec)
      const drawing = createDrawing(call.spec, mesh, { edges })
      const data = toRenderData(mesh, edges, drawing, call.svgTitle)
      return { result: data, transfer: transferables(data) }
    }
    case 'generate-task': {
      const task = generateTask(
        await wasm(),
        call.kind,
        call.seed,
        call.difficulty,
        call.focus ? { focus: call.focus } : {},
      )
      return { result: task, transfer: [] }
    }
    case 'render-views': {
      const { mesh, edges } = await build(call.spec)
      let drawing = createDrawing(call.spec, mesh, { edges, views: call.views })
      if (call.mutation) drawing = applyDrawingMutation(drawing, call.mutation)
      const result: ViewsSvg = {
        svg: drawingToSvg(drawing, call.svgTitle ? { title: call.svgTitle } : {}),
        width: drawing.width,
        height: drawing.height,
      }
      return { result, transfer: [] }
    }
    case 'render-option': {
      const drawing = buildOptionDrawing(await wasm(), call.option, call.views)
      const result: ViewsSvg = {
        svg: drawingToSvg(drawing),
        width: drawing.width,
        height: drawing.height,
      }
      return { result, transfer: [] }
    }
    case 'render-find-error': {
      const drawing = buildFindErrorDrawing(await wasm(), call.task, { correct: !!call.correct })
      const result: ViewsSvg = {
        svg: drawingToSvg(drawing),
        width: drawing.width,
        height: drawing.height,
        placements: viewPlacements(drawing),
      }
      return { result, transfer: [] }
    }
    case 'evaluate':
      return { result: evaluate(call.task, call.answer), transfer: [] }
  }
}

ctx.onmessage = async (event: MessageEvent<EngineRequest>) => {
  const { id, call } = event.data
  try {
    const { result, transfer } = await handle(call)
    ctx.postMessage({ id, result } satisfies EngineResponse, transfer)
  } catch (error) {
    ctx.postMessage({ id, error: String(error) } satisfies EngineResponse)
  }
}
