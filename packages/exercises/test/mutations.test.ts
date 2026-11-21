import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import {
  buildPart,
  createDrawing,
  drawingToSvg,
  extractEdges,
  loadManifold,
  TEST_PARTS,
  viewFingerprint,
  type PartSpec,
} from '@vykresovna/engine'
import {
  applyDrawingMutation,
  createRng,
  DIFFICULTIES,
  DRAWING_MUTATION_ERROR,
  drawingMutationCandidates,
  generatePart,
  layoutOk,
  mirrorPart,
  partMutations,
  type DrawingMutation,
} from '../src'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await loadManifold()
})

const EXPECTED_CODE = {
  shift: 'FEATURE_SHIFTED',
  remove: 'FEATURE_MISSING',
  add: 'FEATURE_EXTRA',
  mirror: 'MIRRORED',
  'through-blind': 'THROUGH_VS_BLIND',
  resize: 'FEATURE_RESIZED',
} as const

describe('mutace tělesa', () => {
  it('každá mutace je čitelná součást s odpovídajícím kódem chyby a prvkem', () => {
    const seenKinds = new Set<string>()
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 12; seed++) {
        const part = generatePart(seed, d)
        const mutations = partMutations(createRng(seed), part, d)
        expect(mutations.length).toBeGreaterThan(0)
        for (const m of mutations) {
          seenKinds.add(m.kind)
          expect(layoutOk(m.part), `${m.kind} ${JSON.stringify(m.part)}`).toBe(true)
          expect(m.errorCode).toBe(EXPECTED_CODE[m.kind])
          expect(JSON.stringify(m.part.features)).not.toBe(JSON.stringify(part.features))
          if (m.kind !== 'mirror') {
            const ids = new Set([...part.features, ...m.part.features].map((f) => f.id))
            expect(ids.has(m.featureId!)).toBe(true)
          }
          if (m.kind === 'remove') expect(m.part.features).toHaveLength(part.features.length - 1)
          if (m.kind === 'add') expect(m.part.features).toHaveLength(part.features.length + 1)
          if (m.kind === 'through-blind') {
            const before = part.features.find((f) => f.id === m.featureId)!
            const after = m.part.features.find((f) => f.id === m.featureId)!
            expect(before.kind === 'hole' && after.kind === 'hole').toBe(true)
            if (before.kind === 'hole' && after.kind === 'hole') {
              expect(before.depth === undefined).not.toBe(after.depth === undefined)
            }
          }
        }
      }
    }
    expect([...seenKinds].sort()).toEqual(Object.keys(EXPECTED_CODE).sort())
  })

  it('mutace jsou deterministické', () => {
    const part = generatePart(5, 4)
    expect(partMutations(createRng(9), part, 4)).toEqual(partMutations(createRng(9), part, 4))
  })

  it('dvojí zrcadlení vrátí původní součást; zrcadlení přesune výřez na druhou stranu', () => {
    for (let seed = 0; seed < 20; seed++) {
      const part = generatePart(seed, 5)
      expect(mirrorPart(mirrorPart(part, 0), 0)).toEqual(part)
      expect(mirrorPart(mirrorPart(part, 1), 1)).toEqual(part)
    }
    const corner = TEST_PARTS.find((p) => p.id === '02-vyrez-v-rohu')!
    const mirrored = mirrorPart(corner, 0)
    expect(mirrored.features[0]).toEqual({
      kind: 'cutout',
      id: 'v1',
      box: { min: [0, 0, 18], max: [20, 22, 30] },
    })
  })
})

describe('mutace výkresu', () => {
  const spec: PartSpec = TEST_PARTS.find((p) => p.id === '10-soubezne-hrany')!

  it('je čistá funkce a mění jen zvolený pohled', () => {
    const drawing = createDrawing(spec, buildPart(wasm, spec))
    const before = JSON.stringify(drawing)
    const front = drawing.views.find((v) => v.view === 'front')!
    const hidden = front.projection.segments.find((s) => s.visibility === 'hidden')!
    const mutation: DrawingMutation = {
      kind: 'hidden-as-visible',
      view: 'front',
      edgeIds: hidden.edgeIds,
    }
    const mutated = applyDrawingMutation(drawing, mutation)
    expect(JSON.stringify(drawing)).toBe(before)
    for (const name of ['top', 'left'] as const) {
      const a = drawing.views.find((v) => v.view === name)!
      const b = mutated.views.find((v) => v.view === name)!
      expect(viewFingerprint(b)).toBe(viewFingerprint(a))
    }
    const mutatedFront = mutated.views.find((v) => v.view === 'front')!
    expect(viewFingerprint(mutatedFront)).not.toBe(viewFingerprint(front))
  })

  it('SVG mutovaného výkresu změnu ukazuje (počet plných a čárkovaných čar)', () => {
    const drawing = createDrawing(spec, buildPart(wasm, spec), { views: ['front'] })
    const front = drawing.views[0]!
    const count = (svg: string, cls: string) => svg.split(`class="${cls}"`).length - 1
    const hidden = front.projection.segments.find((s) => s.visibility === 'hidden')!
    const visible = front.projection.segments.find(
      (s) => s.visibility === 'visible' && s.edgeIds.length === 1,
    )!
    const base = drawingToSvg(drawing)
    const asVisible = drawingToSvg(
      applyDrawingMutation(drawing, {
        kind: 'hidden-as-visible',
        view: 'front',
        edgeIds: hidden.edgeIds,
      }),
    )
    expect(count(asVisible, 'hiddenEdge')).toBeLessThan(count(base, 'hiddenEdge'))
    const asHidden = drawingToSvg(
      applyDrawingMutation(drawing, {
        kind: 'visible-as-hidden',
        view: 'front',
        edgeIds: visible.edgeIds,
      }),
    )
    expect(count(asHidden, 'hiddenEdge')).toBeGreaterThan(count(base, 'hiddenEdge'))
    const removed = applyDrawingMutation(drawing, {
      kind: 'remove-edge',
      view: 'front',
      edgeIds: hidden.edgeIds,
    })
    expect(removed.views[0]!.projection.segments.length).toBeLessThan(
      front.projection.segments.length,
    )
  })

  it('kandidáti mutací mají správný kód chyby a hranu dost dlouhou na to, aby byla vidět', () => {
    const mesh = buildPart(wasm, spec)
    const edges = extractEdges(mesh)
    const drawing = createDrawing(spec, mesh, { edges })
    for (const view of drawing.views) {
      const candidates = drawingMutationCandidates(view, () => undefined)
      expect(candidates.length).toBeGreaterThan(0)
      for (const c of candidates) {
        expect(DRAWING_MUTATION_ERROR[c.mutation.kind]).toMatch(/^(HIDDEN|VISIBLE|MISSING)/)
        expect(c.mutation.view).toBe(view.view)
        expect(c.mutation.edgeIds.length).toBeGreaterThan(0)
      }
    }
  })
})
