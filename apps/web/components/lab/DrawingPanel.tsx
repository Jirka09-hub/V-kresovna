'use client'

import { useEffect, useRef } from 'react'
import { isRelated } from '@/lib/engine/highlight'

type Props = {
  svg: string
  hoverId: string | null
  onHover: (id: string | null) => void
  label: string
}

/** SVG výkres s interaktivním zvýrazněním hran (najetí myší i klávesnice přes 3D). */
export function DrawingPanel({ svg, hoverId, onHover, label }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // širší neviditelná „zásahová“ čára pod každou hranou, aby šlo na tenké čáry snadno najet
  useEffect(() => {
    const root = ref.current
    if (!root) return
    for (const el of root.querySelectorAll<SVGElement>('[data-edge-ids]')) {
      const hit = el.cloneNode() as SVGElement
      hit.removeAttribute('class')
      hit.setAttribute('data-hit', 'true')
      hit.setAttribute('style', 'stroke:transparent;stroke-width:3;stroke-dasharray:none')
      el.parentNode?.insertBefore(hit, el)
    }
  }, [svg])

  useEffect(() => {
    const root = ref.current
    if (!root) return
    for (const el of root.querySelectorAll<SVGElement>('[data-edge-ids]:not([data-hit])')) {
      const ids = el.getAttribute('data-edge-ids')!.split(' ')
      el.setAttribute('data-highlight', String(ids.some((id) => isRelated(id, hoverId))))
    }
  }, [svg, hoverId])

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className="drawing-panel h-full w-full [&_svg]:h-full [&_svg]:max-h-full [&_svg]:w-full"
      onPointerMove={(e) => {
        const el = (e.target as Element).closest('[data-edge-ids]')
        const ids = el?.getAttribute('data-edge-ids')?.split(' ') ?? []
        const preferred = ids.find((id) => !id.startsWith('feature:')) ?? ids[0] ?? null
        onHover(preferred)
      }}
      onPointerLeave={() => onHover(null)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
