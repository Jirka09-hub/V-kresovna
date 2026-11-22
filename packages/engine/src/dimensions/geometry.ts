import { DIMENSION_TEXT_HEIGHT_MM } from '@vykresovna/drafting-standards'
import type { Vec2 } from '../projection/hlr'

/**
 * Pomocná 2D geometrie pro rozmístění kót: odhad šířky textu a testy překryvu (konvexní mnohoúhelníky,
 * úsečky). Vše v mm v souřadnicích pohledu.
 */

/**
 * Písmo kót ve SVG. Není to norma (ta předepisuje tvar písma, ne konkrétní soubor), jen volba pro
 * obrazovku: bezpatkové písmo, které je na školních počítačích i v Linuxu.
 */
export const DIMENSION_FONT_FAMILY = "'DejaVu Sans','Liberation Sans',Arial,Helvetica,sans-serif"

/** Poměr výšky velkých písmen a číslic k velikosti písma (em) u běžných bezpatkových písem. */
const CAP_HEIGHT_EM = 0.72

/** Velikost písma (em v mm), aby číslice měly výšku `DIMENSION_TEXT_HEIGHT_MM`. */
export const DIMENSION_FONT_SIZE_MM = DIMENSION_TEXT_HEIGHT_MM / CAP_HEIGHT_EM

/** Šířky znaků v em (podle DejaVu Sans, které je ze zmíněných písem nejširší: odhad je bezpečný). */
const CHAR_WIDTH_EM: Readonly<Record<string, number>> = {
  ',': 0.318,
  '.': 0.318,
  '°': 0.5,
  '×': 0.838,
  '⌀': 0.84,
}
const DIGIT_WIDTH_EM = 0.636
const OTHER_WIDTH_EM = 0.7

/** Odhad šířky textu kóty v mm (bez DOM, aby engine běžel i ve workeru a v Node). */
export function estimateTextWidth(text: string): number {
  let em = 0
  for (const ch of text) {
    em += CHAR_WIDTH_EM[ch] ?? (ch >= '0' && ch <= '9' ? DIGIT_WIDTH_EM : OTHER_WIDTH_EM)
  }
  return em * DIMENSION_FONT_SIZE_MM
}

export type Poly = readonly Vec2[]

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]]
const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1]

function axesOf(poly: Poly): Vec2[] {
  const axes: Vec2[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!
    const q = poly[(i + 1) % poly.length]!
    const e = sub(q, p)
    const len = Math.hypot(e[0], e[1])
    if (len < 1e-12) continue
    axes.push([-e[1] / len, e[0] / len])
    // úsečka: i směr samotné úsečky (jinak by dvě úsečky na jedné přímce vždy „kolidovaly“)
    if (poly.length === 2) {
      axes.push([e[0] / len, e[1] / len])
      break
    }
  }
  return axes
}

function projectPoly(poly: Poly, axis: Vec2): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (const p of poly) {
    const d = dot(p, axis)
    lo = Math.min(lo, d)
    hi = Math.max(hi, d)
  }
  return [lo, hi]
}

/**
 * Překrývají se dva konvexní mnohoúhelníky (nebo úsečky jako dvoubodové „mnohoúhelníky“)?
 * `clearance` = minimální požadovaná mezera; menší mezera se počítá jako překryv.
 */
export function convexOverlap(a: Poly, b: Poly, clearance = 0): boolean {
  for (const axis of [...axesOf(a), ...axesOf(b)]) {
    const [alo, ahi] = projectPoly(a, axis)
    const [blo, bhi] = projectPoly(b, axis)
    if (ahi + clearance <= blo || bhi + clearance <= alo) return false
  }
  return true
}

/**
 * Kříží se dvě úsečky „opravdu“, tj. v bodě uvnitř obou? Dotyk v koncovém bodě ani překryv na jedné
 * přímce se za křížení nepočítá (kóty smějí sdílet pomocnou čáru a šipka leží na pomocné čáře).
 */
export function segmentsCross(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2, eps = 1e-6): boolean {
  const r = sub(p2, p1)
  const s = sub(q2, q1)
  const denom = r[0] * s[1] - r[1] * s[0]
  const lr = Math.hypot(r[0], r[1])
  const ls = Math.hypot(s[0], s[1])
  if (Math.abs(denom) < 1e-12 * lr * ls) return false
  const qp = sub(q1, p1)
  const t = (qp[0] * s[1] - qp[1] * s[0]) / denom
  const u = (qp[0] * r[1] - qp[1] * r[0]) / denom
  const et = eps / lr
  const eu = eps / ls
  return t > et && t < 1 - et && u > eu && u < 1 - eu
}

/** Obdélník textu: střed účaří, směr textu (jednotkový), směr „nahoru“ od účaří, šířka a výška. */
export function textRect(baseMid: Vec2, dir: Vec2, up: Vec2, width: number, height: number): Poly {
  const hx = (dir[0] * width) / 2
  const hy = (dir[1] * width) / 2
  const ux = up[0] * height
  const uy = up[1] * height
  return [
    [baseMid[0] - hx, baseMid[1] - hy],
    [baseMid[0] + hx, baseMid[1] + hy],
    [baseMid[0] + hx + ux, baseMid[1] + hy + uy],
    [baseMid[0] - hx + ux, baseMid[1] - hy + uy],
  ]
}

/** Zaokrouhlení souřadnic na 0,001 mm (stabilní snapshoty, −0 → 0). */
export const round3 = (n: number) => Math.round(n * 1000) / 1000 + 0
export const roundVec = (p: Vec2): Vec2 => [round3(p[0]), round3(p[1])]
