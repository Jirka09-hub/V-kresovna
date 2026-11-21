import type { PartRenderData } from '@vykresovna/engine'

/**
 * Engine používá Z nahoru (CAD), three.js Y nahoru. Celou scénu součásti dáme do skupiny
 * otočené o −90° kolem osy X; uvnitř pak pracujeme přímo v souřadnicích enginu.
 * Engine (x, y, z) → three (x, z, −y): přední strana (−Y) je v three.js na +Z, horní (+Z) na +Y.
 */
export const ENGINE_TO_THREE_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0]

export type Bounds = {
  center: [number, number, number]
  half: [number, number, number]
  radius: number
}

export function boundsOf(data: PartRenderData): Bounds {
  const { min, max } = data.bbox
  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ]
  const half: [number, number, number] = [
    (max[0] - min[0]) / 2,
    (max[1] - min[1]) / 2,
    (max[2] - min[2]) / 2,
  ]
  return { center, half, radius: Math.hypot(...half) }
}

/** Výchozí směr kamery (v three.js): zepředu, shora a zprava, jak se těleso kreslí v axonometrii. */
export const ISO_DIRECTION: [number, number, number] = [0.9, 0.85, 1.35]
