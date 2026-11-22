import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  axisPositionUnderRay,
  clipSegments,
  cutPlaneOfState,
  engineToWorld,
  sectionViewOf,
  worldClippingPlane,
} from './section'

const bounds = {
  center: [30, 20, 15] as [number, number, number],
  half: [30, 20, 15] as [number, number, number],
  radius: 40,
}

describe('interaktivní řez ve 3D', () => {
  it('výchozí strana pohledu odpovídá nárysu, bokorysu a půdorysu', () => {
    expect(sectionViewOf({ axis: 'y', at: 10 })).toBe('front')
    expect(sectionViewOf({ axis: 'x', at: 10 })).toBe('left')
    expect(sectionViewOf({ axis: 'z', at: 10 })).toBe('top')
    expect(sectionViewOf({ axis: 'y', at: 10, viewFrom: 'max' })).toBe('rear')
    // díváme se zepředu → zůstává zadní část (y ≥ at)
    expect(cutPlaneOfState({ axis: 'y', at: 10 }).keep).toBe('max')
    // díváme se shora → zůstává spodní část
    expect(cutPlaneOfState({ axis: 'z', at: 10 }).keep).toBe('min')
  })

  it('ořezávací rovina ve světě zachová stejnou stranu jako engine', () => {
    const plane = cutPlaneOfState({ axis: 'y', at: 10 })
    const world = worldClippingPlane(plane, bounds)
    const m = engineToWorld(bounds)
    const kept = new THREE.Vector3(5, 30, 5).applyMatrix4(m)
    const removed = new THREE.Vector3(5, 2, 5).applyMatrix4(m)
    expect(world.distanceToPoint(kept)).toBeGreaterThan(0)
    expect(world.distanceToPoint(removed)).toBeLessThan(0)
  })

  it('hrany se oříznou na zachovanou stranu', () => {
    const plane = cutPlaneOfState({ axis: 'y', at: 10 })
    const res = clipSegments(
      [
        [0, 0, 0],
        [0, 20, 0], // protíná rovinu
        [0, 0, 5],
        [5, 5, 5], // celá odebraná
        [0, 15, 0],
        [9, 15, 0], // celá zůstává
      ],
      plane,
    )
    expect(res.points).toEqual([
      [0, 10, 0],
      [0, 20, 0],
      [0, 15, 0],
      [9, 15, 0],
    ])
    expect(res.source).toEqual([0, 2])
  })

  it('tažení: poloha na ose nejblíž paprsku', () => {
    // paprsek kolmo na osu y prochází bodem y = 12
    expect(axisPositionUnderRay('y', [0, 0, 0], [100, 12, 3], [-1, 0, 0])).toBeCloseTo(12, 9)
    // paprsek rovnoběžný s osou nic neurčí
    expect(axisPositionUnderRay('y', [0, 0, 0], [1, 2, 3], [0, 1, 0])).toBeNull()
  })
})
