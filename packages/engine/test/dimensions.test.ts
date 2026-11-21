import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { isReadableRotation } from '@vykresovna/drafting-standards'
import {
  buildPart,
  createDrawing,
  drawingToSvg,
  partDimensions,
  symmetryPlanes,
  TEST_PARTS,
  type Drawing,
  type DrawingDimension,
  type PartSpec,
  type Vec2,
} from '../src'

let wasm: ManifoldToplevel
const drawings = new Map<string, Drawing>()
beforeAll(async () => {
  const { loadManifold } = await import('../src')
  wasm = await loadManifold()
  for (const spec of TEST_PARTS) {
    drawings.set(spec.id, createDrawing(spec, buildPart(wasm, spec), { dimensions: true }))
  }
})

const part = (id: string): PartSpec => TEST_PARTS.find((p) => p.id.startsWith(id))!
const allDims = (d: Drawing): DrawingDimension[] => d.views.flatMap((v) => v.dimensions ?? [])
const texts = (d: Drawing) =>
  allDims(d)
    .map((x) => `${x.view}:${x.text}`)
    .sort()

describe('kótované výkresy testovacích součástí (vizuální snapshoty SVG)', () => {
  for (const spec of TEST_PARTS) {
    it(`${spec.id}`, async () => {
      const svg = drawingToSvg(drawings.get(spec.id)!)
      await expect(svg).toMatchFileSnapshot(`./__snapshots__/dims/${spec.id}.svg`)
    })
  }
})

describe('kóty z popisu součásti', () => {
  it('kvádr: jen tři celkové rozměry', () => {
    expect(texts(drawings.get('01-kvadr')!)).toEqual(['front:30', 'front:60', 'top:40'])
  })

  it('výřez v rohu: velikost ve třech osách od stěn, kterých se dotýká', () => {
    const dims = partDimensions(part('02'))
    expect(dims.filter((d) => d.featureId === 'v1').map((d) => `${d.axis}=${d.text}`)).toEqual([
      'x=20',
      'y=22',
      'z=12',
    ])
  })

  it('průchozí díra uprostřed souměrné součásti: jen průměr, poloha plyne ze souměrnosti', () => {
    const d = drawings.get('03-dira-pruchozi')!
    const hole = allDims(d).filter((x) => x.featureId === 'd1')
    expect(hole.map((x) => `${x.view}:${x.text}`)).toEqual(['top:⌀12'])
  })

  it('slepá díra: průměr u kružnice, poloha od levé stěny, hloubka bez kuželového dna', () => {
    const d = drawings.get('04-dira-slepa')!
    const hole = allDims(d)
      .filter((x) => x.featureId === 'd1')
      .map((x) => `${x.view}:${x.role}:${x.text}`)
      .sort()
    expect(hole).toEqual(['front:depth:18', 'top:diameter:⌀10', 'top:position:20'])
  })

  it('drážka: šířka a hloubka v nárysu (skutečný tvar), poloha na ose souměrnosti se nekótuje', () => {
    const d = drawings.get('05-drazka')!
    const slot = allDims(d)
      .filter((x) => x.featureId === 's1')
      .map((x) => `${x.view}:${x.text}`)
      .sort()
    expect(slot).toEqual(['front:12', 'front:20'])
  })

  it('zkosení se kótuje jako „velikost × 45°“ v pohledu podél zkosené hrany', () => {
    const d = drawings.get('07-zkoseni')!
    const ch = allDims(d)
      .filter((x) => x.kind === 'chamfer')
      .map((x) => `${x.featureId}:${x.view}:${x.text}`)
      .sort()
    expect(ch).toEqual(['z1:left:8×45°', 'z2:top:6×45°'])
  })

  it('úhelník: výška desky ano, výška stěny ne (dopočítá se z celkové výšky)', () => {
    const dims = partDimensions(part('08'))
    const ids = dims.map((d) => d.id)
    expect(ids).toContain('dim:part:base:z')
    expect(ids).not.toContain('dim:stena:size:z')
    expect(ids).toContain('dim:stena:size:y')
  })

  it('výkres bez kót je stejný jako dřív (pohledy nemají pole dimensions)', () => {
    const spec = part('05')
    const plain = createDrawing(spec, buildPart(wasm, spec))
    expect(plain.views.every((v) => v.dimensions === undefined)).toBe(true)
    expect(drawingToSvg(plain)).not.toContain('data-dimension-id')
  })
})

/** Klíč měřeného úseku: osa a souřadnice (nezávislý na pohledu). */
function spanKey(spec: PartSpec, id: string): string {
  const d = partDimensions(spec, {
    symmetry: symmetryPlanes(spec, buildPart(wasm, spec)),
  }).find((x) => x.id === id)!
  return d.kind === 'diameter' ? `${d.featureId}:⌀` : `${d.kind}:${d.axis}:${d.span.join('-')}`
}

function overlap(a: readonly Vec2[], b: readonly Vec2[]): boolean {
  // obdélníky textů jsou osově rovnoběžné nebo šikmé: SAT přes hrany obou
  const axes: Vec2[] = []
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!
      const q = poly[(i + 1) % poly.length]!
      axes.push([q[1] - p[1], p[0] - q[0]])
    }
  }
  return axes.every((ax) => {
    const pa = a.map((p) => p[0] * ax[0] + p[1] * ax[1])
    const pb = b.map((p) => p[0] * ax[0] + p[1] * ax[1])
    return Math.max(...pa) > Math.min(...pb) + 1e-6 && Math.max(...pb) > Math.min(...pa) + 1e-6
  })
}

/** Kříží se úsečky v bodě uvnitř obou (dotyk v koncovém bodě se nepočítá)? */
function segmentsCrossStrict(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  const r: Vec2 = [p2[0] - p1[0], p2[1] - p1[1]]
  const s: Vec2 = [q2[0] - q1[0], q2[1] - q1[1]]
  const den = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(den) < 1e-12) return false
  const t = ((q1[0] - p1[0]) * s[1] - (q1[1] - p1[1]) * s[0]) / den
  const u = ((q1[0] - p1[0]) * r[1] - (q1[1] - p1[1]) * r[0]) / den
  const e = 1e-6
  return t > e && t < 1 - e && u > e && u < 1 - e
}

describe('pravidla kótování na všech testovacích součástech', () => {
  for (const spec of TEST_PARTS) {
    describe(spec.id, () => {
      it('každý rozměr je na výkrese právě jednou (a každá kóta má jedinečné id)', () => {
        const dims = allDims(drawings.get(spec.id)!)
        const ids = dims.map((d) => d.id)
        expect(new Set(ids).size).toBe(ids.length)
        const spans = ids.map((id) => spanKey(spec, id))
        expect(new Set(spans).size).toBe(spans.length)
        expect(dims.length).toBeGreaterThanOrEqual(3)
      })

      it('každý text je čitelný zdola nebo zprava; svislé kóty jsou otočené o −90°', () => {
        for (const d of allDims(drawings.get(spec.id)!)) {
          expect(isReadableRotation(d.textRotationDeg)).toBe(true)
          if (d.kind !== 'diameter') {
            const vertical = d.side === 'left' || d.side === 'right'
            expect(d.textRotationDeg).toBe(vertical ? -90 : 0)
          }
        }
      })

      it('texty kót se nepřekrývají', () => {
        for (const v of drawings.get(spec.id)!.views) {
          const dims = v.dimensions ?? []
          for (let i = 0; i < dims.length; i++) {
            for (let j = i + 1; j < dims.length; j++) {
              expect(
                overlap(dims[i]!.textBox, dims[j]!.textBox),
                `${dims[i]!.id} × ${dims[j]!.id}`,
              ).toBe(false)
            }
          }
        }
      })

      it('délkové kóty leží vně obrysu pohledu (kótovací čára i text)', () => {
        for (const v of drawings.get(spec.id)!.views) {
          const { min, max } = v.projection.bounds
          for (const d of v.dimensions ?? []) {
            if (d.kind === 'diameter') continue
            const pts = [
              ...d.lines.filter((l) => l.kind === 'dimensionLine').flatMap((l) => [l.a, l.b]),
              ...d.textBox,
            ]
            const outside = pts.every((p) => {
              if (d.side === 'top') return p[1] > max[1]
              if (d.side === 'bottom') return p[1] < min[1]
              if (d.side === 'left') return p[0] < min[0]
              return p[0] > max[0]
            })
            expect(outside, d.id).toBe(true)
          }
        }
      })

      it('kótovací čáry se nekříží s pomocnými čarami jiných kót', () => {
        for (const v of drawings.get(spec.id)!.views) {
          const dims = v.dimensions ?? []
          for (const d of dims) {
            for (const e of dims) {
              if (d === e) continue
              for (const l of d.lines.filter((x) => x.kind === 'dimensionLine')) {
                for (const q of e.lines.filter((x) => x.kind === 'extensionLine')) {
                  expect(segmentsCrossStrict(l.a, l.b, q.a, q.b), `${d.id} × ${e.id}`).toBe(false)
                }
              }
            }
          }
        }
      })

      it('výkres se zvětšil tak, aby se kóty vešly (žádná kóta nepřesahuje výkres)', () => {
        const drawing = drawings.get(spec.id)!
        for (const v of drawing.views) {
          const { min, max } = v.projection.bounds
          const tx = (p: Vec2): Vec2 => [v.origin[0] + p[0] - min[0], v.origin[1] + max[1] - p[1]]
          for (const d of v.dimensions ?? []) {
            for (const p of [...d.textBox, ...d.lines.flatMap((l) => [l.a, l.b])].map(tx)) {
              expect(p[0]).toBeGreaterThan(0)
              expect(p[1]).toBeGreaterThan(0)
              expect(p[0]).toBeLessThan(drawing.width)
              expect(p[1]).toBeLessThan(drawing.height)
            }
          }
        }
      })
    })
  }
})
