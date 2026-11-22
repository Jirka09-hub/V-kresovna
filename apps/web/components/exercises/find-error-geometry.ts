/**
 * Geometrie výkresu pro „najdi chybu“ v UI: převod mezi souřadnicemi výkresu (mm, y dolů, jako SVG)
 * a pohledu (mm, u doprava, v nahoru, jako engine) a oblasti 3 × 3 pro výběr z klávesnice.
 * Jen typy z balíčků (kód enginu je ve workeru, D-016).
 */
import type { Area2, FindErrorTarget, ViewPlacement } from '@vykresovna/exercises'

export type Point = readonly [number, number]

/** Počet řádků a sloupců oblastí jednoho pohledu při výběru z klávesnice. */
export const CELLS = 3

/** Bod výkresu → bod pohledu. */
export function drawingToView(p: ViewPlacement, x: number, y: number): Point {
  return [p.min[0] + (x - p.origin[0]), p.min[1] + p.size[1] - (y - p.origin[1])]
}

/** Bod pohledu → bod výkresu. */
export function viewToDrawing(p: ViewPlacement, pt: Point): Point {
  return [p.origin[0] + (pt[0] - p.min[0]), p.origin[1] + (p.min[1] + p.size[1] - pt[1])]
}

/**
 * Pohled pod kliknutím: nejbližší pohled, pokud je bod uvnitř jeho obdélníku rozšířeného o `margin`
 * (aby šlo kliknout i na čáru obrysu z vnější strany). Jinak null.
 */
export function locateView(
  placements: readonly ViewPlacement[],
  x: number,
  y: number,
  margin: number,
): ViewPlacement | null {
  let best: ViewPlacement | null = null
  let bestDist = Infinity
  for (const p of placements) {
    const dx = Math.max(p.origin[0] - x, 0, x - (p.origin[0] + p.size[0]))
    const dy = Math.max(p.origin[1] - y, 0, y - (p.origin[1] + p.size[1]))
    const d = Math.hypot(dx, dy)
    if (d <= margin && d < bestDist) {
      best = p
      bestDist = d
    }
  }
  return best
}

/** Oblast (řádek 0 = nahoře, sloupec 0 = vlevo) v souřadnicích pohledu. */
export function cellArea(p: ViewPlacement, row: number, col: number): Area2 {
  const w = p.size[0] / CELLS
  const h = p.size[1] / CELLS
  const top = p.min[1] + p.size[1]
  return {
    min: [p.min[0] + col * w, top - (row + 1) * h],
    max: [p.min[0] + (col + 1) * w, top - row * h],
  }
}

/** Obdélník oblasti ve výkresu (x, y, šířka, výška v mm). */
export function cellRect(p: ViewPlacement, row: number, col: number) {
  const w = p.size[0] / CELLS
  const h = p.size[1] / CELLS
  return { x: p.origin[0] + col * w, y: p.origin[1] + row * h, width: w, height: h }
}

/** Oblast, do které padne bod pohledu (pro testovací atributy a výchozí fokus). */
export function cellOf(p: ViewPlacement, pt: Point): readonly [number, number] {
  const clamp = (n: number) => Math.min(CELLS - 1, Math.max(0, Math.floor(n)))
  const col = clamp(((pt[0] - p.min[0]) / p.size[0]) * CELLS)
  const row = clamp(((p.min[1] + p.size[1] - pt[1]) / p.size[1]) * CELLS)
  return [row, col]
}

/** Typický bod místa chyby v pohledu: střed první čáry, nebo střed pohledu. */
export function targetPoint(target: FindErrorTarget, p: ViewPlacement): Point {
  if (target.kind === 'view') return [p.min[0] + p.size[0] / 2, p.min[1] + p.size[1] / 2]
  const s = target.segments[0]!
  return [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2]
}
