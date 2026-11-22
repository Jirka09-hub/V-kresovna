'use client'

import type { ViewName } from '@vykresovna/drafting-standards'
import { useEffect, useRef, type CSSProperties } from 'react'
import { isRelated } from '@/lib/engine/highlight'

type Props = {
  svg: string
  /** Popis pro čtečky obrazovky. */
  label: string
  /** Id čar (hran, obrysů, os), které se mají zvýraznit. */
  highlightIds?: ReadonlySet<string> | null
  /** Zvýraznit `highlightIds` jen v tomto pohledu (stejná hrana je i v ostatních pohledech). */
  highlightView?: ViewName | null
  /** Najetí myší: zvýrazní související čáry (propojení s 3D). */
  hoverId?: string | null
  onHover?: (id: string | null) => void
  /** Kóty (`data-dimension-id`), které se mají zvýraznit. */
  highlightDimensionIds?: ReadonlySet<string> | null
  /** Najetí myší na kótu: id kóty a prvku, který kótuje (null = mimo kóty). */
  onHoverDimension?: (dim: { id: string; featureId: string | null } | null) => void
  className?: string
  style?: CSSProperties
}

/** SVG výkres z enginu se zvýrazněním čar (podle prvku nebo podle najetí myší). */
export function DrawingSvg({
  svg,
  label,
  highlightIds,
  highlightView = null,
  hoverId = null,
  onHover,
  highlightDimensionIds = null,
  onHoverDimension,
  className = '',
  style,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // širší neviditelná „zásahová“ čára pod každou hranou, aby šlo na tenké čáry snadno najet
  useEffect(() => {
    const root = ref.current
    if (!root || !onHover) return
    for (const el of root.querySelectorAll<SVGElement>('[data-edge-ids]')) {
      const hit = el.cloneNode() as SVGElement
      hit.removeAttribute('class')
      hit.setAttribute('data-hit', 'true')
      hit.setAttribute('style', 'stroke:transparent;stroke-width:3;stroke-dasharray:none')
      el.parentNode?.insertBefore(hit, el)
    }
  }, [svg, onHover])

  useEffect(() => {
    const root = ref.current
    if (!root) return
    for (const el of root.querySelectorAll<SVGElement>('[data-edge-ids]:not([data-hit])')) {
      const ids = el.getAttribute('data-edge-ids')!.split(' ')
      const inView = !highlightView || el.closest(`[data-view="${highlightView}"]`) !== null
      const on = ids.some((id) => (inView && highlightIds?.has(id)) || isRelated(id, hoverId))
      el.setAttribute('data-highlight', String(on))
    }
  }, [svg, highlightIds, highlightView, hoverId])

  useEffect(() => {
    const root = ref.current
    if (!root) return
    for (const el of root.querySelectorAll<SVGElement>('[data-dimension-id]')) {
      const on = !!highlightDimensionIds?.has(el.getAttribute('data-dimension-id')!)
      el.setAttribute('data-highlight', String(on))
    }
  }, [svg, highlightDimensionIds])

  const hover = onHover || onHoverDimension

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={`drawing-svg [&_svg]:block [&_svg]:h-auto [&_svg]:w-full ${className}`}
      style={style}
      onPointerMove={
        hover
          ? (e) => {
              if (onHover) {
                const el = (e.target as Element).closest('[data-edge-ids]')
                const ids = el?.getAttribute('data-edge-ids')?.split(' ') ?? []
                onHover(ids.find((id) => !id.startsWith('feature:')) ?? ids[0] ?? null)
              }
              if (onHoverDimension) {
                const dim = (e.target as Element).closest('[data-dimension-id]')
                onHoverDimension(
                  dim
                    ? {
                        id: dim.getAttribute('data-dimension-id')!,
                        featureId: dim.getAttribute('data-feature-id'),
                      }
                    : null,
                )
              }
            }
          : undefined
      }
      onPointerLeave={
        hover
          ? () => {
              onHover?.(null)
              onHoverDimension?.(null)
            }
          : undefined
      }
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
