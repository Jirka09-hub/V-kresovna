'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { isRelated } from '@/lib/engine/highlight'

type Props = {
  svg: string
  /** Popis pro čtečky obrazovky. */
  label: string
  /** Id čar (hran, obrysů, os), které se mají zvýraznit. */
  highlightIds?: ReadonlySet<string> | null
  /** Najetí myší: zvýrazní související čáry (propojení s 3D). */
  hoverId?: string | null
  onHover?: (id: string | null) => void
  className?: string
  style?: CSSProperties
}

/** SVG výkres z enginu se zvýrazněním čar (podle prvku nebo podle najetí myší). */
export function DrawingSvg({
  svg,
  label,
  highlightIds,
  hoverId = null,
  onHover,
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
      const on = ids.some((id) => highlightIds?.has(id) || isRelated(id, hoverId))
      el.setAttribute('data-highlight', String(on))
    }
  }, [svg, highlightIds, hoverId])

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={`drawing-svg [&_svg]:block [&_svg]:h-auto [&_svg]:w-full ${className}`}
      style={style}
      onPointerMove={
        onHover
          ? (e) => {
              const el = (e.target as Element).closest('[data-edge-ids]')
              const ids = el?.getAttribute('data-edge-ids')?.split(' ') ?? []
              onHover(ids.find((id) => !id.startsWith('feature:')) ?? ids[0] ?? null)
            }
          : undefined
      }
      onPointerLeave={onHover ? () => onHover(null) : undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
