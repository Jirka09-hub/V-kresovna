/**
 * Typy čar podle ČSN EN ISO 128 (popsáno vlastními slovy).
 * Konkrétní vzory čárkování a přesahy doplní fáze 1.
 */

export type LineWeight = 'thick' | 'thin'
export type LinePattern = 'continuous' | 'dashed' | 'chain'

export type LineKind =
  | 'visibleEdge'
  | 'hiddenEdge'
  | 'centerLine'
  | 'dimensionLine'
  | 'extensionLine'
  | 'cuttingPlaneLine'
  | 'hatching'

export type LineStyle = {
  readonly weight: LineWeight
  readonly pattern: LinePattern
}

export const LINE_STYLES: Readonly<Record<LineKind, LineStyle>> = {
  // viditelné hrany: plná tlustá
  visibleEdge: { weight: 'thick', pattern: 'continuous' },
  // neviditelné (skryté) hrany: čárkovaná tenká
  hiddenEdge: { weight: 'thin', pattern: 'dashed' },
  // osy a roviny souměrnosti: čerchovaná tenká
  centerLine: { weight: 'thin', pattern: 'chain' },
  // kótovací a pomocné čáry: plná tenká
  dimensionLine: { weight: 'thin', pattern: 'continuous' },
  extensionLine: { weight: 'thin', pattern: 'continuous' },
  // stopa roviny řezu: čerchovaná tenká, konce zesílené (zesílení řeší kreslení stopy zvlášť)
  cuttingPlaneLine: { weight: 'thin', pattern: 'chain' },
  // šrafování plochy řezu: plná tenká
  hatching: { weight: 'thin', pattern: 'continuous' },
}

/**
 * Skupina čar 0,5: tlustá 0,5 mm, tenká 0,25 mm (poměr 2 : 1).
 * Odsouhlaseno Jiřím jako výchozí návrh 2026-11-21.
 */
// TODO(norma): potvrdit odborníkem skupinu čar 0,5 pro výukové výkresy na obrazovce i v tisku.
export const LINE_WIDTH_MM: Readonly<Record<LineWeight, number>> = {
  thick: 0.5,
  thin: 0.25,
}

/** Šrafování plochy řezu: tenké čáry pod úhlem 45° (měřeno od vodorovné osy výkresu). */
export const HATCH_ANGLE_DEG = 45
