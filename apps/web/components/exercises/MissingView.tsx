'use client'

import { FIRST_ANGLE_LAYOUT } from '@vykresovna/drafting-standards'
import type { ChoiceOption, MissingViewTask } from '@vykresovna/exercises'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { cellFor, ScaledView } from '@/components/drawing/ScaledView'
import { Model3D } from '@/components/three/Model3D'
import { panel } from '@/components/ui'
import { evaluateAnswer } from '@/lib/engine/client'
import { featureDrawingIds, featureEdgeIds } from '@/lib/engine/highlight'
import { useRenderParts, useViewsSvgs } from '@/lib/engine/hooks'
import type { ExerciseProps } from './AssignViews'
import { OptionCard, optionStatus, letterOf, type ChoiceState } from './choice'
import { Feedback } from './Feedback'
import { gridArea, gridBounds, gridMaxWidth, gridSize, positionKey } from './grid'

/** Cvičení 2: najdi chybějící pohled (1 ze 4). */
export function MissingView({ task, onResult, onNext, nextLabel }: ExerciseProps<MissingViewTask>) {
  const t = useTranslations('exercises')
  const tm = useTranslations('exercises.missing')
  const td = useTranslations('drafting.view')
  const tc = useTranslations('common')
  const [state, setState] = useState<ChoiceState>(null)
  const [busy, setBusy] = useState(false)

  const requests = useMemo(
    () => [
      ...task.givenViews.map((v) => ({ part: task.part, views: [v] })),
      ...task.options.map((o) => ({ option: o, views: [task.missingView] })),
    ],
    [task],
  )
  const svgs = useViewsSvgs(requests)
  const given = svgs.data?.slice(0, task.givenViews.length) ?? null
  const options = svgs.data?.slice(task.givenViews.length) ?? null
  const cell = svgs.data ? cellFor(svgs.data) : null

  const correct = task.options.find((o) => o.errorCode === null)!
  const chosen = state ? task.options.find((o) => o.id === state.chosenId)! : null
  const featureId = state?.result.errors[0]?.featureId ?? chosen?.featureId

  // po odpovědi: hrany zvolené a správné součásti (zvýraznění prvku) a 3D model
  const highlightParts = useMemo(
    () => (chosen ? [chosen.part, correct.part] : null),
    [chosen, correct.part],
  )
  const rendered = useRenderParts(highlightParts)

  const highlightFor = (o: ChoiceOption): ReadonlySet<string> | null => {
    if (!state || !rendered.data) return null
    const ids = new Set<string>()
    const data = o.id === chosen?.id ? rendered.data[0] : o === correct ? rendered.data[1] : null
    if (featureId && data) for (const id of featureDrawingIds(data.edges, featureId)) ids.add(id)
    if (o.id === chosen?.id && o.drawingMutation)
      for (const id of o.drawingMutation.edgeIds) ids.add(id)
    return ids.size ? ids : null
  }

  const positions = [...task.givenViews, task.missingView].map((v) => FIRST_ANGLE_LAYOUT[v])
  const bounds = gridBounds(positions)
  const size = gridSize(bounds)
  const aspect = cell ? cell.width / cell.height : 1.5
  const correctIndex = task.options.indexOf(correct)

  const choose = async (o: ChoiceOption) => {
    if (state || busy) return
    setBusy(true)
    try {
      const result = await evaluateAnswer(task, { kind: 'missing-view', optionId: o.id })
      setState({ chosenId: o.id, result })
      onResult(result)
    } finally {
      setBusy(false)
    }
  }

  const correct3d = rendered.data?.[1] ?? null

  return (
    <div className="flex flex-col gap-4">
      {svgs.error ? (
        <p role="alert" className="text-red-700">
          {tc('error', { message: svgs.error })}
        </p>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-2" aria-labelledby="missing-given">
          <h3 id="missing-given" className="text-sm font-semibold text-muted">
            {tm('given')}
          </h3>
          <div
            role="group"
            aria-label={tm('givenLabel')}
            className={`grid w-full gap-2 p-2 ${panel}`}
            style={{
              gridTemplateColumns: `repeat(${size.cols}, minmax(0, 1fr))`,
              maxWidth: gridMaxWidth(size.cols, size.rows, aspect, 52),
            }}
            data-testid="given-views"
          >
            {task.givenViews.map((v, i) => (
              <div key={v} style={gridArea(bounds, FIRST_ANGLE_LAYOUT[v])}>
                <span className="flex h-5 items-center px-1.5 text-xs font-semibold text-muted">
                  {td(v)}
                </span>
                {given && cell ? (
                  <ScaledView drawing={given[i]!} cell={cell} label={td(v)} />
                ) : (
                  <div style={{ aspectRatio: aspect }} />
                )}
              </div>
            ))}
            <div
              style={gridArea(bounds, FIRST_ANGLE_LAYOUT[task.missingView])}
              className={`rounded-md border-2 border-dashed ${
                state ? 'border-green-700' : 'border-accent'
              }`}
              data-testid="missing-frame"
              data-slot={positionKey(FIRST_ANGLE_LAYOUT[task.missingView])}
            >
              <span className="flex h-5 items-center px-1.5 text-xs font-semibold text-accent">
                {tm('missingFrame', { view: td(task.missingView) })}
              </span>
              {state && options && cell ? (
                <ScaledView
                  drawing={options[correctIndex]!}
                  cell={cell}
                  label={td(task.missingView)}
                  highlightIds={highlightFor(correct)}
                />
              ) : (
                <div
                  style={{ aspectRatio: aspect }}
                  className="flex items-center justify-center text-4xl font-bold text-blue-300"
                  aria-hidden="true"
                >
                  ?
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="missing-options">
          <h3 id="missing-options" className="text-sm font-semibold text-muted">
            {tm('options')}
          </h3>
          <div
            className="grid w-full grid-cols-2 gap-3"
            style={{ maxWidth: gridMaxWidth(2, 2, aspect, 52) }}
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
              >
                {options && cell ? (
                  <ScaledView
                    drawing={options[i]!}
                    cell={cell}
                    label={t('optionLetter', { letter: letterOf(i) })}
                    highlightIds={highlightFor(o)}
                  />
                ) : (
                  <div style={{ aspectRatio: aspect }} />
                )}
              </OptionCard>
            ))}
          </div>
        </section>
      </div>

      <Feedback
        result={state?.result ?? null}
        correctAnswer={
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              {t('optionLetter', { letter: letterOf(correctIndex) })}. {tm('modelHint')}
            </p>
            <Model3D
              data={correct3d}
              ariaLabel={tm('model')}
              highlightedEdgeIds={
                correct3d && featureId ? featureEdgeIds(correct3d.edges, featureId) : undefined
              }
              className="aspect-[4/3] w-full max-w-md"
            />
          </div>
        }
        onNext={onNext}
        nextLabel={nextLabel}
      />
    </div>
  )
}
