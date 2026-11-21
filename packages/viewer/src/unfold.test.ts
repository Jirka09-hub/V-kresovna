import { describe, expect, it } from 'vitest'
import { unfoldPhase } from './unfold'

describe('časová osa rozložení průměten', () => {
  it('na začátku nic není a těleso je plně vidět', () => {
    expect(unfoldPhase(0)).toMatchObject({
      planes: 0,
      drawing: 0,
      fold: 0,
      body: 1,
      cameraFront: false,
    })
  })
  it('na konci jsou průmětny sklopené o 90° a těleso zmizelo', () => {
    const p = unfoldPhase(1)
    expect(p.fold).toBeCloseTo(Math.PI / 2)
    expect(p.body).toBe(0)
    expect(p.cameraFront).toBe(true)
  })
  it('sklápění začíná až po nakreslení pohledů', () => {
    expect(unfoldPhase(0.5).drawing).toBe(1)
    expect(unfoldPhase(0.5).fold).toBe(0)
  })
  it('hodnoty mimo rozsah se ořežou', () => {
    expect(unfoldPhase(-1)).toEqual(unfoldPhase(0))
    expect(unfoldPhase(2)).toEqual(unfoldPhase(1))
  })
})
