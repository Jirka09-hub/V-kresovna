import { LANDING_PART } from '@vykresovna/content'
import {
  buildPart,
  createDrawing,
  extractEdges,
  loadManifold,
  toRenderData,
  validatePart,
} from '@vykresovna/engine'
import { describe, expect, it } from 'vitest'
import { deserializeRenderData, serializeRenderData } from './sample'

describe('předpočítaná ukázka na úvodní stránce', () => {
  it('součást je platná', () => {
    expect(validatePart(LANDING_PART)).toEqual([])
  })

  it('soubor v public/ukazka odpovídá enginu (pnpm test -u ho přegeneruje)', async () => {
    const mesh = buildPart(await loadManifold(), LANDING_PART)
    const edges = extractEdges(mesh)
    const data = toRenderData(mesh, edges, createDrawing(LANDING_PART, mesh, { edges }))
    const json = JSON.stringify(serializeRenderData(data))
    await expect(json).toMatchFileSnapshot(`../../public/ukazka/${LANDING_PART.id}.json`)
    const back = deserializeRenderData(JSON.parse(json))
    expect(back.indices).toEqual(data.indices)
    expect(back.positions.length).toBe(data.positions.length)
    expect(back.edges.map((e) => e.id)).toEqual(data.edges.map((e) => e.id))
  })
})
