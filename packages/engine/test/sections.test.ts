import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { HATCH_SPACING_MM } from '@vykresovna/drafting-standards'
import {
  buildPart,
  createDrawing,
  cutSolid,
  drawingToSvg,
  extractEdges,
  hatchLines,
  loadManifold,
  pointInRing,
  sectionCap,
  SECTION_TEST_CASES,
  TEST_PARTS,
  type Drawing,
  type DrawingView,
  type PartSpec,
  type Vec2,
} from '../src'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await loadManifold()
})

const sectionCase = (id: string) => SECTION_TEST_CASES.find((c) => c.part.id.startsWith(id))!

function sectionDrawing(id: string): Drawing {
  const c = sectionCase(id)
  return createDrawing(c.part, buildPart(wasm, c.part), {
    section: { spec: c.section, view: c.view },
  })
}

const viewOf = (d: Drawing, name: string): DrawingView => d.views.find((v) => v.view === name)!

describe('výkresy řezů (vizuální snapshoty SVG)', () => {
  for (const c of SECTION_TEST_CASES) {
    it(`${c.part.id}: ${c.part.note}`, async () => {
      const mesh = buildPart(wasm, c.part)
      const svg = drawingToSvg(
        createDrawing(c.part, mesh, { section: { spec: c.section, view: c.view } }),
      )
      await expect(svg).toMatchFileSnapshot(`./__snapshots__/${c.part.id}.svg`)
    })
  }
})

describe('rozříznutí tělesa', () => {
  it('zbytek kvádru je uzavřené těleso se správným objemem', () => {
    const spec = TEST_PARTS[0]! // kvádr 60 × 40 × 30
    const mesh = buildPart(wasm, spec)
    const rest = cutSolid(mesh, { axis: 'y', at: 10, keep: 'max' }, 'section:A')
    expect(rest.volume).toBeCloseTo(60 * 30 * 30, 6)
    expect(rest.bbox.min).toEqual([0, 10, 0])
    // každá hrana sítě sousedí právě se dvěma trojúhelníky
    const edges = extractEdges(rest)
    const meshEdgeCount = edges.meshEdges.length
    expect(meshEdgeCount * 2).toBe(rest.triangles.length) // 3 hrany na trojúhelník, každá sdílená
    expect(rest.surfaces.at(-1)!.key).toBe('section:A')
  })

  it('průchozí díra kolmo na rovinu zůstane v ploše řezu dírou', () => {
    const spec = TEST_PARTS.find((p) => p.id === '03-dira-pruchozi')! // díra Ø12 shora v (30, 20)
    const cap = sectionCap(buildPart(wasm, spec), { axis: 'z', at: 10, keep: 'min' })
    expect(cap.loops).toHaveLength(2)
    // plocha řezu = obdélník bez kruhu (96úhelník)
    let area = 0
    for (let t = 0; t < cap.triangles.length; t += 9) {
      const [ax, ay, , bx, by, , cx, cy] = cap.triangles.slice(t, t + 9)
      area += Math.abs((bx! - ax!) * (cy! - ay!) - (cx! - ax!) * (by! - ay!)) / 2
    }
    const polygon = (96 / 2) * 36 * Math.sin((2 * Math.PI) / 96)
    expect(area).toBeCloseTo(60 * 40 - polygon, 3)
    expect(cap.normal).toEqual([0, 0, 1])
  })

  it('rovina přesně ve stěně součásti se posune do materiálu', () => {
    const spec = TEST_PARTS.find((p) => p.id === '06-osazeni')! // osazení od z = 25
    const cap = sectionCap(buildPart(wasm, spec), { axis: 'z', at: 25, keep: 'min' })
    expect(cap.at).toBeLessThan(25)
    expect(cap.loops).toHaveLength(1)
  })
})

describe('šrafování', () => {
  const square: Vec2[] = [
    [0, 0],
    [20, 0],
    [20, 20],
    [0, 20],
  ]

  it('šrafy jsou pod 45° a ve stejné rozteči', () => {
    const lines = hatchLines([square], 45, 2.5)
    expect(lines.length).toBeGreaterThan(5)
    for (const l of lines) {
      const ang = (Math.atan2(l.b[1] - l.a[1], l.b[0] - l.a[0]) * 180) / Math.PI
      expect(ang).toBeCloseTo(45, 3)
    }
    // vzdálenost sousedních čar (kolmo) = rozteč
    const offsets = lines.map((l) => (l.a[1] - l.a[0]) / Math.SQRT2).sort((a, b) => a - b)
    for (let i = 1; i < offsets.length; i++) {
      expect(offsets[i]! - offsets[i - 1]!).toBeCloseTo(2.5, 3)
    }
  })

  it('šrafy leží uvnitř plochy a díru vynechají', () => {
    const hole: Vec2[] = [
      [6, 6],
      [6, 14],
      [14, 14],
      [14, 6],
    ]
    const lines = hatchLines([square, hole], 45, 1)
    const ring = (r: Vec2[]) => r.map((p) => ({ x: p[0], y: p[1] }))
    for (const l of lines) {
      for (const t of [0.01, 0.25, 0.5, 0.75, 0.99]) {
        const x = l.a[0] + (l.b[0] - l.a[0]) * t
        const y = l.a[1] + (l.b[1] - l.a[1]) * t
        expect(pointInRing(x, y, ring(square))).toBe(true)
        expect(pointInRing(x, y, ring(hole))).toBe(false)
      }
    }
  })
})

describe('pohled v řezu na známých případech', () => {
  it('nárys je nahrazený řezem A–A, stopa řezu je v půdorysu', () => {
    const d = sectionDrawing('rez-01')
    const front = viewOf(d, 'front')
    expect(front.section?.title).toBe('A–A')
    expect(front.cuttingPlanes).toBeUndefined()
    const top = viewOf(d, 'top')
    expect(top.cuttingPlanes).toHaveLength(1)
    const mark = top.cuttingPlanes![0]!
    // rovina y = 25 je v půdorysu vodorovná čára v = 25, přesahuje obrys o 5 mm
    expect(mark.line).toEqual({ a: [-5, 25], b: [85, 25] })
    // šipky míří ve směru pohledu nárysu (dozadu = v půdorysu nahoru)
    for (const ar of mark.arrows) expect(ar.tip[1]).toBeGreaterThan(ar.tail[1])
    expect(viewOf(d, 'left').cuttingPlanes).toBeUndefined()
  })

  it('v řezu nejsou skryté hrany', () => {
    const front = viewOf(sectionDrawing('rez-01'), 'front')
    expect(front.projection.segments.every((s) => s.visibility === 'visible')).toBe(true)
  })

  it('průchozí díra rozdělí plochu řezu, vodorovná díra je v ploše díra bez šraf', () => {
    const front = viewOf(sectionDrawing('rez-01'), 'front')
    const faces = front.section!.faces
    // díra d1 (x 14–26) jde přes celou výšku → dvě samostatné plochy
    expect(faces).toHaveLength(2)
    const withHole = faces.filter((f) => f.holes.length > 0)
    expect(withHole).toHaveLength(1)
    // díra d3 (Ø8 v x = 40, z = 10): střed díry není šrafovaný
    const hatch = front.section!.hatching
    const insideCircle = hatch.some((h) => {
      for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const x = h.a[0] + (h.b[0] - h.a[0]) * t
        const y = h.a[1] + (h.b[1] - h.a[1]) * t
        if (Math.hypot(x - 40, y - 10) < 3.9) return true
      }
      return false
    })
    expect(insideCircle).toBe(false)
    // v průchozí díře (x 14–26) žádné šrafy
    expect(hatch.some((h) => (h.a[0] + h.b[0]) / 2 > 14.1 && (h.a[0] + h.b[0]) / 2 < 25.9)).toBe(
      false,
    )
  })

  it('šrafy pod 45° v rozteči z drafting-standards', () => {
    const hatch = viewOf(sectionDrawing('rez-01'), 'front').section!.hatching
    expect(hatch.length).toBeGreaterThan(20)
    for (const h of hatch) {
      const ang = (Math.atan2(h.b[1] - h.a[1], h.b[0] - h.a[0]) * 180) / Math.PI
      expect(ang).toBeCloseTo(45, 2)
    }
    const offsets = [
      ...new Set(hatch.map((h) => Math.round(((h.a[1] - h.a[0]) / Math.SQRT2) * 1e3))),
    ]
    offsets.sort((a, b) => a - b)
    const gaps = offsets.slice(1).map((o, i) => (o - offsets[i]!) / 1e3)
    expect(Math.min(...gaps)).toBeCloseTo(HATCH_SPACING_MM, 2)
  })

  it('SVG nese označení řezu a stopu roviny řezu', () => {
    const svg = drawingToSvg(sectionDrawing('rez-01'))
    expect(svg).toContain('data-section="A"')
    expect(svg).toContain('data-cutting-plane="A"')
    expect(svg).toContain('>A–A</text>')
    expect(svg).toContain('class="hatching"')
    expect(svg).toContain('class="sectionFace"')
    expect(svg.match(/class="cuttingPlaneEnd"/g)).toHaveLength(2)
    expect(svg.match(/class="cuttingPlaneArrowHead"/g)).toHaveLength(2)
    expect(svg.match(/class="sectionLetter"[^>]*>A</g)).toHaveLength(2)
  })

  it('vodorovný řez: stopa v nárysu, šipky dolů (díváme se shora)', () => {
    const d = sectionDrawing('rez-02')
    expect(viewOf(d, 'top').section).toBeDefined()
    const mark = viewOf(d, 'front').cuttingPlanes![0]!
    expect(mark.line.a[1]).toBe(25)
    for (const ar of mark.arrows) expect(ar.tip[1]).toBeLessThan(ar.tail[1])
  })

  it('řez v bokorysu: stopa v nárysu je svislá, šipky doprava', () => {
    const d = sectionDrawing('rez-03')
    const mark = viewOf(d, 'front').cuttingPlanes![0]!
    expect(mark.line.a[0]).toBe(35)
    expect(mark.line.b[0]).toBe(35)
    for (const ar of mark.arrows) expect(ar.tip[0]).toBeGreaterThan(ar.tail[0])
    // stěna drážky za rovinou řezu je vidět (horní hrana z = 30 přes šířku drážky)
    const left = viewOf(d, 'left')
    expect(left.projection.segments.some((s) => s.a[1] === 30 && s.b[1] === 30)).toBe(true)
  })

  it('pohledy zůstanou zarovnané a popisy se vejdou na výkres', () => {
    for (const c of SECTION_TEST_CASES) {
      const d = createDrawing(c.part, buildPart(wasm, c.part), {
        section: { spec: c.section, view: c.view },
      })
      const front = viewOf(d, 'front')
      const top = viewOf(d, 'top')
      const left = viewOf(d, 'left')
      expect(top.origin[0]).toBe(front.origin[0])
      expect(left.origin[1]).toBe(front.origin[1])
      const sectionView = viewOf(d, c.view)
      // nad pohledem v řezu je místo na nápis
      expect(sectionView.origin[1]).toBeGreaterThanOrEqual(8 + 5 + 4 - 1e-9)
      expect(d.width).toBeGreaterThan(0)
    }
  })

  it('výkres bez řezu se nezmění', () => {
    const spec: PartSpec = sectionCase('rez-01').part
    const mesh = buildPart(wasm, spec)
    const svg = drawingToSvg(createDrawing(spec, mesh))
    expect(svg).not.toContain('data-section')
    expect(svg).not.toContain('hatching')
  })

  it('řez z nesprávné strany nebo mimo součást se odmítne', () => {
    const c = sectionCase('rez-01')
    const mesh = buildPart(wasm, c.part)
    expect(() =>
      createDrawing(c.part, mesh, {
        section: { spec: { ...c.section, viewFrom: 'max' }, view: 'front' },
      }),
    ).toThrow()
    expect(() =>
      createDrawing(c.part, mesh, { section: { spec: { ...c.section, at: 80 }, view: 'front' } }),
    ).toThrow()
    expect(() =>
      createDrawing(c.part, mesh, { section: { spec: c.section, view: 'top' } }),
    ).toThrow()
    expect(() =>
      createDrawing(c.part, mesh, {
        section: { spec: { ...c.section, label: 'O' }, view: 'front' },
      }),
    ).toThrow()
  })
})
