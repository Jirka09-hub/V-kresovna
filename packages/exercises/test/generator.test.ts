import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import {
  buildPart,
  createDrawing,
  loadManifold,
  validatePart,
  type PartSpec,
} from '@vykresovna/engine'
import { createRng, DIFFICULTIES, generatePart, layoutOk, type Difficulty } from '../src'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await loadManifold()
})

const SEEDS = Array.from({ length: 120 }, (_, i) => i * 7919 + 13)
const kinds = (p: PartSpec) => p.features.map((f) => f.kind)
const isBlind = (p: PartSpec) => p.features.some((f) => f.kind === 'hole' && f.depth !== undefined)
const isThrough = (p: PartSpec) =>
  p.features.some((f) => f.kind === 'hole' && f.depth === undefined)

/** Požadavky na složení součásti podle obtížnosti. */
const COMPOSITION: Record<Difficulty, (p: PartSpec) => boolean> = {
  1: (p) => p.features.length === 1 && ['cutout', 'step'].includes(p.features[0]!.kind),
  2: (p) =>
    p.features.length === 2 &&
    ['cutout', 'step'].includes(p.features[0]!.kind) &&
    (kinds(p).includes('slot') || isThrough(p)),
  3: (p) =>
    p.features.length >= 2 &&
    p.features.length <= 3 &&
    (kinds(p).includes('hole') || kinds(p).includes('chamfer')),
  4: (p) =>
    p.features.length >= 3 && p.features.length <= 4 && (isBlind(p) || kinds(p).includes('rib')),
  5: (p) => p.features.length >= 4 && p.features.length <= 5 && isBlind(p),
}

describe('generátor součástí', () => {
  it('createRng je deterministický a v rozsahu', () => {
    const a = createRng(42)
    const b = createRng(42)
    const xs = Array.from({ length: 100 }, () => a.next())
    expect(xs).toEqual(Array.from({ length: 100 }, () => b.next()))
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
    const r = createRng(1)
    for (let i = 0; i < 100; i++) {
      const n = r.int(3, 5)
      expect(n >= 3 && n <= 5 && Number.isInteger(n)).toBe(true)
    }
  })

  for (const d of DIFFICULTIES) {
    it(`obtížnost ${d}: validní, čitelné součásti se správným složením`, () => {
      for (const seed of SEEDS) {
        const p = generatePart(seed, d)
        expect(p.id).toBe(`gen-${d}-${seed}`)
        expect(validatePart(p)).toEqual([])
        expect(layoutOk(p), JSON.stringify(p)).toBe(true)
        expect(COMPOSITION[d](p), JSON.stringify(p)).toBe(true)
        for (const s of p.base.size) {
          expect(s).toBeGreaterThanOrEqual(30)
          expect(s).toBeLessThanOrEqual(100)
        }
      }
    })

    it(`obtížnost ${d}: součásti jdou postavit (manifold) a jsou deterministické`, () => {
      for (const seed of SEEDS.slice(0, 30)) {
        const p = generatePart(seed, d)
        expect(generatePart(seed, d)).toEqual(p)
        const mesh = buildPart(wasm, p)
        expect(mesh.volume).toBeGreaterThan(0)
      }
    })
  }

  it('různé seedy dávají různé součásti', () => {
    for (const d of DIFFICULTIES) {
      const keys = new Set(SEEDS.map((s) => JSON.stringify(generatePart(s, d).features)))
      expect(keys.size).toBeGreaterThan(SEEDS.length * 0.8)
    }
  })

  it('obtížnost 5 vytváří častěji souběžné hrany různých prvků než obtížnost 3', () => {
    /** Prvky, ze kterých hrana vzniká (z id ploch: p:<pořadí>:…, cyl:<id>, cone:<id>; základ se nepočítá). */
    const tokens = (edgeId: string) =>
      new Set(
        [...edgeId.matchAll(/(?:p:(\d+):|(?:cyl|cone):(\w+))/g)]
          .map((m) => m[1] ?? m[2]!)
          .filter((t) => t !== '0'),
      )
    const rate = (d: Difficulty) => {
      let n = 0
      for (const seed of SEEDS.slice(0, 30)) {
        const p = generatePart(seed, d)
        const drawing = createDrawing(p, buildPart(wasm, p))
        for (const v of drawing.views) {
          for (const seg of v.projection.segments) {
            const sets = seg.edgeIds.map(tokens).filter((t) => t.size > 0)
            const disjoint = sets.some((a, i) =>
              sets.slice(i + 1).some((b) => [...a].every((t) => !b.has(t))),
            )
            if (disjoint) n++
          }
        }
      }
      return n / 30
    }
    expect(rate(5)).toBeGreaterThan(rate(3))
  })
})
