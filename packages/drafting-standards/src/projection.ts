import { neg, X_AXIS, Y_AXIS, Z_AXIS, type Vec3 } from './vectors'

/**
 * Pravoúhlé promítání: šest základních pohledů a jejich rozmístění na výkresu.
 *
 * Vlastními slovy: u evropského promítání (metoda E, první kvadrant) leží těleso mezi
 * pozorovatelem a průmětnou. Když průmětny „rozložíme“ do roviny nárysny, objeví se každý
 * pohled na OPAČNÉ straně, než ze které se díváme: pohled shora pod nárysem, pohled zleva
 * vpravo od nárysu a tak dál.
 */

/** Metoda promítání používaná v celé aplikaci. */
export const PROJECTION_METHOD = 'E' as const

export type ViewName = 'front' | 'top' | 'left' | 'right' | 'bottom' | 'rear'

export type ViewDefinition = {
  /** Směr, kterým se pozorovatel dívá (od pozorovatele k tělesu). */
  readonly viewDirection: Vec3
  /** Který směr tělesa míří v obrázku pohledu nahoru. */
  readonly up: Vec3
}

/**
 * Směry pohledů v souřadnicích enginu (X doprava, Y dozadu, Z nahoru).
 * Pozorovatel nárysu stojí vpředu (na straně −Y) a dívá se dozadu (+Y).
 * Směr „doprava“ v obrázku je vždy viewDirection × up.
 */
export const VIEWS: Readonly<Record<ViewName, ViewDefinition>> = {
  front: { viewDirection: Y_AXIS, up: Z_AXIS },
  top: { viewDirection: neg(Z_AXIS), up: Y_AXIS },
  left: { viewDirection: X_AXIS, up: Z_AXIS },
  right: { viewDirection: neg(X_AXIS), up: Z_AXIS },
  bottom: { viewDirection: Z_AXIS, up: neg(Y_AXIS) },
  rear: { viewDirection: neg(Y_AXIS), up: Z_AXIS },
}

/** Pozice pohledu v mřížce výkresu: x doprava, y nahoru, nárys je [0, 0]. */
export type GridPosition = readonly [number, number]

/**
 * Rozmístění pohledů vůči nárysu podle evropského promítání.
 * půdorys pod nárysem, bokorys zleva vpravo, pohled zprava vlevo,
 * pohled zdola nahoře, pohled zezadu úplně vpravo (za bokorysem zleva).
 */
export const FIRST_ANGLE_LAYOUT: Readonly<Record<ViewName, GridPosition>> = {
  front: [0, 0],
  top: [0, -1],
  left: [1, 0],
  right: [-1, 0],
  bottom: [0, 1],
  rear: [2, 0],
}

/**
 * POUZE pro výslovnou výukovou ukázku „takhle to dělají v USA“ (americké promítání, třetí kvadrant).
 * Nikde jinde nepoužívat. Pohledy leží na STEJNÉ straně, ze které se díváme.
 */
export const THIRD_ANGLE_DEMO_ONLY: Readonly<Record<ViewName, GridPosition>> = {
  front: [0, 0],
  top: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  bottom: [0, -1],
  rear: [2, 0],
}

/** Tři pohledy, které se ve výuce používají standardně: nárys, půdorys, bokorys (zleva). */
export const STANDARD_VIEWS: readonly ViewName[] = ['front', 'top', 'left']

/** Klíče české terminologie do i18n (texty jsou v messages/*.json aplikace). */
export const VIEW_TERM_KEYS: Readonly<Record<ViewName, string>> = {
  front: 'drafting.view.front',
  top: 'drafting.view.top',
  left: 'drafting.view.left',
  right: 'drafting.view.right',
  bottom: 'drafting.view.bottom',
  rear: 'drafting.view.rear',
}
