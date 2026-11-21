import { describe, expect, it } from 'vitest'
import { dashArrayMm, HATCH_ANGLE_DEG, LINE_PRIORITY, LINE_STYLES, LINE_WIDTH_MM } from './lines'

describe('typy čar', () => {
  it('viditelné hrany jsou plné tlusté, skryté čárkované tenké', () => {
    expect(LINE_STYLES.visibleEdge).toEqual({ weight: 'thick', pattern: 'continuous' })
    expect(LINE_STYLES.hiddenEdge).toEqual({ weight: 'thin', pattern: 'dashed' })
  })

  it('osy jsou čerchované tenké, kótovací a pomocné plné tenké', () => {
    expect(LINE_STYLES.centerLine).toEqual({ weight: 'thin', pattern: 'chain' })
    expect(LINE_STYLES.dimensionLine).toEqual({ weight: 'thin', pattern: 'continuous' })
    expect(LINE_STYLES.extensionLine).toEqual({ weight: 'thin', pattern: 'continuous' })
  })

  it('tlustá čára je dvojnásobkem tenké', () => {
    expect(LINE_WIDTH_MM.thick / LINE_WIDTH_MM.thin).toBe(2)
  })

  it('šrafy jsou pod 45°', () => {
    expect(HATCH_ANGLE_DEG).toBe(45)
  })
})

describe('vzory čárkování', () => {
  it('plná čára nemá vzor', () => {
    expect(dashArrayMm('visibleEdge')).toEqual([])
  })
  it('skrytá hrana má čárku čtyřikrát delší než mezeru', () => {
    const [dash, gap] = dashArrayMm('hiddenEdge')
    expect(dash! / gap!).toBe(4)
  })
  it('osa je čerchovaná: dlouhá čárka, mezera, tečka, mezera', () => {
    expect(dashArrayMm('centerLine')).toHaveLength(4)
  })
  it('viditelná hrana má přednost před skrytou a skrytá před osou', () => {
    expect(LINE_PRIORITY.visibleEdge!).toBeLessThan(LINE_PRIORITY.hiddenEdge!)
    expect(LINE_PRIORITY.hiddenEdge!).toBeLessThan(LINE_PRIORITY.centerLine!)
  })
})
