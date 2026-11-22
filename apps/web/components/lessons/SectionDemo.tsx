'use client'

import type { PartSpec } from '@vykresovna/content'
import type { PartViewerHandle } from '@vykresovna/viewer'
import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { DrawingSvg } from '@/components/drawing/DrawingSvg'
import { SECTION_STEP_MM } from '@/components/lab/SectionControls'
import { useSectionDrawing } from '@/components/lab/useSectionDrawing'
import { Model3D } from '@/components/three/Model3D'
import { btnSecondary, panel } from '@/components/ui'
import { useRenderParts } from '@/lib/engine/hooks'

type Axis = 'x' | 'y' | 'z'
const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }

/**
 * Živý řez pro výklad: 3D model s posuvnou rovinou řezu (tažení úchytu, posuvník, klávesnice)
 * a vedle výkres s řezem A–A, který se po posunu roviny přepočítá.
 */
export function SectionDemo({
  part,
  axis,
  at: initial,
}: {
  part: PartSpec
  axis: Axis
  at: number
}) {
  const t = useTranslations('sectionDemo')
  const tm = useTranslations('model3d')
  const rendered = useRenderParts(useMemo(() => [part], [part]))
  const data = rendered.data?.[0] ?? null
  const [at, setAt] = useState(initial)
  const [xray, setXray] = useState(false)
  const viewer = useRef<PartViewerHandle>(null)
  const i = AXIS_INDEX[axis]
  const min = data ? data.bbox.min[i] + SECTION_STEP_MM : initial
  const max = data ? data.bbox.max[i] - SECTION_STEP_MM : initial
  const move = (x: number) =>
    setAt(Math.min(max, Math.max(min, Math.round(x / SECTION_STEP_MM) * SECTION_STEP_MM)))
  const plane = useMemo(() => ({ axis, at }), [axis, at])
  const drawing = useSectionDrawing(part, plane, t('drawingLabel'))
  const axisName = axis.toUpperCase()

  return (
    <div className="flex flex-col gap-3" data-testid="section-demo">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-2" aria-label={t('model')}>
          <Model3D
            data={data}
            ariaLabel={t('modelLabel')}
            xray={xray}
            viewerRef={viewer}
            sectionPlane={plane}
            onSectionChange={move}
            sectionStep={SECTION_STEP_MM}
            className="aspect-[4/3] w-full"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={() => viewer.current?.reset()}>
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
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('position', { axis: axisName, value: at })}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={SECTION_STEP_MM}
              value={at}
              aria-label={t('slider')}
              aria-valuetext={t('sliderValue', { axis: axisName, value: at })}
              data-testid="section-demo-slider"
              onChange={(e) => move(Number(e.target.value))}
            />
          </label>
        </section>
        <section className="flex flex-col gap-2" aria-label={t('drawing')}>
          <div className={`flex aspect-[4/3] items-center p-2 ${panel}`}>
            {drawing.svg ? (
              <DrawingSvg
                svg={drawing.svg}
                label={t('drawingLabel')}
                className="w-full [&_svg]:max-h-full"
              />
            ) : null}
          </div>
          {drawing.error ? (
            <p role="alert" className="text-sm text-red-700">
              {t('error')}
            </p>
          ) : null}
        </section>
      </div>
      <p className="text-sm text-muted">{t('hint')}</p>
    </div>
  )
}
