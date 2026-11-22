'use client'

import type { PartSpec } from '@vykresovna/content'
import { STANDARD_VIEWS } from '@vykresovna/drafting-standards'
import type { DrawingMutation } from '@vykresovna/exercises'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { DrawingSvg } from '@/components/drawing/DrawingSvg'
import { Legend } from '@/components/drawing/Legend'
import { Model3D } from '@/components/three/Model3D'
import { btnSecondary, panel } from '@/components/ui'
import { isRelated } from '@/lib/engine/highlight'
import { useRenderParts, useViewsSvgs } from '@/lib/engine/hooks'

/**
 * Ukázka chyby ve výkresu: 3D model a výkres s jednou chybou. „Ukázat chybu“ ji zvýrazní ve 2D
 * i 3D, přepínač ukáže správný výkres.
 */
export function ErrorExampleDemo({
  part,
  mutation,
}: {
  part: PartSpec
  mutation: DrawingMutation
}) {
  const t = useTranslations('errorExample')
  const rendered = useRenderParts(useMemo(() => [part], [part]))
  const data = rendered.data?.[0] ?? null
  const wrong = useViewsSvgs(
    useMemo(() => [{ part, views: STANDARD_VIEWS, mutation }], [part, mutation]),
  )
  const [reveal, setReveal] = useState(false)
  const [correct, setCorrect] = useState(false)

  const ids = useMemo(() => new Set(mutation.edgeIds), [mutation])
  const highlighted3d = useMemo(
    () =>
      reveal && data
        ? data.edges
            .filter((e) => mutation.edgeIds.some((id) => e.id === id || isRelated(e.id, id)))
            .map((e) => e.id)
        : [],
    [reveal, data, mutation],
  )
  const svg = correct ? data?.svg : wrong.data?.[0]?.svg

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 md:grid-cols-2">
        <Model3D
          data={data}
          ariaLabel={t('model')}
          highlightedEdgeIds={highlighted3d}
          className="aspect-[4/3] w-full"
        />
        <div className="flex flex-col gap-2">
          <div
            className={`flex aspect-[4/3] items-center p-2 ${panel}`}
            data-testid="error-example-drawing"
            data-showing={correct ? 'correct' : 'wrong'}
          >
            {svg ? (
              <DrawingSvg
                svg={svg}
                label={correct ? t('correctLabel') : t('wrongLabel')}
                highlightIds={reveal ? ids : null}
                highlightView={mutation.view}
                className="w-full [&_svg]:max-h-full"
              />
            ) : null}
          </div>
          <Legend highlight={reveal} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnSecondary}
          aria-pressed={reveal}
          onClick={() => setReveal((r) => !r)}
          data-testid="reveal-error"
        >
          {t('reveal')}
        </button>
        <button
          type="button"
          className={btnSecondary}
          aria-pressed={correct}
          onClick={() => setCorrect((c) => !c)}
          data-testid="toggle-correct-example"
        >
          {t('showCorrect')}
        </button>
      </div>
      <p className="text-sm text-muted" role="status" aria-live="polite">
        {reveal ? t('explanation') : t('hint')}
      </p>
    </div>
  )
}
