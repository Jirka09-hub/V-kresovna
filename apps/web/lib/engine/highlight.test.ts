import { describe, expect, it } from 'vitest'
import { isRelated } from './highlight'

describe('propojení zvýraznění 3D ↔ 2D', () => {
  it('stejná hrana se zvýrazní', () => {
    expect(isRelated('p:1:0|p:1:2#0', 'p:1:0|p:1:2#0')).toBe(true)
    expect(isRelated('p:1:0|p:1:3#0', 'p:1:0|p:1:2#0')).toBe(false)
  })
  it('obrys díry ve 2D zvýrazní hrany díry ve 3D', () => {
    expect(isRelated('cyl:d1|p:2:3#0', 'sil:cyl:d1')).toBe(true)
    expect(isRelated('cyl:d2|p:2:3#0', 'sil:cyl:d1')).toBe(false)
  })
  it('hrana díry ve 3D zvýrazní její obrysy ve 2D', () => {
    expect(isRelated('sil:cyl:d1', 'cyl:d1|p:2:3#0')).toBe(true)
  })
  it('osa díry zvýrazní hrany díry', () => {
    expect(isRelated('cyl:d1|p:2:1#0', 'feature:d1')).toBe(true)
  })
})
