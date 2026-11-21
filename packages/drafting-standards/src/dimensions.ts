import { LINE_STYLES, LINE_WIDTH_MM } from './lines'

/**
 * Kótování: konstanty a čisté funkce (vlastními slovy, bez citací norem).
 *
 * Kóta se skládá z kótovací čáry s šipkami na koncích, z pomocných (vynášecích) čar, které ji spojují
 * s tělesem, a z kótovací hodnoty. Hodnoty i všechny vzdálenosti jsou v mm. Kde norma nechává volnost,
 * volíme podle běžné praxe českých průmyslových škol (D-017, D-022) a dáváme to ke kontrole učiteli.
 */

/** Kótovací i pomocné čáry jsou plné tenké (stejné jako v `LINE_STYLES`). */
export const DIMENSION_LINE_WIDTH_MM = LINE_WIDTH_MM[LINE_STYLES.dimensionLine.weight]
export const EXTENSION_LINE_WIDTH_MM = LINE_WIDTH_MM[LINE_STYLES.extensionLine.weight]

/**
 * Výška písma kót (výška velkých písmen a číslic). Pro výkresy A4/A3 se běžně používá 3,5 mm (D-022).
 */
export const DIMENSION_TEXT_HEIGHT_MM = 3.5

/** Mezera mezi kótovací čarou a spodním okrajem kótovací hodnoty (hodnota „sedí“ nad čarou). */
export const DIMENSION_TEXT_GAP_MM = 1

/**
 * Mezera mezi obrysem tělesa a začátkem pomocné čáry. Ve školách se pomocná čára obvykle kreslí přímo
 * od obrysu, proto 0 (D-022, ke kontrole učitelem).
 */
export const EXTENSION_LINE_GAP_MM = 0

/** O kolik pomocná čára přesahuje za kótovací čáru (D-022: 2 mm). */
export const EXTENSION_LINE_OVERSHOOT_MM = 2

/** Vzdálenost první kótovací čáry od obrysu pohledu (D-022: 10 mm). */
export const DIMENSION_FIRST_OFFSET_MM = 10

/** Rozestup sousedních rovnoběžných kótovacích čar (D-022: 8 mm, hodnota se vejde i s přesahem pomocných čar). */
export const DIMENSION_ROW_SPACING_MM = 8

/**
 * Šipka kótovací čáry: plně vyplněný úzký trojúhelník, hrot leží přesně na pomocné čáře (nebo obrysu).
 * Délka 3 mm, celkový úhel rozevření 20° (poměr délky a šířky zhruba 3 : 1), D-022.
 */
export const ARROW_LENGTH_MM = 3
export const ARROW_OPENING_DEG = 20
export const ARROW_FILLED = true

/** Šířka šipky u jejího kořene (mm). */
export function arrowWidth(): number {
  return 2 * ARROW_LENGTH_MM * Math.tan(((ARROW_OPENING_DEG / 2) * Math.PI) / 180)
}

/**
 * Šipky se kreslí uvnitř kóty, když se mezi pomocné čáry vejdou obě i s malou mezerou; jinak se kreslí
 * zvenku a směřují dovnitř.
 */
export const ARROWS_INSIDE_MIN_LENGTH_MM = 2 * ARROW_LENGTH_MM + 1

/** Znak průměru před hodnotou průměru díry. */
export const DIAMETER_SIGN = '⌀'

/** Úhel zkosení, které umíme kótovat zkráceně jako „velikost × úhel“. */
export const CHAMFER_ANGLE_DEG = 45

/** Desetinný oddělovač: v češtině čárka. */
export const DECIMAL_SEPARATOR = ','

/**
 * Kótovací hodnota: číslo v mm bez jednotky. Celá čísla bez desetinné části, jinak nejvýš dvě desetinná
 * místa s desetinnou čárkou a bez koncových nul (12,5; 0,25).
 */
export function formatDimensionValue(value: number): string {
  const rounded = Math.round(value * 100) / 100 + 0
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(2).replace(/0+$/, '').replace('.', DECIMAL_SEPARATOR)
}

/** Průměr díry: znak průměru a hodnota, např. „⌀12“. */
export function formatDiameter(diameter: number): string {
  return `${DIAMETER_SIGN}${formatDimensionValue(diameter)}`
}

/** Zkosení 45°: velikost odvěsny × úhel, např. „8×45°“. */
export function formatChamfer(size: number, angleDeg: number = CHAMFER_ANGLE_DEG): string {
  return `${formatDimensionValue(size)}×${formatDimensionValue(angleDeg)}°`
}

/**
 * Natočení kótovací hodnoty pro kótovací čáru se směrem (dx, dy) v souřadnicích výkresu
 * (x doprava, y DOLŮ jako v SVG; kladný úhel = po směru hodinových ručiček).
 *
 * Hodnota musí jít přečíst zdola nebo zprava: u vodorovné kóty je text vodorovně (0°), u svislé je
 * otočený o −90° (čte se zprava, píše se zdola nahoru). Obecně se směr textu volí z intervalu
 * [−90°, 90°), takže text nikdy není vzhůru nohama ani čitelný jen zleva.
 */
export function dimensionTextRotationDeg(dx: number, dy: number): number {
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI
  if (deg >= 90 - 1e-9) deg -= 180
  else if (deg < -90 - 1e-9) deg += 180
  // zaokrouhlit kvůli stabilním snapshotům (a −0 → 0)
  return Math.round(deg * 1000) / 1000 + 0
}

/**
 * Je text s daným natočením (stupně, SVG) čitelný zdola nebo zprava? Pomocná funkce pro testy
 * a kontrolu výkresu.
 */
export function isReadableRotation(rotationDeg: number): boolean {
  return rotationDeg >= -90 - 1e-9 && rotationDeg < 90 - 1e-9
}

/**
 * Jednotkový vektor „nad čarou“ pro text s daným natočením (SVG souřadnice, y dolů): směr od kótovací
 * čáry k textu. U vodorovné kóty míří nahoru (0, −1), u svislé kóty doleva (−1, 0).
 */
export function textUpVector(rotationDeg: number): readonly [number, number] {
  const r = (rotationDeg * Math.PI) / 180
  const x = Math.sin(r)
  const y = -Math.cos(r)
  return [Math.round(x * 1e9) / 1e9 + 0, Math.round(y * 1e9) / 1e9 + 0]
}

/**
 * Pravidla, podle kterých engine kóty vybírá a rozmisťuje (popsáno vlastními slovy):
 * - každý rozměr je na výkrese jen jednou (žádná kóta se neopakuje v jiném pohledu),
 * - rozměry tvoří otevřený řetězec: žádný rozměr nejde dopočítat z ostatních (nekótuje se „dokola“),
 * - kóta patří do pohledu, kde je prvek vidět ve skutečném tvaru a nejlépe viditelnými hranami,
 * - kótovací čáry leží vně obrysu, kratší kóty blíž k tělesu, delší dál; čáry se nekříží,
 * - polohy prvků se kótují od základny (levá, přední a spodní stěna), u souměrné součásti se poloha
 *   prvku ležícího na ose souměrnosti nekótuje,
 * - průměr díry se kótuje u kružnice; hloubka slepé díry je hloubka válcové části (bez kuželového dna).
 */
export const DIMENSIONING_RULES = {
  eachSizeOnce: true,
  noClosedChains: true,
  positionsFromBase: true,
  skipPositionOnSymmetryAxis: true,
} as const
