import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { buildPart, loadManifold, visualFingerprint } from '@vykresovna/engine'
import {
  buildOptionDrawing,
  DIFFICULTIES,
  generateTask,
  optionRender,
  sectionDrawing,
} from '../src'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await loadManifold()
})

/** Otisky možností tak, jak je uživatel uvidí (bez os, s přesností VISUAL_DIFFERENCE_MM). */
function optionLooks(
  kind: 'section' | 'missing-view' | 'drawing-to-model',
  seed: number,
  d: (typeof DIFFICULTIES)[number],
) {
  const t = generateTask(wasm, kind, seed, d)
  if (t.kind === 'section') {
    if (t.variant !== 'choose') return null
    return t.options.map((o) => {
      const r = optionRender(o)
      const dr = sectionDrawing(buildPart(wasm, r.part), {
        ...r,
        cuttingPlaneView: null,
        show: [r.view],
      })
      return visualFingerprint(dr.views.find((x) => x.view === r.view)!)
    })
  }
  if (t.kind === 'missing-view') {
    return t.options.map((o) =>
      visualFingerprint(buildOptionDrawing(wasm, o, [t.missingView]).views[0]!),
    )
  }
  if (t.kind === 'drawing-to-model') {
    return t.options.map((o) => buildOptionDrawing(wasm, o).views.map(visualFingerprint).join('|'))
  }
  return null
}

describe('možnosti se liší viditelně (aspoň o VISUAL_DIFFERENCE_MM, nejen délkou osy)', () => {
  for (const kind of ['section', 'missing-view', 'drawing-to-model'] as const) {
    for (const d of DIFFICULTIES) {
      it(`${kind}, obtížnost ${d}`, () => {
        for (let seed = 1; seed <= 8; seed++) {
          const looks = optionLooks(kind, seed, d)
          if (!looks) continue
          expect(new Set(looks).size, `seed ${seed}`).toBe(looks.length)
        }
      })
    }
  }
})
