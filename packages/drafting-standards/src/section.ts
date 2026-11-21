import { HATCH_ANGLE_DEG, type LineStyle } from './lines'

/**
 * Řezy: šrafování plochy řezu, stopa roviny řezu a označení řezu (popsáno vlastními slovy).
 *
 * Myšlenka řezu: součást si představíme rozříznutou myšlenou rovinou. Část mezi pozorovatelem
 * a rovinou odebereme a díváme se na zbytek. Plocha, kde rovina prošla materiálem, se vyšrafuje,
 * dutiny (díry, drážky) zůstanou bez šraf. Hrany za rovinou, které jsou vidět, se kreslí jako
 * obvykle. Kde rovina leží, ukazuje v sousedním pohledu stopa roviny řezu se šipkami a písmeny.
 *
 * Volby, kde norma nechává prostor, jsou rozhodnuté podle běžné školní praxe (D-021) a jsou
 * na seznamu ke kontrole učitelem před pilotem.
 */

/** Úhel šraf (měřeno od vodorovné osy výkresu, proti směru hodinových ručiček). */
export const SECTION_HATCH_ANGLE_DEG = HATCH_ANGLE_DEG

/**
 * Vzdálenost sousedních šrafovacích čar (kolmo na čáry) v mm na výkrese 1 : 1.
 * Rozteč se volí podle velikosti plochy; pro školní součásti velikosti desítek mm je 2,5 mm
 * dobře čitelná a nesplývá při tisku (D-021, ke kontrole učitelem).
 */
export const HATCH_SPACING_MM = 2.5

/**
 * Šrafy začínají v polovině rozteče od počátku souřadnic pohledu. Hrany součástí leží na celých
 * mm, takže šrafovací čára nikdy neprojde přesně rohem (kvůli stabilnímu výstupu, ne kvůli normě).
 */
export const HATCH_PHASE = 0.5

/**
 * Všechny plochy řezu jedné součásti se šrafují stejným směrem a se stejnou roztečí.
 * Různý směr nebo rozteč by čtenář chápal jako různé součásti (sestava).
 */
export const SAME_HATCH_FOR_ONE_PART = true

/**
 * V řezu se skryté hrany obvykle nekreslí: plocha řezu ukazuje vnitřek součásti přímo a čárkované
 * čáry by obrázek jen zahltily (D-021).
 */
export const SECTION_SHOWS_HIDDEN_EDGES = false

/**
 * Tenké žebro, které rovina řezu protíná podélně (po jeho délce), se nešrafuje, jen ohraničí plnou
 * tlustou čarou. Šrafy by vyvolaly dojem masivního plného tělesa. Žebro řezané napříč se šrafuje
 * normálně (D-021).
 */
export const RIBS_UNHATCHED_IN_LENGTHWISE_SECTION = true

/** Tlusté konce stopy roviny řezu: plná tlustá čára. Zbytek stopy je čerchovaná tenká (`LINE_STYLES`). */
export const CUTTING_PLANE_END_STYLE: LineStyle = { weight: 'thick', pattern: 'continuous' }

/** O kolik stopa roviny řezu přesahuje obrys pohledu na každé straně (mm). */
export const CUTTING_PLANE_OVERHANG_MM = 5

/**
 * Délka tlustého konce stopy (mm), měřeno od vnějšího konce stopy dovnitř. S přesahem 5 mm zasahuje
 * tlustý konec 1 mm do obrysu, takže je jasné, kde rovina součást protíná (D-021).
 */
export const CUTTING_PLANE_END_LENGTH_MM = 6

/**
 * Šipka směru pohledu: začíná na vnějším konci stopy, je kolmá na stopu a míří tam, kam se díváme
 * (od pozorovatele ke zbylé části součásti). Délka celé šipky včetně hrotu v mm.
 */
export const CUTTING_PLANE_ARROW_LENGTH_MM = 8

/** Hrot šipky stopy řezu: plný, délka v mm. */
export const CUTTING_PLANE_ARROWHEAD_LENGTH_MM = 3

/** Polovina vrcholového úhlu hrotu šipky (stejně štíhlý hrot jako u kótovacích šipek, 15°). */
export const ARROWHEAD_HALF_ANGLE_DEG = 15

/** Šířka plného hrotu šipky v mm (z délky hrotu a úhlu). */
export function arrowheadWidth(length: number = CUTTING_PLANE_ARROWHEAD_LENGTH_MM): number {
  return 2 * length * Math.tan((ARROWHEAD_HALF_ANGLE_DEG * Math.PI) / 180)
}

/**
 * Výška písmen označení řezu (výška velkého písmene, mm). Řada výšek písma je 2,5 – 3,5 – 5 – 7 – 10;
 * označení řezu se píše o stupeň větším písmem než kóty (3,5 mm), tedy 5 mm (D-021).
 */
export const SECTION_LETTER_HEIGHT_MM = 5

/** Mezera mezi šipkou stopy a písmenem (mm). Písmeno stojí vedle šipky, na vnější straně. */
export const SECTION_LETTER_OFFSET_MM = 1.5

/** Mezera mezi spodním okrajem nápisu „A–A“ a horním okrajem pohledu v řezu (mm). */
export const SECTION_TITLE_GAP_MM = 4

/** Výška písma nápisu nad řezem (mm), stejná jako u písmen u stopy. */
export const SECTION_TITLE_HEIGHT_MM = SECTION_LETTER_HEIGHT_MM

/**
 * Písmena pro označení řezů. Vynecháváme I, O a Q, protože se pletou s číslicemi 1 a 0
 * (běžná praxe na výkresech, D-021).
 */
export const SECTION_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ'

export function isValidSectionLetter(label: string): boolean {
  return label.length === 1 && SECTION_LETTERS.includes(label)
}

/** Označení pohledu v řezu: stejné písmeno dvakrát, mezi nimi pomlčka (např. „A–A“). */
export function sectionTitle(label: string): string {
  return `${label}–${label}`
}

/** Písmena se píší vždy svisle (čitelná zdola), bez ohledu na směr stopy a šipky. */
export const SECTION_LETTERS_UPRIGHT = true
