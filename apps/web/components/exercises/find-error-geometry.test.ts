import type { ViewPlacement } from '@vykresovna/exercises'
import { describe, expect, it } from 'vitest'
import {
  cellArea,
  cellOf,
  cellRect,
  drawingToView,
  locateView,
  targetPoint,
  viewToDrawing,
} from './find-error-geometry'

// bokorys: souřadnice u jsou záporné (jako v enginu), na výkrese vpravo od nárysu
const front: ViewPlacement = { view: 'front', origin: [8, 8], size: [60, 30], min: [0, 0] }
const left: ViewPlacement = { view: 'left', origin: [84, 8], size: [30, 30], min: [-30, 0] }

describe('geometrie „najdi chybu“', () => {
  it('převod výkres ↔ pohled je vzájemně inverzní, y výkresu jde dolů', () => {
    expect(drawingToView(front, 8, 8)).toEqual([0, 30]) // levý horní roh
    expect(drawingToView(front, 68, 38)).toEqual([60, 0])
    expect(drawingToView(left, 84, 38)).toEqual([-30, 0])
    for (const p of [front, left]) {
      const pt = drawingToView(p, p.origin[0] + 7, p.origin[1] + 11)
      expect(viewToDrawing(p, pt)).toEqual([p.origin[0] + 7, p.origin[1] + 11])
    }
  })

  it('najde pohled pod kliknutím i kousek vedle obrysu', () => {
    expect(locateView([front, left], 30, 20, 4)?.view).toBe('front')
    expect(locateView([front, left], 70, 20, 4)?.view).toBe('front')
    expect(locateView([front, left], 82, 20, 4)?.view).toBe('left')
    expect(locateView([front, left], 76, 20, 4)).toBeNull()
    expect(locateView([front, left], 30, 60, 4)).toBeNull()
  })

  it('oblasti 3 × 3: řádek 0 nahoře, bod padne do své oblasti', () => {
    expect(cellArea(front, 0, 0)).toEqual({ min: [0, 20], max: [20, 30] })
    expect(cellArea(front, 2, 2)).toEqual({ min: [40, 0], max: [60, 10] })
    expect(cellRect(front, 1, 1)).toEqual({ x: 28, y: 18, width: 20, height: 10 })
    expect(cellOf(front, [5, 28])).toEqual([0, 0])
    expect(cellOf(front, [60, 0])).toEqual([2, 2]) // na okraji zůstane v pohledu
    expect(cellOf(left, [-1, 15])).toEqual([1, 2])
    const area = cellArea(left, ...cellOf(left, [-1, 15]))
    expect(area.min[0]).toBeLessThanOrEqual(-1)
    expect(area.max[0]).toBeGreaterThanOrEqual(-1)
  })

  it('typický bod místa chyby', () => {
    expect(targetPoint({ kind: 'view', view: 'front' }, front)).toEqual([30, 15])
    expect(
      targetPoint(
        { kind: 'lines', view: 'front', segments: [{ a: [0, 10], b: [20, 10] }], edgeIds: [] },
        front,
      ),
    ).toEqual([10, 10])
  })
})
