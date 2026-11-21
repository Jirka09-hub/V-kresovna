'use client'

import { STANDARD_VIEWS } from '@vykresovna/drafting-standards'
import type { PartSpec } from '@vykresovna/engine'
import { DEFAULT_SECTION_VIEW } from '@vykresovna/engine/section'
import { useEffect, useState } from 'react'
import { renderViews } from '@/lib/engine/client'

/** Za jak dlouho po posledním posunu roviny se přepočítá přesný 2D řez (ms). */
const DEBOUNCE_MS = 250

/**
 * Výkres s řezem A–A pro danou rovinu (počítá se ve workeru). Při tažení roviny se přepočítá až po
 * krátké pauze a do té doby zůstává zobrazený předchozí výkres.
 */
export function useSectionDrawing(
  spec: PartSpec,
  plane: { axis: 'x' | 'y' | 'z'; at: number } | null,
  svgTitle: string,
): { svg: string | null; error: string | null } {
  // výsledek patří vždy ke konkrétní součásti; výkres jiné součásti se nezobrazí
  const [state, setState] = useState<{ partId: string; svg: string | null; error: string | null }>({
    partId: '',
    svg: null,
    error: null,
  })
  const axis = plane?.axis
  const at = plane?.at

  useEffect(() => {
    if (axis === undefined || at === undefined) return
    let alive = true
    const timer = setTimeout(() => {
      renderViews(spec, STANDARD_VIEWS, {
        svgTitle,
        section: { spec: { axis, at, label: 'A' }, view: DEFAULT_SECTION_VIEW[axis] },
      })
        .then((r) => alive && setState({ partId: spec.id, svg: r.svg, error: null }))
        .catch(
          (e: unknown) =>
            alive &&
            setState((s) => ({
              partId: spec.id,
              svg: s.partId === spec.id ? s.svg : null,
              error: e instanceof Error ? e.message : String(e),
            })),
        )
    }, DEBOUNCE_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [spec, axis, at, svgTitle])

  return state.partId === spec.id
    ? { svg: state.svg, error: state.error }
    : { svg: null, error: null }
}
