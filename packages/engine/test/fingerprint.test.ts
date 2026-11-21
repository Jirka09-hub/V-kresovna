import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import {
  buildPart,
  canonicalView,
  createDrawing,
  drawingFingerprint,
  loadManifold,
  TEST_PARTS,
  viewFingerprint,
  type Drawing,
  type DrawingView,
  type PartSpec,
} from '../src'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await loadManifold()
})

const part = (id: string): PartSpec => TEST_PARTS.find((p) => p.id.startsWith(id))!
const drawing = (spec: PartSpec): Drawing => createDrawing(spec, buildPart(wasm, spec))
const view = (d: Drawing, name: string): DrawingView => d.views.find((v) => v.view === name)!

describe('otisk pohledu', () => {
  it('stejná součást dává stejný otisk i při novém sestavení', () => {
    const a = drawing(part('10'))
    const b = drawing(part('10'))
    expect(drawingFingerprint(a)).toBe(drawingFingerprint(b))
  })

  it('nezávisí na poloze pohledu na výkrese ani na jeho názvu', () => {
    const d = drawing(part('03'))
    const front = view(d, 'front')
    const moved: DrawingView = { ...front, view: 'top', origin: [123, 45] }
    expect(viewFingerprint(moved)).toBe(viewFingerprint(front))
  })

  it('nezávisí na rozdělení úseků ani na skryté čáře pod viditelnou', () => {
    const front = view(drawing(part('02')), 'front')
    const [first, ...rest] = front.projection.segments
    const mid: [number, number] = [(first!.a[0] + first!.b[0]) / 2, (first!.a[1] + first!.b[1]) / 2]
    const split: DrawingView = {
      ...front,
      projection: {
        ...front.projection,
        segments: [
          { ...first!, b: mid },
          { ...first!, a: mid },
          { ...first!, visibility: 'hidden' },
          ...rest,
        ],
      },
    }
    expect(viewFingerprint(split)).toBe(viewFingerprint(front))
  })

  it('změna viditelnosti nebo odebrání jedné hrany otisk změní', () => {
    const front = view(drawing(part('05')), 'left')
    const hiddenIdx = front.projection.segments.findIndex((s) => s.visibility === 'hidden')
    expect(hiddenIdx).toBeGreaterThanOrEqual(0)
    const asVisible: DrawingView = {
      ...front,
      projection: {
        ...front.projection,
        segments: front.projection.segments.map((s, i) =>
          i === hiddenIdx ? { ...s, visibility: 'visible' as const } : s,
        ),
      },
    }
    const removed: DrawingView = {
      ...front,
      projection: {
        ...front.projection,
        segments: front.projection.segments.filter((_, i) => i !== hiddenIdx),
      },
    }
    const fps = new Set([front, asVisible, removed].map(viewFingerprint))
    expect(fps.size).toBe(3)
  })

  it('posun díry o 1 mm otisk změní', () => {
    const base = part('03')
    const shifted: PartSpec = {
      ...base,
      features: [{ kind: 'hole', id: 'd1', axis: 'z', at: [31, 20], diameter: 12 }],
    }
    const a = view(drawing(base), 'front')
    const b = view(drawing(shifted), 'front')
    expect(viewFingerprint(a)).not.toBe(viewFingerprint(b))
  })

  it('jiný popis, ale stejně vypadající těleso dává stejný otisk', () => {
    // výřez rozdělený na dva navazující výřezy: plochy splynou, výkres je stejný
    const base = part('02')
    const split: PartSpec = {
      ...base,
      id: 'rozdeleny',
      features: [
        { kind: 'cutout', id: 'a', box: { min: [40, 0, 18], max: [50, 22, 30] } },
        { kind: 'cutout', id: 'b', box: { min: [50, 0, 18], max: [60, 22, 30] } },
      ],
    }
    expect(drawingFingerprint(drawing(split))).toBe(drawingFingerprint(drawing(base)))
  })

  it('všech 10 testovacích součástí má navzájem různé výkresy', () => {
    const fps = TEST_PARTS.map((p) => drawingFingerprint(drawing(p), ['front', 'top', 'left']))
    expect(new Set(fps).size).toBe(TEST_PARTS.length)
  })

  it('kanonický popis obsahuje kružnice a osy', () => {
    const top = view(drawing(part('03')), 'top')
    const text = canonicalView(top)
    expect(text).toContain('C 30000,20000 6000')
    expect(text).toMatch(/A /)
    expect(text).toMatch(/H |V /)
  })
})
