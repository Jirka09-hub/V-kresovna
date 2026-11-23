import type { IntroFeature, PartSpec } from './types'

/**
 * Součásti pro úvodní výklad lekcí. Souřadnice enginu: X doprava, Y dozadu, Z nahoru, mm,
 * celá čísla (viz `@vykresovna/engine`, PartSpec). Platnost hlídá test v aplikaci (validatePart).
 */

/** Lekce 1 a demo: osazení vpravo nahoře a výřez v levém předním horním rohu. */
export const INTRO_PART_VIEWS: PartSpec = {
  id: 'uvod-pohledy',
  base: { kind: 'block', size: [60, 40, 40] },
  features: [
    { kind: 'step', id: 'o1', box: { min: [36, 0, 22], max: [60, 40, 40] } },
    { kind: 'cutout', id: 'v1', box: { min: [0, 0, 28], max: [16, 16, 40] } },
  ],
}

/** Lekce 2: výřez vzadu nahoře je zepředu schovaný, v nárysu se kreslí čárkovaně. */
export const INTRO_PART_HIDDEN: PartSpec = {
  id: 'uvod-skryte-hrany',
  base: { kind: 'block', size: [70, 40, 36] },
  features: [
    { kind: 'cutout', id: 'v1', box: { min: [22, 22, 16], max: [50, 40, 36] } },
    { kind: 'step', id: 'o1', box: { min: [0, 0, 24], max: [14, 40, 36] } },
  ],
}

/** Lekce 3: průchozí díra a slepá vrtaná díra (kuželové dno 120°). */
export const INTRO_PART_HOLES: PartSpec = {
  id: 'uvod-diry',
  base: { kind: 'block', size: [70, 40, 24] },
  features: [
    { kind: 'hole', id: 'd1', axis: 'z', at: [18, 20], diameter: 10 },
    { kind: 'hole', id: 'd2', axis: 'z', at: [50, 20], diameter: 12, depth: 12, from: 'max' },
  ],
}

/** Lekce 4: drážka napříč, osazení vpravo a zkosená levá horní hrana. */
export const INTRO_PART_FEATURES: PartSpec = {
  id: 'uvod-drazka-osazeni-zkoseni',
  base: { kind: 'block', size: [80, 40, 36] },
  features: [
    { kind: 'slot', id: 's1', box: { min: [30, 0, 24], max: [48, 40, 36] } },
    { kind: 'step', id: 'o1', box: { min: [64, 0, 20], max: [80, 40, 36] } },
    { kind: 'chamfer', id: 'z1', along: 'y', edge: ['min', 'max'], size: 6 },
  ],
}

/** Lekce 5: drážka shora a díra zepředu pod ní. */
export const INTRO_PART_READING: PartSpec = {
  id: 'uvod-cteni-vykresu',
  base: { kind: 'block', size: [70, 40, 36] },
  features: [
    { kind: 'slot', id: 's1', box: { min: [25, 0, 22], max: [45, 40, 36] } },
    { kind: 'hole', id: 'd1', axis: 'y', at: [35, 11], diameter: 10 },
    { kind: 'cutout', id: 'v1', box: { min: [56, 0, 0], max: [70, 14, 36] } },
  ],
}

/** Lekce 6: osazení vlevo, výřez vzadu (zepředu schovaný) a svislá průchozí díra. */
export const INTRO_PART_ERRORS: PartSpec = {
  id: 'uvod-chyby',
  base: { kind: 'block', size: [70, 40, 36] },
  features: [
    { kind: 'step', id: 'o1', box: { min: [0, 0, 24], max: [16, 40, 36] } },
    { kind: 'cutout', id: 'v1', box: { min: [32, 22, 16], max: [56, 40, 36] } },
    { kind: 'hole', id: 'd1', axis: 'z', at: [44, 11], diameter: 10 },
  ],
}

/**
 * Lekce 7: průchozí díra, slepá díra s kuželovým dnem a drážka nahoře. Rovina y = 20 prochází
 * osami obou děr (řez A–A místo nárysu).
 */
export const INTRO_PART_SECTION: PartSpec = {
  id: 'uvod-rez',
  base: { kind: 'block', size: [80, 40, 30] },
  features: [
    { kind: 'hole', id: 'd1', axis: 'z', at: [18, 20], diameter: 12 },
    { kind: 'hole', id: 'd2', axis: 'z', at: [60, 20], diameter: 10, depth: 14, from: 'max' },
    { kind: 'slot', id: 's1', box: { min: [34, 0, 22], max: [46, 40, 30] } },
  ],
}

/** Lekce 8: průchozí díra, drážka uprostřed a osazení vpravo nahoře (kóty velikostí i poloh). */
export const INTRO_PART_DIMENSIONS: PartSpec = {
  id: 'uvod-koty',
  base: { kind: 'block', size: [80, 40, 30] },
  features: [
    { kind: 'hole', id: 'd1', axis: 'z', at: [18, 20], diameter: 10 },
    { kind: 'slot', id: 's1', box: { min: [32, 0, 20], max: [44, 40, 30] } },
    { kind: 'step', id: 'o1', box: { min: [60, 0, 18], max: [80, 40, 30] } },
  ],
}

/**
 * Úvodní stránka: živá ukázka bez výpočtu v prohlížeči (předpočítaná data, D-031). Osazení vlevo
 * nahoře, svislá průchozí díra vpravo a drážka zespodu napříč.
 */
export const LANDING_PART: PartSpec = {
  id: 'ukazka-uvod',
  base: { kind: 'block', size: [80, 50, 40] },
  features: [
    { kind: 'step', id: 'o1', box: { min: [0, 0, 24], max: [32, 50, 40] } },
    { kind: 'hole', id: 'd1', axis: 'z', at: [56, 25], diameter: 14 },
    { kind: 'slot', id: 's1', box: { min: [10, 0, 0], max: [24, 50, 8] } },
  ],
}

export const LANDING_FEATURES: readonly IntroFeature[] = [
  { featureId: 'o1', term: 'step' },
  { featureId: 'd1', term: 'throughHole' },
  { featureId: 's1', term: 'slot' },
]
