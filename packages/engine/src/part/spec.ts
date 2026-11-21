import type { Vec3 } from '@vykresovna/drafting-standards'

/**
 * Parametrický popis součásti. Součást je kvádr (základ) a seznam prvků, které se aplikují v pořadí.
 *
 * Souřadnice enginu: X doprava, Y dozadu (do hloubky), Z nahoru, vše v mm, celá čísla.
 * Základní kvádr leží v oblasti [0, sx] × [0, sy] × [0, sz].
 */

export type Axis = 'x' | 'y' | 'z'

/** Osově rovnoběžný kvádr zadaný protilehlými rohy. */
export type Box = {
  readonly min: Vec3
  readonly max: Vec3
}

/** Díra (válcová). Bez `depth` je průchozí, s `depth` slepá (začíná na stěně `from`). */
export type HoleFeature = {
  readonly kind: 'hole'
  readonly id: string
  readonly axis: Axis
  /** Poloha osy díry ve dvou zbývajících souřadnicích v pořadí (x, y, z) bez osy díry. */
  readonly at: readonly [number, number]
  readonly diameter: number
  /** Hloubka slepé díry. Chybí = průchozí díra. */
  readonly depth?: number
  /** U slepé díry: ze které strany díra začíná (min = stěna s nejmenší souřadnicí). */
  readonly from?: 'min' | 'max'
}

/** Odebrání osově rovnoběžného kvádru. Druh určuje význam pro výuku a pro mutace. */
export type BoxCutFeature = {
  /** slot = drážka, step = osazení, cutout = výřez nebo kapsa */
  readonly kind: 'slot' | 'step' | 'cutout'
  readonly id: string
  readonly box: Box
}

/** Zkosení hrany základního kvádru pod 45° (stejná velikost na obou stranách). */
export type ChamferFeature = {
  readonly kind: 'chamfer'
  readonly id: string
  /** Osa, se kterou je zkosená hrana rovnoběžná. */
  readonly along: Axis
  /**
   * Která hrana kvádru: pro každou ze dvou zbývajících os (v pořadí x, y, z) buď 'min', nebo 'max'.
   * Např. along 'x', edge ['min', 'max'] = hrana na přední (y = 0) a horní (z = max) stěně.
   */
  readonly edge: readonly ['min' | 'max', 'min' | 'max']
  readonly size: number
}

/** Žebro: přidaný osově rovnoběžný kvádr. */
export type RibFeature = {
  readonly kind: 'rib'
  readonly id: string
  readonly box: Box
}

export type Feature = HoleFeature | BoxCutFeature | ChamferFeature | RibFeature

export type PartSpec = {
  readonly id: string
  /** Krátký popis pro vývojáře a testy (ne pro UI). */
  readonly note?: string
  readonly base: { readonly kind: 'block'; readonly size: Vec3 }
  readonly features: readonly Feature[]
}

export const AXIS_INDEX: Readonly<Record<Axis, 0 | 1 | 2>> = { x: 0, y: 1, z: 2 }

/** Dvě zbývající osy v pořadí x, y, z. */
export function otherAxes(axis: Axis): readonly [Axis, Axis] {
  if (axis === 'x') return ['y', 'z']
  if (axis === 'y') return ['x', 'z']
  return ['x', 'y']
}
