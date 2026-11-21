/// <reference lib="webworker" />
import {
  buildPart,
  createDrawing,
  extractEdges,
  loadManifold,
  toRenderData,
  transferables,
  type PartRenderData,
  type PartSpec,
} from '@vykresovna/engine'

export type EngineRequest = { id: number; spec: PartSpec; svgTitle?: string }
export type EngineResponse = { id: number; data: PartRenderData } | { id: number; error: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = async (event: MessageEvent<EngineRequest>) => {
  const { id, spec, svgTitle } = event.data
  try {
    const wasm = await loadManifold({ wasmUrl: '/wasm/manifold.wasm' })
    const mesh = buildPart(wasm, spec)
    const edges = extractEdges(mesh)
    const drawing = createDrawing(spec, mesh, { edges })
    const data = toRenderData(mesh, edges, drawing, svgTitle)
    ctx.postMessage({ id, data } satisfies EngineResponse, transferables(data))
  } catch (error) {
    ctx.postMessage({ id, error: String(error) } satisfies EngineResponse)
  }
}
