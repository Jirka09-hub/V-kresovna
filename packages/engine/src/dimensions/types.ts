import type { Vec3, ViewName } from '@vykresovna/drafting-standards'
import type { Axis, Box } from '../part/spec'
import type { Vec2 } from '../projection/hlr'

/** Druh kóty: délková, průměr díry, zkosení („8×45°“). */
export type DimensionKind = 'linear' | 'diameter' | 'chamfer'

/**
 * Co kóta určuje: celkový rozměr součásti, rozměr základní desky, velikost prvku, polohu prvku
 * od základny, hloubku slepé díry, průměr díry, zkosení.
 */
export type DimensionRole =
  'overall' | 'base' | 'size' | 'position' | 'depth' | 'diameter' | 'chamfer'

/**
 * Kóta odvozená z popisu součásti (`PartSpec`), zatím bez pohledu a bez geometrie výkresu.
 * Hodnoty jsou přesně z parametrů prvků, nic se neodhaduje ze sítě.
 */
export type PartDimension = {
  /** Stabilní id, např. `dim:part:overall:x`, `dim:s1:size:z`, `dim:d1:diameter`. */
  readonly id: string
  readonly featureId: string | null
  readonly kind: DimensionKind
  readonly role: DimensionRole
  readonly value: number
  readonly text: string
  /**
   * Délková kóta a zkosení: osa, podél které se měří (u zkosení odvěsna). Průměr: osa díry.
   */
  readonly axis: Axis
  /** Délková kóta a zkosení: souřadnice začátku a konce na ose `axis` (a < b). Průměr: [0, d]. */
  readonly span: readonly [number, number]
  /** Obalový kvádr kótovaného místa (pro volbu pohledu a strany, na kterou kóta půjde). */
  readonly region: Box
  /**
   * Díra, jejíž střed kóta určuje (poloha) nebo jejíž průměr kótuje: bod na ose díry a poloměr.
   * U polohy leží střed na konci `span[1]`.
   */
  readonly hole?: { readonly center: Vec3; readonly radius: number; readonly axis: Axis }
  /**
   * Pohled, ve kterém je prvek vidět ve skutečném tvaru (směr pohledu podél této osy), pokud takový je:
   * průchozí drážka nebo osazení z boku, díra ve směru osy, zkosení podél hrany.
   */
  readonly trueShapeAxes: readonly Axis[]
}

/** Čára kóty ve výkresu (souřadnice pohledu: u doprava, v nahoru, mm). */
export type DimensionLineSegment = {
  readonly a: Vec2
  readonly b: Vec2
  readonly kind: 'dimensionLine' | 'extensionLine'
}

/** Plná šipka: hrot a dva rohy u kořene (souřadnice pohledu). */
export type DimensionArrow = readonly [tip: Vec2, left: Vec2, right: Vec2]

/** Strana pohledu, na které kóta leží (`inside` = průměr u kružnice uvnitř pohledu). */
export type DimensionSide = 'top' | 'bottom' | 'left' | 'right' | 'inside'

/** Kóta umístěná ve výkresu: geometrie připravená pro SVG. */
export type DrawingDimension = {
  readonly id: string
  readonly featureId: string | null
  readonly kind: DimensionKind
  readonly role: DimensionRole
  readonly value: number
  readonly text: string
  readonly view: ViewName
  readonly side: DimensionSide
  /** Řada od obrysu (0 = nejblíž), u průměru 0. */
  readonly row: number
  readonly lines: readonly DimensionLineSegment[]
  readonly arrows: readonly DimensionArrow[]
  /**
   * Text: bod na účaří uprostřed textu (souřadnice pohledu) a natočení ve stupních v souřadnicích
   * výkresu (SVG, y dolů, kladně po směru hodinových ručiček), už upravené pro čitelnost.
   */
  readonly textAnchor: Vec2
  readonly textRotationDeg: number
  /** Obdélník kolem textu (4 rohy, souřadnice pohledu) pro kontrolu překryvů. */
  readonly textBox: readonly Vec2[]
}

/** O kolik kóty přesahují obdélník průmětu pohledu na každé straně (mm, ≥ 0). */
export type DimensionMargins = {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
}
