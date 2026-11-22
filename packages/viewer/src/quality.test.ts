import { describe, expect, it } from 'vitest'
import { initialDpr, qualityDecision } from './quality'

const frames = (ms: number) => Array.from({ length: 30 }, () => ms)

describe('přizpůsobení kvality 3D', () => {
  it('výchozí rozlišení nepřekročí hustotu displeje', () => {
    expect(initialDpr(1)).toEqual({ start: 1, max: 1 })
    expect(initialDpr(1.25)).toEqual({ start: 1.25, max: 1.25 })
    expect(initialDpr(3)).toEqual({ start: 1.5, max: 2 })
  })

  it('pomalé snímky sníží rozlišení, rychlé ho vrátí', () => {
    expect(qualityDecision(frames(50), 1.5, 2, 0)).toEqual({ kind: 'set', dpr: 1 })
    expect(qualityDecision(frames(10), 1, 2, 1)).toEqual({ kind: 'set', dpr: 1.5 })
    expect(qualityDecision(frames(30), 1.5, 2, 0)).toEqual({ kind: 'keep' })
  })

  it('při nejnižším rozlišení a pod 10 fps ohlásí, že 3D je moc pomalé', () => {
    expect(qualityDecision(frames(150), 1, 1, 0)).toEqual({ kind: 'unusable' })
    expect(qualityDecision(frames(60), 1, 1, 0)).toEqual({ kind: 'keep' })
  })

  it('po několika změnách už kvalitou nehýbe', () => {
    expect(qualityDecision(frames(50), 1.5, 2, 4)).toEqual({ kind: 'keep' })
    expect(qualityDecision(frames(10), 1, 2, 4)).toEqual({ kind: 'keep' })
  })
})
