'use client'

import type { DimensionTask, TaskResult } from '@vykresovna/exercises'
import type { PartViewerHandle } from '@vykresovna/viewer'
import { useTranslations } from 'next-intl'
import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { DrawingSvg } from '@/components/drawing/DrawingSvg'
import { Model3D } from '@/components/three/Model3D'
import { btnPrimary, btnSecondary, panel } from '@/components/ui'
import { evaluateAnswer } from '@/lib/engine/client'
import { featureEdgeIds } from '@/lib/engine/highlight'
import { useDimensionedPart } from '@/lib/engine/hooks'
import type { ExerciseProps } from './AssignViews'
import { Feedback } from './Feedback'

/** Text otázky na kótu (sdílí ho cvičení i závěrečný test). */
export function useDimensionQuestion() {
  const t = useTranslations('exercises.dimension')
  return (task: DimensionTask) =>
    t(`q.${task.question.kind}`, {
      feature: task.question.featureKind ?? 'other',
      axis: task.question.axis ?? 'other',
      wall: task.question.wall ?? 'other',
    })
}

/** Cvičení 6: odečti kótu. Zakótovaný výkres, prvek vyznačený ve 3D, odpověď číslem v mm. */
export function Dimension({ task, onResult, onNext, nextLabel }: ExerciseProps<DimensionTask>) {
  const t = useTranslations('exercises')
  const tq = useTranslations('exercises.dimension')
  const tm = useTranslations('model3d')
  const tc = useTranslations('common')
  const question = useDimensionQuestion()(task)
  const inputId = useId()
  const rendered = useDimensionedPart(task.part)
  const data = rendered.data
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [result, setResult] = useState<TaskResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [xray, setXray] = useState(false)
  const viewer = useRef<PartViewerHandle>(null)
  const featureId = task.question.featureId

  const highlighted3d = useMemo(
    () => (data && featureId ? featureEdgeIds(data.edges, featureId) : []),
    [data, featureId],
  )
  const highlightedDims = useMemo(
    () => (result ? new Set(task.dimensionIds) : null),
    [result, task.dimensionIds],
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (result || busy) return
    const trimmed = value.trim().replace(',', '.')
    const n = Number(trimmed)
    if (trimmed === '' || !Number.isFinite(n)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setBusy(true)
    try {
      const r = await evaluateAnswer(task, { kind: 'dimension', value: n })
      setResult(r)
      onResult(r)
    } finally {
      setBusy(false)
    }
  }

  const operands = task.dimensionIds.map(
    (id) => task.drawingDimensions.find((d) => d.id === id)?.value ?? 0,
  )
  return (
    <div
      className="flex flex-col gap-4"
      data-testid="dimension"
      data-question={task.question.kind}
      data-test-answer={task.answer}
    >
      {rendered.error ? (
        <p role="alert" className="text-red-700">
          {tc('error', { message: rendered.error })}
        </p>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="flex flex-col gap-2" aria-labelledby="dim-drawing">
          <h3 id="dim-drawing" className="text-sm font-semibold text-muted">
            {tq('drawing')}
          </h3>
          <div className={`p-2 ${panel}`}>
            {data ? (
              <DrawingSvg
                svg={data.svg}
                label={tq('drawingLabel')}
                highlightDimensionIds={highlightedDims}
                className="mx-auto max-h-[62vh] w-full [&_svg]:max-h-[62vh]"
              />
            ) : (
              <div className="aspect-[4/3]" />
            )}
          </div>
        </section>
        <div className="flex flex-col gap-4">
          <form className={`flex flex-col gap-3 p-4 ${panel}`} onSubmit={submit} noValidate>
            <label htmlFor={inputId} className="text-lg font-semibold" data-testid="dim-question">
              {question}
            </label>
            <p className="text-sm text-muted">
              {featureId ? tq('featureMarked') : tq('wholePart')} {tq('unitHint')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={inputId}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={value}
                disabled={result !== null}
                onChange={(e) => {
                  setValue(e.target.value)
                  setInvalid(false)
                }}
                aria-invalid={invalid}
                aria-describedby={invalid ? `${inputId}-err` : undefined}
                className="w-28 rounded-md border border-slate-400 px-3 py-2 text-lg tabular-nums focus-visible:outline-2 focus-visible:outline-accent"
                data-testid="dim-input"
              />
              <span className="text-muted">{tq('unit')}</span>
              {result === null ? (
                <button type="submit" className={btnPrimary} disabled={busy} data-testid="check">
                  {busy ? t('checking') : t('check')}
                </button>
              ) : null}
            </div>
            {invalid ? (
              <p id={`${inputId}-err`} role="alert" className="text-sm text-red-700">
                {tq('invalid')}
              </p>
            ) : null}
          </form>
          <section className="flex flex-col gap-2" aria-labelledby="dim-model">
            <h3 id="dim-model" className="text-sm font-semibold text-muted">
              {tq('model')}
            </h3>
            <Model3D
              data={data}
              ariaLabel={tq('modelLabel')}
              xray={xray}
              viewerRef={viewer}
              highlightedEdgeIds={highlighted3d}
              className="aspect-[4/3] w-full"
            />
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
          </section>
        </div>
      </div>
      <Feedback
        result={result}
        detail={
          result?.correct && task.combined
            ? tq('combinedDone', { calc: operands.join(' − '), value: task.answer })
            : undefined
        }
        correctAnswer={
          <p className="text-sm" data-testid="dim-correct">
            {task.combined
              ? tq('correctCombined', { calc: operands.join(' − '), value: task.answer })
              : tq('correctDirect', { value: task.answer })}{' '}
            {tq('highlightHint')}
          </p>
        }
        onNext={onNext}
        nextLabel={nextLabel}
      />
    </div>
  )
}
