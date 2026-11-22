'use client'

import type { ChoiceOption, DrawingToModelTask } from '@vykresovna/exercises'
import {
  PartGallery,
  PartGalleryView,
  partRadius,
  type PartGalleryHandle,
} from '@vykresovna/viewer'
import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { DrawingSvg } from '@/components/drawing/DrawingSvg'
import { WebGLBoundary } from '@/components/lab/WebGLBoundary'
import { NoWebGL } from '@/components/three/Model3D'
import { btnPrimary, btnSecondary, panel } from '@/components/ui'
import { evaluateAnswer } from '@/lib/engine/client'
import { featureDrawingIds, featureEdgeIds } from '@/lib/engine/highlight'
import { useRenderParts } from '@/lib/engine/hooks'
import { webglSupported } from '@/lib/webgl'
import type { ExerciseProps } from './AssignViews'
import { letterOf, OptionCard, optionStatus, type ChoiceState } from './choice'
import { Feedback } from './Feedback'
import { ArrowIcon } from './icons'

const STEP = Math.PI / 8

/** Cvičení 3: výkres → model (1 ze 4). Všechny modely jsou na jednom WebGL plátně. */
export function DrawingToModel({
  task,
  onResult,
  onNext,
  nextLabel,
}: ExerciseProps<DrawingToModelTask>) {
  const t = useTranslations('exercises')
  const tm = useTranslations('exercises.toModel')
  const tc = useTranslations('common')
  const [state, setState] = useState<ChoiceState>(null)
  const [busy, setBusy] = useState(false)
  const [webgl] = useState(() => webglSupported())
  const gallery = useRef<PartGalleryHandle>(null)

  const parts = useMemo(() => [task.part, ...task.options.map((o) => o.part)], [task])
  const rendered = useRenderParts(parts)
  const drawing = rendered.data?.[0] ?? null
  const models = rendered.data?.slice(1) ?? null
  const radius = models ? Math.max(...models.map(partRadius)) : 1

  const correct = task.options.find((o) => o.errorCode === null)!
  const correctIndex = task.options.indexOf(correct)
  const chosen = state ? task.options.find((o) => o.id === state.chosenId)! : null
  const featureId = state?.result.errors[0]?.featureId ?? chosen?.featureId

  const drawingHighlight = useMemo(
    () => (drawing && featureId ? featureDrawingIds(drawing.edges, featureId) : null),
    [drawing, featureId],
  )
  const modelHighlight = (o: ChoiceOption, i: number): readonly string[] | undefined => {
    if (!state || !featureId || !models) return undefined
    if (o.id !== chosen?.id && o !== correct) return undefined
    return featureEdgeIds(models[i]!.edges, featureId)
  }

  const choose = async (o: ChoiceOption) => {
    if (state || busy) return
    setBusy(true)
    try {
      const result = await evaluateAnswer(task, { kind: 'drawing-to-model', optionId: o.id })
      setState({ chosenId: o.id, result })
      onResult(result)
    } finally {
      setBusy(false)
    }
  }

  const noWebgl = (
    <div className="flex flex-col items-start gap-3">
      <NoWebGL text={t('noWebgl')} />
      <button type="button" className={btnPrimary} onClick={onNext}>
        {t('skip')}
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {rendered.error ? (
        <p role="alert" className="text-red-700">
          {tc('error', { message: rendered.error })}
        </p>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className="flex flex-col gap-2" aria-labelledby="to-model-drawing">
          <h3 id="to-model-drawing" className="text-sm font-semibold text-muted">
            {tm('drawing')}
          </h3>
          <div className={`p-2 ${panel}`}>
            {drawing ? (
              <DrawingSvg
                svg={drawing.svg}
                label={tm('drawingLabel')}
                highlightIds={drawingHighlight}
                className="mx-auto max-h-[52vh] [&_svg]:max-h-[52vh]"
              />
            ) : (
              <div className="aspect-[4/3]" />
            )}
          </div>
        </section>

        <section
          className="flex flex-col gap-2"
          aria-labelledby="to-model-options"
          data-test-correct={correct.id}
        >
          <h3 id="to-model-options" className="text-sm font-semibold text-muted">
            {tm('options')}
          </h3>
          {!webgl ? (
            noWebgl
          ) : (
            <WebGLBoundary fallback={noWebgl}>
              <PartGallery
                radius={radius}
                controlsRef={gallery}
                className="mx-auto grid w-full max-w-[min(100%,62vh)] grid-cols-2 gap-3"
              >
                {task.options.map((o, i) => (
                  <OptionCard
                    key={o.id}
                    index={i}
                    optionId={o.id}
                    label={tm('optionLabel', { letter: letterOf(i) })}
                    status={optionStatus(o, state)}
                    chosen={state?.chosenId === o.id}
                    disabled={state !== null || busy}
                    onChoose={() => choose(o)}
                    buttonBelow
                  >
                    {models ? (
                      <PartGalleryView
                        data={models[i]!}
                        className="aspect-[4/3] w-full"
                        ariaLabel={tm('optionLabel', { letter: letterOf(i) })}
                        {...(modelHighlight(o, i)
                          ? { highlightedEdgeIds: modelHighlight(o, i)! }
                          : {})}
                      />
                    ) : (
                      <div className="aspect-[4/3] w-full bg-[#eef2f7]" />
                    )}
                  </OptionCard>
                ))}
              </PartGallery>
              <div
                role="group"
                aria-label={tm('rotate')}
                className="flex flex-wrap items-center justify-center gap-2"
              >
                <button
                  type="button"
                  className={btnSecondary}
                  aria-label={tm('rotateLeft')}
                  onClick={() => gallery.current?.rotate(-STEP, 0)}
                >
                  <ArrowIcon rotate={180} />
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  aria-label={tm('rotateRight')}
                  onClick={() => gallery.current?.rotate(STEP, 0)}
                >
                  <ArrowIcon rotate={0} />
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  aria-label={tm('rotateUp')}
                  onClick={() => gallery.current?.rotate(0, STEP)}
                >
                  <ArrowIcon rotate={-90} />
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  aria-label={tm('rotateDown')}
                  onClick={() => gallery.current?.rotate(0, -STEP)}
                >
                  <ArrowIcon rotate={90} />
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => gallery.current?.reset()}
                >
                  {tm('rotateReset')}
                </button>
              </div>
              <p className="text-center text-xs text-muted">{tm('rotateHint')}</p>
            </WebGLBoundary>
          )}
        </section>
      </div>

      <Feedback
        result={state?.result ?? null}
        correctAnswer={
          <p className="text-sm">{t('optionLetter', { letter: letterOf(correctIndex) })}</p>
        }
        onNext={onNext}
        nextLabel={nextLabel}
      />
    </div>
  )
}
