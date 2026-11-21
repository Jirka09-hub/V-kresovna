import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import {
  buildPart,
  createDrawing,
  drawingToSvg,
  extractEdges,
  loadManifold,
  projectView,
  symmetryPlanes,
  TEST_PARTS,
  SECTION_TEST_CASES,
  DRAWING_ROOT_CLASS,
  scopeCss,
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

  it('slepá díra: obrysy končí v hloubce 18 mm, pak kuželové dno 120° (vše skryté)', () => {
    const p = project(part('04'), 'front')
    const tip = Number((30 - 18 - 5 / Math.sqrt(3)).toFixed(4))
    expect(lines(p, 'hidden')).toEqual([
      '15,12→15,30',
      '15,12→25,12',
      `20,${tip}→15,12`,
      `20,${tip}→25,12`,
      '25,12→25,30',
    ])
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

describe('osy souměrnosti', () => {
  const planes = (id: string) => {
    const spec = part(id)
    return symmetryPlanes(spec, buildPart(wasm, spec)).map((pl) => `${pl.axis}=${pl.at}`)
  }

  it('holý kvádr ani součást bez souměrně umístěného prvku osy souměrnosti nemá', () => {
    expect(planes('01')).toEqual([])
    expect(planes('02')).toEqual([])
    expect(planes('06')).toEqual([])
    expect(planes('07')).toEqual([])
  })

  it('souměrně umístěná díra nebo drážka dává osu souměrnosti', () => {
    expect(planes('03')).toEqual(['x=30', 'y=20'])
    expect(planes('04')).toEqual(['y=20'])
    expect(planes('05')).toEqual(['x=40'])
    expect(planes('09')).toEqual(['x=40'])
  })

  it('osa díry splývající s osou souměrnosti se nekreslí podruhé', () => {
    const spec = part('03')
    const d = createDrawing(spec, buildPart(wasm, spec))
    const top = d.views.find((v) => v.view === 'top')!
    expect(top.centerLines.map((c) => c.featureId)).toEqual(['symmetry:x', 'symmetry:y'])
    const front = d.views.find((v) => v.view === 'front')!
    expect(front.centerLines).toEqual([{ a: [30, -3], b: [30, 23], featureId: 'symmetry:x' }])
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

describe('stabilita id', () => {
  it('klíče ploch nezávisí na tom, co se v instanci WASM stavělo dřív', () => {
    const spec = part('05')
    const keys = () => buildPart(wasm, spec).surfaces.map((s) => s.key)
    const first = keys()
    buildPart(wasm, part('08'))
    expect(keys()).toEqual(first)
    expect(first).toContain('p:0:0')
  })
})

describe('styl SVG výkresu', () => {
  it('každé pravidlo stylu je omezené na kořenovou třídu výkresu (inline SVG nemění zbytek stránky)', () => {
    const c = SECTION_TEST_CASES[0]!
    const mesh = buildPart(wasm, c.part)
    const drawing = createDrawing(c.part, mesh, {
      dimensions: true,
      section: { spec: c.section, view: c.view },
    })
    const svg = drawingToSvg(drawing)
    expect(svg).toContain(`<svg xmlns="http://www.w3.org/2000/svg" class="${DRAWING_ROOT_CLASS}"`)
    const css = /<style>(.*?)<\/style>/.exec(svg)![1]!
    const selectors = css
      .split('}')
      .filter(Boolean)
      .flatMap((rule) => rule.slice(0, rule.indexOf('{')).split(','))
    expect(selectors.length).toBeGreaterThan(10)
    for (const sel of selectors) expect(sel.startsWith(`.${DRAWING_ROOT_CLASS} `), sel).toBe(true)
  })

  it('scopeCss zachová deklarace a pořadí pravidel', () => {
    expect(scopeCss('a,b{x:1,2}.c{y:2}', 's')).toBe('.s a,.s b{x:1,2}.s .c{y:2}')
  })
})
