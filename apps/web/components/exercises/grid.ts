import type { GridPosition } from '@vykresovna/drafting-standards'

/** Rozsah mřížky pohledů (sloupce zleva doprava, řádky shora dolů; řádek +1 = nahoře). */
export type GridBounds = { minCol: number; maxCol: number; minRow: number; maxRow: number }

export function gridBounds(positions: readonly GridPosition[]): GridBounds {
  const cols = positions.map((p) => p[0])
  const rows = positions.map((p) => p[1])
  return {
    minCol: Math.min(...cols),
    maxCol: Math.max(...cols),
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
  }
}

export const gridSize = (b: GridBounds) => ({
  cols: b.maxCol - b.minCol + 1,
  rows: b.maxRow - b.minRow + 1,
})

/** CSS grid umístění buňky (1-based). */
export function gridArea(b: GridBounds, p: GridPosition) {
  return { gridColumn: p[0] - b.minCol + 1, gridRow: b.maxRow - p[1] + 1 }
}

export const samePosition = (a: GridPosition | null | undefined, b: GridPosition) =>
  !!a && a[0] === b[0] && a[1] === b[1]

export const positionKey = (p: GridPosition) => `${p[0]},${p[1]}`

/** Klíč textu s polohou vůči nárysu (`exercises.assign.position.<klíč>`). */
export function positionTerm(
  p: GridPosition,
): 'above' | 'below' | 'left' | 'right' | 'farRight' | 'other' {
  const [c, r] = p
  if (c === 0 && r === 1) return 'above'
  if (c === 0 && r === -1) return 'below'
  if (c === -1 && r === 0) return 'left'
  if (c === 1 && r === 0) return 'right'
  if (c === 2 && r === 0) return 'farRight'
  return 'other'
}

/**
 * Maximální šířka mřížky tak, aby se i s řadou karet vešla na výšku obrazovky
 * (notebook 1366×768, iPad na šířku). `heightVh` = kolik výšky okna smí zabrat jeden řádek.
 */
export function gridMaxWidth(cols: number, rows: number, cellAspect: number, heightVh: number) {
  return `min(100%, ${((cols * cellAspect * heightVh) / rows).toFixed(2)}vh)`
}
