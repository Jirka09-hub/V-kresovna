import { STANDARD_VIEWS, type ViewName } from '@vykresovna/drafting-standards'
import { viewFingerprint } from '@vykresovna/engine'
import type { ManifoldToplevel } from 'manifold-3d'
import { buildOptionDrawing, type ChoiceOption } from '../src'

/** Seedy pro vlastnostní testy (rozházené, ať nejsou jen malá čísla). */
export const seeds = (n: number) => Array.from({ length: n }, (_, i) => (i * 2654435761) >>> 8)

/** Otisky pohledů možnosti tak, jak je uvidí uživatel (nezávisle na generátoru). */
export function optionFingerprints(
  wasm: ManifoldToplevel,
  option: ChoiceOption,
): Record<ViewName, string> {
  const drawing = buildOptionDrawing(wasm, option, STANDARD_VIEWS)
  const out: Partial<Record<ViewName, string>> = {}
  for (const v of drawing.views) out[v.view] = viewFingerprint(v)
  return out as Record<ViewName, string>
}
