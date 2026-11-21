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

/**
 * Vzory přerušovaných čar jako násobky tloušťky čáry d (délka čárky, mezera, …), stejně jako
 * SVG stroke-dasharray. Odvozeno z doporučených poměrů ISO 128 pro čárkovanou (čárka 12d, mezera 3d)
 * a čerchovanou čáru (dlouhá čárka 24d, mezera 3d, tečka ≤ 0,5d, mezera 3d).
 */
// TODO(norma): ověřit, zda školy a firmy v ČR nepoužívají delší čárky a mezery (výukové výkresy na obrazovce).
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

/** O kolik osa (čerchovaná) přesahuje obrys díry nebo prvku. */
// TODO(norma): potvrdit přesah osy přes obrys (navrženo 3 mm).
export const CENTER_LINE_OVERHANG_MM = 3

/**
 * Když se v pohledu kryje více čar, kreslí se ta s nejvyšší předností (nižší číslo = vyšší přednost).
 * Viditelná hrana přebije skrytou, skrytá přebije osu.
 */
// TODO(norma): potvrdit pořadí přednosti čar (navrženo: viditelná, skrytá, stopa řezu, osa).
export const LINE_PRIORITY: Readonly<Partial<Record<LineKind, number>>> = {
  visibleEdge: 1,
  hiddenEdge: 2,
  cuttingPlaneLine: 3,
  centerLine: 4,
}
