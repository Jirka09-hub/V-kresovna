import type { ViewName } from '@vykresovna/drafting-standards'
import type { Axis } from '../part/spec'
import type { Vec2 } from '../projection/hlr'

/**
 * Plný řez rovinou kolmou na jednu z hlavních os.
 *
 * Rovina je `axis = at` (souřadnice enginu, mm). Pozorovatel stojí na straně `viewFrom` (min = na straně
 * menších souřadnic) a dívá se přes rovinu na zbytek součásti; materiál mezi ním a rovinou se odebere.
 * Bez `viewFrom` se strana odvodí z pohledu, který řez nahrazuje (u nárysu tedy zepředu).
 */
export type SectionSpec = {
  readonly axis: Axis
  readonly at: number
  /** Písmeno řezu (A, B, …), nápis nad pohledem je pak „A–A“. */
  readonly label: string
  readonly viewFrom?: 'min' | 'max'
}

/** Druh řezu. Zatím se kreslí jen plný řez, poloviční je připravený v datech (docs/plan.md, 5.2). */
export type SectionKind = 'full' | 'half'

/**
 * Poloviční řez (jen typ, zatím bez implementace): u souměrné součásti se řeže jen jedna polovina
 * pohledu až po osu souměrnosti, druhá polovina zůstane jako obyčejný pohled. Hranicí obou polovin je osa.
 */
export type HalfSectionSpec = SectionSpec & {
  readonly kind: 'half'
  /** Rovina souměrnosti, na které řez končí (kolmá na rovinu řezu). */
  readonly boundary: { readonly axis: Axis; readonly at: number }
  /** Která strana od roviny souměrnosti je v řezu. */
  readonly cutSide: 'min' | 'max'
}

/** Řez ve výkresu: který pohled nahrazuje a kde se má nakreslit stopa roviny řezu. */
export type SectionDrawingOptions = {
  readonly spec: SectionSpec
  /** Pohled, který se nahradí řezem. Jeho směr musí být rovnoběžný s osou řezu. */
  readonly view: ViewName
  /**
   * Pohled se stopou roviny řezu. Bez zadání se vybere první vhodný pohled výkresu (rovina v něm leží
   * „na hraně“), přednostně nárys, pak půdorys. `null` = stopu nekreslit.
   */
  readonly cuttingPlaneView?: ViewName | null
}

/** Úsečka v souřadnicích pohledu (u doprava, v nahoru, mm). */
export type Segment2 = { readonly a: Vec2; readonly b: Vec2 }

/** Jedna souvislá plocha řezu: vnější obrys a obrysy děr (uzavřené lomené čáry, bez opakování bodu). */
export type SectionFace = {
  readonly outer: readonly Vec2[]
  readonly holes: readonly (readonly Vec2[])[]
}

/** Data pohledu v řezu (rozšíření `DrawingView`). */
export type SectionViewData = {
  readonly label: string
  /** Nápis nad pohledem, např. „A–A“. */
  readonly title: string
  readonly spec: SectionSpec
  readonly faces: readonly SectionFace[]
  /** Šrafovací čáry oříznuté na plochy řezu (přesné úsečky, ne vzor SVG). */
  readonly hatching: readonly Segment2[]
  /** Části plochy řezu, které se nešrafují (žebra řezaná podélně). */
  readonly unhatched?: readonly SectionFace[]
}

/** Šipka směru pohledu u stopy roviny řezu. */
export type CuttingPlaneArrow = { readonly tail: Vec2; readonly tip: Vec2 }

/** Stopa roviny řezu v pohledu, kde rovina leží „na hraně“ (rozšíření `DrawingView`). */
export type CuttingPlaneMark = {
  readonly label: string
  /** Celá stopa od konce ke konci (čerchovaná tenká). */
  readonly line: Segment2
  /** Tlusté konce stopy (od vnějšího konce dovnitř). */
  readonly ends: readonly [Segment2, Segment2]
  readonly arrows: readonly [CuttingPlaneArrow, CuttingPlaneArrow]
  /** Středy písmen u šipek. */
  readonly letters: readonly [Vec2, Vec2]
}
