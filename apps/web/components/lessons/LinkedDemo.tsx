'use client'

import type { IntroFeature, PartSpec } from '@vykresovna/content'
import type { PartViewerHandle } from '@vykresovna/viewer'
import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { DrawingSvg } from '@/components/drawing/DrawingSvg'
import { Legend } from '@/components/drawing/Legend'
import { Model3D } from '@/components/three/Model3D'
import { btnPrimary, btnSecondary, panel } from '@/components/ui'
import { featureDrawingIds, featureEdgeIds, isRelated } from '@/lib/engine/highlight'
import { useRenderParts } from '@/lib/engine/hooks'

type Props = {
  part: PartSpec
  xray?: boolean
  reveal?: boolean
  features?: readonly IntroFeature[]
}

/**
 * Živá ukázka: 3D model vedle výkresu. Najetí na hranu zvýrazní tutéž hranu na druhé straně,
 * tlačítka zvýrazní celý prvek (díra, drážka…), rentgen ukáže skryté hrany.
 */
export function LinkedDemo({ part, xray: xrayInitial = false, reveal = false, features }: Props) {
  const t = useTranslations('linked')
  const tm = useTranslations('model3d')
  const tl = useTranslations('lessons.terms')
  const rendered = useRenderParts(useMemo(() => [part], [part]))
  const data = rendered.data?.[0] ?? null
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [xray, setXray] = useState(xrayInitial)
  const [revealed, setRevealed] = useState(!reveal)
  const [active, setActive] = useState<string | null>(null)
  const viewer = useRef<PartViewerHandle>(null)

  const highlighted3d = useMemo(() => {
    if (!data) return []
    const ids = new Set(active ? featureEdgeIds(data.edges, active) : [])
    if (hoverId) for (const e of data.edges) if (isRelated(e.id, hoverId)) ids.add(e.id)
    return [...ids]
  }, [data, hoverId, active])
  const highlighted2d = useMemo(
    () => (data && active ? featureDrawingIds(data.edges, active) : null),
    [data, active],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-2" aria-label={t('model')}>
          {revealed ? (
            <Model3D
              data={data}
              ariaLabel={t('modelLabel')}
              xray={xray}
              highlightedEdgeIds={highlighted3d}
              onHoverEdge={setHoverId}
              viewerRef={viewer}
              className="aspect-[4/3] w-full"
            />
          ) : (
            <div
              className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 p-6 text-center ${panel} bg-slate-50`}
            >
              <p className="text-sm text-muted">{t('revealHint')}</p>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setRevealed(true)}
                data-testid="reveal"
              >
                {t('reveal')}
              </button>
            </div>
          )}
          {revealed ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => viewer.current?.reset()}
              >
                {tm('reset')}
              </button>
              <button
                type="button"
                className={btnSecondary}
                aria-pressed={xray}
                onClick={() => setXray((x) => !x)}
              >
                {tm('xray')}
              </button>
            </div>
          ) : null}
        </section>
        <section className="flex flex-col gap-2" aria-label={t('drawing')}>
          <div className={`flex aspect-[4/3] items-center p-2 ${panel}`}>
            {data ? (
              <DrawingSvg
                svg={data.svg}
                label={t('drawingLabel')}
                hoverId={hoverId}
                onHover={setHoverId}
                highlightIds={highlighted2d}
                className="w-full [&_svg]:max-h-full"
              />
            ) : null}
          </div>
          <Legend highlight={!!active} />
        </section>
      </div>
      {features?.length ? (
        <div role="group" aria-label={t('features')} className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{t('features')}:</span>
          {features.map((f) => (
            <button
              key={f.featureId}
              type="button"
              className={`${btnSecondary} ${active === f.featureId ? 'border-accent bg-blue-50 text-accent' : ''}`}
              aria-pressed={active === f.featureId}
              onClick={() => setActive((a) => (a === f.featureId ? null : f.featureId))}
            >
              {tl(f.term)}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-sm text-muted">{t('hoverHint')}</p>
    </div>
  )
}
