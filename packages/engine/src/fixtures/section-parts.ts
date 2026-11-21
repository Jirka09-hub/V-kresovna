import type { ViewName } from '@vykresovna/drafting-standards'
import type { PartSpec } from '../part/spec'
import type { SectionSpec } from '../section/types'

/**
 * Testovací součásti pro řezy (plný řez). Výkresy jsou ve snapshotech
 * packages/engine/test/__snapshots__/<id>.svg.
 */
export type SectionTestCase = {
  readonly part: PartSpec
  readonly section: SectionSpec
  /** Pohled, který řez nahrazuje. */
  readonly view: ViewName
}

export const SECTION_TEST_CASES: readonly SectionTestCase[] = [
  {
    part: {
      id: 'rez-01-diry-drazka',
      note: 'Řez A–A v nárysu rovinou os děr: průchozí díra rozdělí plochu řezu, slepá díra má kuželové dno, drážka je výřez nahoře a vodorovná díra je kruh bez šraf.',
      base: { kind: 'block', size: [80, 50, 30] },
      features: [
        { kind: 'hole', id: 'd1', axis: 'z', at: [20, 25], diameter: 12 },
        { kind: 'hole', id: 'd2', axis: 'z', at: [60, 25], diameter: 10, depth: 16, from: 'max' },
        { kind: 'slot', id: 's1', box: { min: [34, 0, 22], max: [46, 50, 30] } },
        { kind: 'hole', id: 'd3', axis: 'y', at: [40, 10], diameter: 8 },
      ],
    },
    section: { axis: 'y', at: 25, label: 'A' },
    view: 'front',
  },
  {
    part: {
      id: 'rez-02-vodorovny',
      note: 'Vodorovný řez A–A v půdorysu rovinou os dvou děr: slepá díra zepředu s kuželovým dnem, výřez vzadu vpravo ukazuje dno pod rovinou řezu.',
      base: { kind: 'block', size: [60, 40, 40] },
      features: [
        { kind: 'hole', id: 'd1', axis: 'x', at: [20, 25], diameter: 12 },
        { kind: 'hole', id: 'd2', axis: 'y', at: [15, 25], diameter: 8, depth: 10, from: 'min' },
        { kind: 'cutout', id: 'v1', box: { min: [45, 28, 18], max: [60, 40, 40] } },
      ],
    },
    section: { axis: 'z', at: 25, label: 'A' },
    view: 'top',
  },
  {
    part: {
      id: 'rez-03-bokorys',
      note: 'Řez A–A v bokorysu rovinou drážky a díry: za rovinou řezu je vidět stěna drážky, slepá díra vzadu zůstane skrytá (v řezu se nekreslí).',
      base: { kind: 'block', size: [70, 40, 30] },
      features: [
        { kind: 'slot', id: 's1', box: { min: [28, 0, 20], max: [42, 40, 30] } },
        { kind: 'hole', id: 'd1', axis: 'y', at: [35, 10], diameter: 8 },
        { kind: 'hole', id: 'd2', axis: 'z', at: [56, 20], diameter: 8, depth: 12, from: 'max' },
      ],
    },
    section: { axis: 'x', at: 35, label: 'A' },
    view: 'left',
  },
  {
    part: {
      id: 'rez-04-zebro',
      note: 'Úhelník se žebrem a dírou v desce, řez A–A v bokorysu rovinou žebra: žebro řezané podélně se nešrafuje, jen ohraničí.',
      base: { kind: 'block', size: [80, 50, 10] },
      features: [
        { kind: 'rib', id: 'stena', box: { min: [0, 40, 10], max: [80, 50, 50] } },
        { kind: 'rib', id: 'zebro', box: { min: [36, 10, 10], max: [44, 40, 34] } },
        { kind: 'hole', id: 'd1', axis: 'z', at: [40, 5], diameter: 6 },
      ],
    },
    section: { axis: 'x', at: 40, label: 'A' },
    view: 'left',
  },
]
