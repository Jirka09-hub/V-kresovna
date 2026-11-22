'use client'

import type { IntroFeature, PartSpec } from '@vykresovna/content'
import type { PartViewerHandle } from '@vykresovna/viewer'
import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { DrawingSvg } from '@/components/drawing/DrawingSvg'
import { Model3D } from '@/components/three/Model3D'
import { btnSecondary, panel } from '@/components/ui'
import { featureEdgeIds } from '@/lib/engine/highlight'
import { useDimensionedPart } from '@/lib/engine/hooks'

/** Kóty ve výkresu (id kóty → kótovaný prvek) přečtené z atributů SVG. */
export function dimensionsInSvg(svg: string): { id: string; featureId: string | null }[] {
  const out: { id: string; featureId: string | null }[] = []
  const re = /<g data-dimension-id="([^"]+)"(?: data-feature-id="([^"]+)")?/g
  for (let m = re.exec(svg); m; m = re.exec(svg)) out.push({ id: m[1]!, featureId: m[2] ?? null })
  return out
}

/**
 * Zakótovaný výkres vedle 3D modelu: najetí myší na kótu zvýrazní kótu i kótovaný prvek ve 3D,
 * tlačítka (i z klávesnice) zvýrazní prvek a všechny jeho kóty.
 */
export function DimensionDemo({
  part,
  features,
}: {
  part: PartSpec
  features?: readonly IntroFeature[]
}) {
  const t = useTranslations('dimensionDemo')
  const tl = useTranslations('lessons.terms')
  const tm = useTranslations('model3d')
  const rendered = useDimensionedPart(part)
  const data = rendered.data
  const [hover, setHover] = useState<{ id: string; featureId: string | null } | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const viewer = useRef<PartViewerHandle>(null)
  const dims = useMemo(() => (data ? dimensionsInSvg(data.svg) : []), [data])

  const featureId = hover ? hover.featureId : active
  const highlighted3d = useMemo(
    () => (data && featureId ? featureEdgeIds(data.edges, featureId) : []),
    [data, featureId],
  )
  const highlightedDims = useMemo(() => {
    if (hover) return new Set([hover.id])
    if (active) return new Set(dims.filter((d) => d.featureId === active).map((d) => d.id))
    return null
  }, [hover, active, dims])

  return (
    <div className="flex flex-col gap-3" data-testid="dimension-demo">
      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <section className="flex flex-col gap-2" aria-label={t('drawing')}>
          <div className={`flex items-center p-2 ${panel}`}>
            {data ? (
              <DrawingSvg
                svg={data.svg}
                label={t('drawingLabel')}
                highlightDimensionIds={highlightedDims}
                onHoverDimension={setHover}
                className="w-full"
              />
            ) : (
              <div className="aspect-[4/3]" />
            )}
          </div>
        </section>
        <section className="flex flex-col gap-2" aria-label={t('model')}>
          <Model3D
            data={data}
            ariaLabel={t('modelLabel')}
            viewerRef={viewer}
            highlightedEdgeIds={highlighted3d}
            className="aspect-[4/3] w-full"
          />
          <div>
            <button type="button" className={btnSecondary} onClick={() => viewer.current?.reset()}>
              {tm('reset')}
            </button>
          </div>
          <p className="text-sm" aria-live="polite" data-testid="dimension-demo-status">
            {hover
              ? hover.featureId
                ? t('hoverFeature')
                : t('hoverPart')
              : active
                ? t('activeFeature')
                : ''}
          </p>
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
              data-testid="dimension-feature"
            >
              {tl(f.term)}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-sm text-muted">{t('hint')}</p>
    </div>
  )
}
