import type { PartSpec } from '../part/spec'

/**
 * Deset testovacích součástí pro ověření projekce a skrytých hran (fáze 1).
 * U každé je v poznámce, co přesně testuje. Výkresy jsou ve snapshotech
 * packages/engine/test/__snapshots__/<id>.svg.
 */
export const TEST_PARTS: readonly PartSpec[] = [
  {
    id: '01-kvadr',
    note: 'Samotný kvádr: tři obdélníky, žádné skryté hrany.',
    base: { kind: 'block', size: [60, 40, 30] },
    features: [],
  },
  {
    id: '02-vyrez-v-rohu',
    note: 'Výřez v pravém předním horním rohu: viditelný ve všech třech pohledech.',
    base: { kind: 'block', size: [60, 40, 30] },
    features: [{ kind: 'cutout', id: 'v1', box: { min: [40, 0, 18], max: [60, 22, 30] } }],
  },
  {
    id: '03-dira-pruchozi',
    note: 'Průchozí díra shora: kružnice v půdorysu, skryté obrysy díry v nárysu a bokorysu, osy.',
    base: { kind: 'block', size: [60, 40, 20] },
    features: [{ kind: 'hole', id: 'd1', axis: 'z', at: [30, 20], diameter: 12 }],
  },
  {
    id: '04-dira-slepa',
    note: 'Slepá (vrtaná) díra shora: skryté obrysy končí v hloubce 18 mm, dno je kužel 120°.',
    base: { kind: 'block', size: [60, 40, 30] },
    features: [
      { kind: 'hole', id: 'd1', axis: 'z', at: [20, 20], diameter: 10, depth: 18, from: 'max' },
    ],
  },
  {
    id: '05-drazka',
    note: 'Drážka napříč horní stěnou: v bokorysu je dno drážky skrytá hrana.',
    base: { kind: 'block', size: [80, 40, 30] },
    features: [{ kind: 'slot', id: 's1', box: { min: [30, 0, 18], max: [50, 40, 30] } }],
  },
  {
    id: '06-osazeni',
    note: 'Osazení vpravo nahoře: v bokorysu zleva je hrana osazení skrytá (za levou stěnou).',
    base: { kind: 'block', size: [80, 40, 40] },
    features: [{ kind: 'step', id: 'o1', box: { min: [50, 0, 25], max: [80, 40, 40] } }],
  },
  {
    id: '07-zkoseni',
    note: 'Dvě zkosení 45°, která se potkávají v rohu: šikmé plochy a jejich hrany ve všech pohledech.',
    base: { kind: 'block', size: [60, 40, 30] },
    features: [
      { kind: 'chamfer', id: 'z1', along: 'x', edge: ['min', 'max'], size: 8 },
      { kind: 'chamfer', id: 'z2', along: 'z', edge: ['max', 'min'], size: 6 },
    ],
  },
  {
    id: '08-zebro',
    note: 'Úhelník: deska, stěna a žebro mezi nimi (přidávání materiálu).',
    base: { kind: 'block', size: [80, 50, 10] },
    features: [
      { kind: 'rib', id: 'stena', box: { min: [0, 40, 10], max: [80, 50, 50] } },
      { kind: 'rib', id: 'zebro', box: { min: [36, 10, 10], max: [44, 40, 34] } },
    ],
  },
  {
    id: '09-dira-pod-drazkou',
    note: 'Průchozí díra zepředu pod drážkou: skryté obrysy díry leží za dnem drážky (skrytá za skrytou).',
    base: { kind: 'block', size: [80, 50, 40] },
    features: [
      { kind: 'slot', id: 's1', box: { min: [28, 0, 26], max: [52, 50, 40] } },
      { kind: 'hole', id: 'd1', axis: 'y', at: [40, 13], diameter: 10 },
    ],
  },
  {
    id: '10-soubezne-hrany',
    note: 'Osazení vpředu, výřez vzadu a svislá díra: hrany, které se v průmětu kryjí (viditelná má přednost).',
    base: { kind: 'block', size: [60, 40, 40] },
    features: [
      { kind: 'step', id: 'o1', box: { min: [0, 0, 22], max: [60, 15, 40] } },
      { kind: 'cutout', id: 'v1', box: { min: [0, 28, 30], max: [60, 40, 40] } },
      { kind: 'hole', id: 'd1', axis: 'z', at: [30, 22], diameter: 8 },
    ],
  },
]

export { SECTION_TEST_CASES, type SectionTestCase } from './section-parts'
