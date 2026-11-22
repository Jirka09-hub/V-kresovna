/**
 * Přizpůsobení kvality 3D zobrazení výkonu zařízení (D-032). Měří se jen souvislé vykreslování
 * (otáčení, animace): plátno kreslí jen při změně, takže pauzy mezi snímky nejsou zpomalení.
 * (drei PerformanceMonitor pauzy počítá jako 0 fps a na klidné scéně zbytečně snižuje kvalitu.)
 */

/** Delší mezera mezi snímky už není souvislé vykreslování. */
export const CONTINUOUS_FRAME_MS = 150
/** Počet snímků, ze kterých se rozhoduje. */
export const QUALITY_WINDOW = 30
/** Průměrný snímek delší než tohle (méně než ~25 fps) = snížit rozlišení. */
export const SLOW_FRAME_MS = 40
/** Kratší než tohle (víc než ~50 fps) = je rezerva, rozlišení se smí vrátit. */
export const FAST_FRAME_MS = 20
/** Ani při nejnižším rozlišení méně než ~10 fps: 3D je na zařízení moc pomalé. */
export const UNUSABLE_FRAME_MS = 100
export const MIN_DPR = 1
export const DPR_STEP = 0.5
/** Nejvýš tolik změn za život plátna, aby kvalita neskákala tam a zpět. */
export const MAX_QUALITY_CHANGES = 4

export type QualityDecision =
  | { readonly kind: 'keep' }
  | { readonly kind: 'set'; readonly dpr: number }
  | { readonly kind: 'unusable' }

/** Výchozí a nejvyšší rozlišení plátna podle hustoty pixelů displeje. */
export function initialDpr(devicePixelRatio: number): { start: number; max: number } {
  const max = Math.max(MIN_DPR, Math.min(2, devicePixelRatio || 1))
  return { start: Math.min(max, 1.5), max }
}

export function qualityDecision(
  frameMs: readonly number[],
  dpr: number,
  maxDpr: number,
  changes: number,
): QualityDecision {
  if (frameMs.length === 0) return { kind: 'keep' }
  const avg = frameMs.reduce((a, b) => a + b, 0) / frameMs.length
  if (avg > SLOW_FRAME_MS && dpr > MIN_DPR && changes < MAX_QUALITY_CHANGES) {
    return { kind: 'set', dpr: Math.max(MIN_DPR, dpr - DPR_STEP) }
  }
  if (avg > UNUSABLE_FRAME_MS && dpr <= MIN_DPR) return { kind: 'unusable' }
  if (avg < FAST_FRAME_MS && dpr < maxDpr && changes < MAX_QUALITY_CHANGES) {
    return { kind: 'set', dpr: Math.min(maxDpr, dpr + DPR_STEP) }
  }
  return { kind: 'keep' }
}
