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
 * Jiří odsouhlasil jako výchozí návrh 2026-11-21.
 */
// Rozhodnuto v D-017: skupina 0,5 je běžná volba pro výkresy formátu A4/A3; před pilotem ověří učitel.
export const LINE_WIDTH_MM: Readonly<Record<LineWeight, number>> = {
  thick: 0.5,
  thin: 0.25,
}

/** Šrafování plochy řezu: tenké čáry pod úhlem 45° (měřeno od vodorovné osy výkresu). */
export const HATCH_ANGLE_DEG = 45

/**
 * Vzory přerušovaných čar jako násobky tloušťky čáry d (délka čárky, mezera, …), stejně jako
 * SVG stroke-dasharray. Odvozeno z doporučených poměrů ISO 128 pro čárkovanou (čárka 12d, mezera 3d)
 * a čerchovanou čáru (dlouhá čárka 24d, mezera 3d, tečka ≤ 0,5d, mezera 3d).
 */
// Rozhodnuto v D-017: držíme poměry z ISO 128, na obrazovce se čáry škálují spolu s výkresem.
export const DASH_PATTERN_IN_D: Readonly<Record<LinePattern, readonly number[]>> = {
  continuous: [],
  dashed: [12, 3],
  chain: [24, 3, 0.5, 3],
}

/** Vzor čárkování v mm pro daný druh čáry (prázdné pole = plná čára). */
export function dashArrayMm(kind: LineKind): number[] {
  const style = LINE_STYLES[kind]
  const d = LINE_WIDTH_MM[style.weight]
  return DASH_PATTERN_IN_D[style.pattern].map((k) => k * d)
}

/**
 * O kolik osa (čerchovaná) přesahuje obrys díry nebo prvku. V praxi se používá zhruba 2 až 5 mm,
 * volíme 3 mm (D-017).
 */
export const CENTER_LINE_OVERHANG_MM = 3

/**
 * Když se v pohledu kryje více čar, kreslí se ta s nejvyšší předností (nižší číslo = vyšší přednost).
 * Viditelná hrana přebije skrytou, skrytá přebije osu.
 */
// Pořadí odpovídá běžné praxi technického kreslení (D-017).
export const LINE_PRIORITY: Readonly<Partial<Record<LineKind, number>>> = {
  visibleEdge: 1,
  hiddenEdge: 2,
  cuttingPlaneLine: 3,
  centerLine: 4,
}

/**
 * Vrcholový úhel kuželového dna slepé (vrtané) díry. Šroubovitý vrták má hrot 118°, ve výkresech
 * se dno kreslí zjednodušeně pod úhlem 120° (D-017). Hloubka slepé díry se udává bez kuželového dna.
 */
export const DRILL_POINT_ANGLE_DEG = 120

/** Výška kuželového dna vrtané díry o daném průměru (mm). */
export function drillPointHeight(diameter: number): number {
  return diameter / 2 / Math.tan(((DRILL_POINT_ANGLE_DEG / 2) * Math.PI) / 180)
}

/**
 * Osa souměrnosti se kreslí, jen když je souměrnost „vidět“: alespoň jeden prvek (díra, drážka…) leží
 * uvnitř součásti souměrně s rovinou souměrnosti. U holého kvádru se osy nekreslí (D-017).
 */
export const SYMMETRY_AXIS_REQUIRES_FEATURE = true
