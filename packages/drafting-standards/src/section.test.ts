import { describe, expect, it } from 'vitest'
import { LINE_STYLES, LINE_WIDTH_MM } from './lines'
import {
  arrowheadWidth,
  CUTTING_PLANE_ARROW_LENGTH_MM,
  CUTTING_PLANE_ARROWHEAD_LENGTH_MM,
  CUTTING_PLANE_END_LENGTH_MM,
  CUTTING_PLANE_END_STYLE,
  CUTTING_PLANE_OVERHANG_MM,
  HATCH_SPACING_MM,
  isValidSectionLetter,
  SECTION_HATCH_ANGLE_DEG,
  SECTION_LETTER_HEIGHT_MM,
  SECTION_SHOWS_HIDDEN_EDGES,
  sectionTitle,
} from './section'

describe('šrafování', () => {
  it('šrafy jsou tenké plné čáry pod 45°', () => {
    expect(SECTION_HATCH_ANGLE_DEG).toBe(45)
    expect(LINE_STYLES.hatching).toEqual({ weight: 'thin', pattern: 'continuous' })
  })

  it('rozteč šraf je čitelná na výkrese 1 : 1 (2 až 3 mm)', () => {
    expect(HATCH_SPACING_MM).toBeGreaterThanOrEqual(2)
    expect(HATCH_SPACING_MM).toBeLessThanOrEqual(3)
    // mezera mezi čarami musí být výrazně větší než tloušťka čáry
    expect(HATCH_SPACING_MM).toBeGreaterThan(4 * LINE_WIDTH_MM.thin)
  })

  it('v řezu se skryté hrany nekreslí', () => {
    expect(SECTION_SHOWS_HIDDEN_EDGES).toBe(false)
  })
})

describe('stopa roviny řezu', () => {
  it('stopa je čerchovaná tenká se zesílenými konci', () => {
    expect(LINE_STYLES.cuttingPlaneLine).toEqual({ weight: 'thin', pattern: 'chain' })
    expect(CUTTING_PLANE_END_STYLE).toEqual({ weight: 'thick', pattern: 'continuous' })
  })

  it('tlustý konec začíná mimo obrys a jen kousek do něj zasahuje', () => {
    expect(CUTTING_PLANE_END_LENGTH_MM).toBeGreaterThan(CUTTING_PLANE_OVERHANG_MM)
    expect(CUTTING_PLANE_END_LENGTH_MM - CUTTING_PLANE_OVERHANG_MM).toBeLessThanOrEqual(2)
  })

  it('šipka je delší než její hrot a hrot je štíhlý', () => {
    expect(CUTTING_PLANE_ARROW_LENGTH_MM).toBeGreaterThan(2 * CUTTING_PLANE_ARROWHEAD_LENGTH_MM)
    expect(arrowheadWidth()).toBeCloseTo(2 * 3 * Math.tan(Math.PI / 12), 10)
    expect(arrowheadWidth()).toBeLessThan(CUTTING_PLANE_ARROWHEAD_LENGTH_MM)
  })
})

describe('označení řezu', () => {
  it('pohled v řezu se označí dvěma stejnými písmeny s pomlčkou', () => {
    expect(sectionTitle('A')).toBe('A–A')
    expect(sectionTitle('B')).toBe('B–B')
  })

  it('písmena I, O a Q se nepoužívají', () => {
    expect(isValidSectionLetter('A')).toBe(true)
    expect(isValidSectionLetter('I')).toBe(false)
    expect(isValidSectionLetter('O')).toBe(false)
    expect(isValidSectionLetter('Q')).toBe(false)
    expect(isValidSectionLetter('AB')).toBe(false)
    expect(isValidSectionLetter('a')).toBe(false)
  })

  it('písmo označení je z řady výšek písma', () => {
    expect([2.5, 3.5, 5, 7, 10]).toContain(SECTION_LETTER_HEIGHT_MM)
  })
})
