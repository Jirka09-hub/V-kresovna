import type { PartRenderData } from '@vykresovna/engine'

/**
 * Předpočítaná 3D data pro živou ukázku na úvodní stránce (D-031). Úvodní stránka tak nenačítá
 * výpočetní jádro (WASM) ani worker, jen malý JSON. Soubor `public/ukazka/<id>.json` vzniká
 * v testu `sample.test.ts` (`pnpm test -u` ho přegeneruje po změně enginu nebo součásti).
 */
export type SerializedRenderData = Omit<PartRenderData, 'positions' | 'indices' | 'edges'> & {
  readonly positions: number[]
  readonly indices: number[]
  readonly edges: {
    readonly id: string
    readonly points: number[]
    readonly closed: boolean
    readonly featureIds: readonly string[]
  }[]
}

const round = (v: number) => Math.round(v * 1e4) / 1e4 || 0

export function serializeRenderData(data: PartRenderData): SerializedRenderData {
  return {
    ...data,
    positions: Array.from(data.positions, round),
    indices: Array.from(data.indices),
    edges: data.edges.map((e) => ({
      id: e.id,
      points: Array.from(e.points, round),
      closed: e.closed,
      featureIds: [...e.featureIds],
    })),
  }
}

export function deserializeRenderData(json: SerializedRenderData): PartRenderData {
  return {
    ...json,
    positions: Float32Array.from(json.positions),
    indices: Uint32Array.from(json.indices),
    edges: json.edges.map((e) => ({ ...e, points: Float32Array.from(e.points) })),
  }
}

/** Adresa předpočítaných dat součásti (v `public/`). */
export const sampleUrl = (partId: string) => `/ukazka/${partId}.json`
