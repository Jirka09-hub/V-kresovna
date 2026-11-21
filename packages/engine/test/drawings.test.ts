import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import {
  buildPart,
  createDrawing,
  drawingToSvg,
  extractEdges,
  loadManifold,
  projectView,
  TEST_PARTS,
  type PartSpec,
  type ViewProjection,
} from '../src'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await loadManifold()
})

const part = (id: string): PartSpec => TEST_PARTS.find((p) => p.id.startsWith(id))!

function project(spec: PartSpec, view: 'front' | 'top' | 'left'): ViewProjection {
  const mesh = buildPart(wasm, spec)
  return projectView(mesh, extractEdges(mesh), view)
}

const lines = (p: ViewProjection, visibility: 'visible' | 'hidden') =>
  p.segments
    .filter((s) => s.visibility === visibility)
    .map((s) => `${s.a.join(',')}→${s.b.join(',')}`)
    .sort()

describe('výkresy testovacích součástí (vizuální snapshoty SVG)', () => {
  for (const spec of TEST_PARTS) {
    it(`${spec.id}: ${spec.note}`, async () => {
      const mesh = buildPart(wasm, spec)
      const svg = drawingToSvg(createDrawing(spec, mesh))
      await expect(svg).toMatchFileSnapshot(`./__snapshots__/${spec.id}.svg`)
    })
  }
})

describe('viditelnost hran na známých případech', () => {
  it('kvádr nemá žádné skryté hrany a každý pohled je obdélník', () => {
    for (const v of ['front', 'top', 'left'] as const) {
      const p = project(part('01'), v)
      expect(lines(p, 'hidden')).toEqual([])
      expect(lines(p, 'visible')).toHaveLength(4)
    }
  })

  it('průchozí díra shora: v nárysu dvě skryté svislé čáry na průměru díry', () => {
    const p = project(part('03'), 'front')
    expect(lines(p, 'hidden')).toEqual(['24,0→24,20', '36,0→36,20'])
  })

  it('průchozí díra shora: v bokorysu zleva skryté čáry v hloubce y = 14 a 26', () => {
    // bokorys zleva: doprava v obrázku míří −Y, proto jsou souřadnice záporné
    const p = project(part('03'), 'left')
    expect(lines(p, 'hidden')).toEqual(['-14,0→-14,20', '-26,0→-26,20'])
  })

  it('slepá díra: skryté obrysy v nárysu končí ve hloubce 18 mm a dno je skrytá čára', () => {
    const p = project(part('04'), 'front')
    expect(lines(p, 'hidden')).toEqual(['15,12→15,30', '15,12→25,12', '25,12→25,30'])
  })

  it('drážka: v bokorysu zleva je dno drážky skrytá vodorovná hrana', () => {
    const p = project(part('05'), 'left')
    expect(lines(p, 'hidden')).toEqual(['-40,18→0,18'])
  })

  it('osazení: v bokorysu zleva je hrana osazení skrytá', () => {
    const p = project(part('06'), 'left')
    expect(lines(p, 'hidden')).toEqual(['-40,25→0,25'])
  })

  it('díra pod drážkou: v půdorysu jsou obrysy díry skryté pod dnem drážky', () => {
    const p = project(part('09'), 'top')
    expect(lines(p, 'hidden')).toEqual(['35,0→35,50', '45,0→45,50'])
  })

  it('souběžné hrany: hrana výřezu vzadu je v nárysu skrytá, horní hrana zůstává viditelná', () => {
    const p = project(part('10'), 'front')
    expect(lines(p, 'hidden')).toContain('0,30→60,30')
    expect(lines(p, 'visible')).toContain('0,40→60,40')
    // horní hrana se nesmí objevit zároveň jako skrytá
    expect(lines(p, 'hidden')).not.toContain('0,40→60,40')
  })
})

describe('rozmístění pohledů na výkrese', () => {
  it('půdorys leží pod nárysem a bokorys vpravo od nárysu (evropské promítání)', () => {
    const spec = part('02')
    const d = createDrawing(spec, buildPart(wasm, spec))
    const front = d.views.find((v) => v.view === 'front')!
    const top = d.views.find((v) => v.view === 'top')!
    const left = d.views.find((v) => v.view === 'left')!
    expect(top.origin[0]).toBe(front.origin[0])
    expect(top.origin[1]).toBeGreaterThan(front.origin[1] + front.size[1])
    expect(left.origin[1]).toBe(front.origin[1])
    expect(left.origin[0]).toBeGreaterThan(front.origin[0] + front.size[0])
  })

  it('americké rozmístění existuje jen jako výuková ukázka a je zrcadlové', () => {
    const spec = part('02')
    const d = createDrawing(spec, buildPart(wasm, spec), { layout: 'third-angle-demo' })
    const front = d.views.find((v) => v.view === 'front')!
    const top = d.views.find((v) => v.view === 'top')!
    const left = d.views.find((v) => v.view === 'left')!
    expect(d.layout).toBe('third-angle-demo')
    expect(top.origin[1]).toBeLessThan(front.origin[1])
    expect(left.origin[0]).toBeLessThan(front.origin[0])
  })
})
