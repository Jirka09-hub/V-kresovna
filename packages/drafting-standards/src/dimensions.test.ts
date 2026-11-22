import { describe, expect, it } from 'vitest'
import {
  ARROW_LENGTH_MM,
  ARROW_OPENING_DEG,
  ARROWS_INSIDE_MIN_LENGTH_MM,
  arrowWidth,
  DIAMETER_SIGN,
  DIMENSION_FIRST_OFFSET_MM,
  DIMENSION_LINE_WIDTH_MM,
  DIMENSION_ROW_SPACING_MM,
  DIMENSION_TEXT_GAP_MM,
  DIMENSION_TEXT_HEIGHT_MM,
  dimensionTextRotationDeg,
  EXTENSION_LINE_GAP_MM,
  EXTENSION_LINE_OVERSHOOT_MM,
  EXTENSION_LINE_WIDTH_MM,
  formatChamfer,
  formatDiameter,
  formatDimensionValue,
  isReadableRotation,
  textUpVector,
} from './dimensions'
import { LINE_STYLES, LINE_WIDTH_MM } from './lines'

describe('kótovací hodnoty', () => {
  it('celá čísla v mm bez jednotky a bez desetinné části', () => {
    expect(formatDimensionValue(40)).toBe('40')
    expect(formatDimensionValue(8.0)).toBe('8')
    expect(formatDimensionValue(-0)).toBe('0')
  })

  it('desetinná čísla s českou desetinnou čárkou, bez koncových nul', () => {
    expect(formatDimensionValue(12.5)).toBe('12,5')
    expect(formatDimensionValue(0.25)).toBe('0,25')
    expect(formatDimensionValue(3.1000001)).toBe('3,1')
  })

  it('průměr díry má před hodnotou znak ⌀', () => {
    expect(DIAMETER_SIGN).toBe('⌀')
    expect(formatDiameter(12)).toBe('⌀12')
  })

  it('zkosení 45° se zapisuje jako velikost × úhel', () => {
    expect(formatChamfer(8)).toBe('8×45°')
    expect(formatChamfer(2.5)).toBe('2,5×45°')
  })
})

describe('čitelnost kótovací hodnoty', () => {
  it('vodorovná kóta: text vodorovně, i když čára vede zprava doleva', () => {
    expect(dimensionTextRotationDeg(1, 0)).toBe(0)
    expect(dimensionTextRotationDeg(-1, 0)).toBe(0)
  })

  it('svislá kóta: text otočený o −90°, čte se zprava (oběma směry čáry)', () => {
    expect(dimensionTextRotationDeg(0, 1)).toBe(-90)
    expect(dimensionTextRotationDeg(0, -1)).toBe(-90)
  })

  it('šikmá kóta nikdy není vzhůru nohama', () => {
    for (let a = 0; a < 360; a += 5) {
      const r = (a * Math.PI) / 180
      const rot = dimensionTextRotationDeg(Math.cos(r), Math.sin(r))
      expect(isReadableRotation(rot)).toBe(true)
    }
    expect(isReadableRotation(90)).toBe(false)
    expect(isReadableRotation(180)).toBe(false)
  })

  it('text leží nad čarou: u vodorovné kóty nahoře, u svislé vlevo', () => {
    expect(textUpVector(0)).toEqual([0, -1])
    expect(textUpVector(-90)).toEqual([-1, 0])
  })
})

describe('rozměry kót', () => {
  it('kótovací a pomocné čáry jsou plné tenké', () => {
    expect(LINE_STYLES.dimensionLine).toEqual({ weight: 'thin', pattern: 'continuous' })
    expect(LINE_STYLES.extensionLine).toEqual({ weight: 'thin', pattern: 'continuous' })
    expect(DIMENSION_LINE_WIDTH_MM).toBe(LINE_WIDTH_MM.thin)
    expect(EXTENSION_LINE_WIDTH_MM).toBe(LINE_WIDTH_MM.thin)
  })

  it('písmo 3,5 mm se vejde mezi dvě sousední kótovací čáry i s mezerou', () => {
    expect(DIMENSION_TEXT_HEIGHT_MM).toBe(3.5)
    expect(DIMENSION_TEXT_GAP_MM + DIMENSION_TEXT_HEIGHT_MM).toBeLessThan(DIMENSION_ROW_SPACING_MM)
    expect(DIMENSION_FIRST_OFFSET_MM).toBeGreaterThanOrEqual(DIMENSION_ROW_SPACING_MM)
  })

  it('pomocná čára přesahuje kótovací čáru a začíná u obrysu', () => {
    expect(EXTENSION_LINE_OVERSHOOT_MM).toBeGreaterThan(0)
    expect(EXTENSION_LINE_OVERSHOOT_MM).toBeLessThan(DIMENSION_ROW_SPACING_MM / 2)
    expect(EXTENSION_LINE_GAP_MM).toBeGreaterThanOrEqual(0)
  })

  it('šipka je úzká: délka 3 mm, rozevření 20°, šířka zhruba třetina délky', () => {
    expect(ARROW_LENGTH_MM).toBe(3)
    expect(ARROW_OPENING_DEG).toBeGreaterThanOrEqual(15)
    expect(ARROW_OPENING_DEG).toBeLessThanOrEqual(30)
    expect(arrowWidth()).toBeCloseTo(1.058, 3)
    expect(ARROWS_INSIDE_MIN_LENGTH_MM).toBeGreaterThan(2 * ARROW_LENGTH_MM)
  })
})
