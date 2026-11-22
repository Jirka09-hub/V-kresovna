'use client'

import { FIRST_ANGLE_LAYOUT } from '@vykresovna/drafting-standards'
import {
  givenRender,
  optionRender,
  targetRender,
  type SectionChooseTask,
  type SectionOption,
  type SectionPlaceTask,
  type SectionRender,
  type SectionTask,
} from '@vykresovna/exercises'
import type { PartViewerHandle } from '@vykresovna/viewer'
import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { cellFor, ScaledView } from '@/components/drawing/ScaledView'
import { Model3D } from '@/components/three/Model3D'
import { btnPrimary, btnSecondary, panel } from '@/components/ui'
import { evaluateAnswer } from '@/lib/engine/client'
import { featureEdgeIds } from '@/lib/engine/highlight'
import { useRenderParts, useSectionSvgs } from '@/lib/engine/hooks'
import type { TaskResult } from '@vykresovna/exercises'
import type { ExerciseProps } from './AssignViews'
import { letterOf, OptionCard, optionStatus, type ChoiceState } from './choice'
import { Feedback } from './Feedback'
import { gridArea, gridBounds, gridMaxWidth, gridSize, positionKey } from './grid'

/** Cvičení 5: řez. Varianta „vyber řez A–A“, nebo „umísti rovinu řezu“. */
export function Section(props: ExerciseProps<SectionTask>) {
  const { task } = props
  return task.variant === 'choose' ? (
    <SectionChoose {...props} task={task} />
  ) : (
    <SectionPlace {...props} task={task} />
  )
}

/** 3D model součásti s rentgenem; volitelně s rovinou řezu. */
function useModel(task: SectionTask) {
  const parts = useMemo(() => [task.part], [task.part])
  const rendered = useRenderParts(parts)
  const data = rendered.data?.[0] ?? null
  const highlighted = useMemo(
    () => (data ? featureEdgeIds(data.edges, task.featureId) : []),
    [data, task.featureId],
  )
  return { data, highlighted }
}

function ModelControls({
  viewer,
  xray,
  setXray,
}: {
  viewer: React.RefObject<PartViewerHandle | null>
  xray: boolean
  setXray: (x: boolean) => void
}) {
  const tm = useTranslations('model3d')
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={btnSecondary} onClick={() => viewer.current?.reset()}>
        {tm('reset')}
      </button>
      <button
        type="button"
        className={btnSecondary}
        aria-pressed={xray}
        onClick={() => setXray(!xray)}
      >
        {tm('xray')}
      </button>
    </div>
  )
}

function SectionChoose({ task, onResult, onNext, nextLabel }: ExerciseProps<SectionChooseTask>) {
  const t = useTranslations('exercises')
  const ts = useTranslations('exercises.section')
  const td = useTranslations('drafting.view')
  const tc = useTranslations('common')
  const [state, setState] = useState<ChoiceState>(null)
  const [busy, setBusy] = useState(false)
  const [xray, setXray] = useState(false)
  const viewer = useRef<PartViewerHandle>(null)
  const model = useModel(task)

  const renders = useMemo<SectionRender[]>(
    () => [givenRender(task), ...task.options.map((o) => optionRender(o))],
    [task],
  )
  const svgs = useSectionSvgs(renders)
  const given = svgs.data?.[0] ?? null
  const options = svgs.data?.slice(1).map((x) => x[0]!) ?? null
  const cell = svgs.data ? cellFor(svgs.data.flat()) : null
  const aspect = cell ? cell.width / cell.height : 1.5

  const correct = task.options.find((o) => o.errorCode === null)!
  const correctIndex = task.options.indexOf(correct)
  const positions = [...task.givenViews, task.view].map((v) => FIRST_ANGLE_LAYOUT[v])
  const bounds = gridBounds(positions)
  const size = gridSize(bounds)

  const choose = async (o: SectionOption) => {
    if (state || busy) return
    setBusy(true)
    try {
      const answer = { kind: 'section', optionId: o.id } as const
      const result = await evaluateAnswer(task, answer)
      setState({ chosenId: o.id, result })
      onResult(result, answer)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="section-choose">
      {svgs.error ? (
        <p role="alert" className="text-red-700">
          {tc('error', { message: svgs.error })}
        </p>
      ) : null}
      <p className="max-w-3xl text-sm">{ts('chooseTask')}</p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2" aria-labelledby="section-given">
            <h3 id="section-given" className="text-sm font-semibold text-muted">
              {ts('given')}
            </h3>
            <div
              role="group"
              aria-label={ts('givenLabel')}
              className={`grid w-full gap-2 p-2 ${panel}`}
              style={{
                gridTemplateColumns: `repeat(${size.cols}, minmax(0, 1fr))`,
                maxWidth: gridMaxWidth(size.cols, size.rows, aspect, 34),
              }}
              data-testid="given-views"
            >
              {task.givenViews.map((v, i) => (
                <div key={v} style={gridArea(bounds, FIRST_ANGLE_LAYOUT[v])}>
                  <span className="flex h-5 items-center px-1.5 text-xs font-semibold text-muted">
                    {td(v)}
                    {v === task.cuttingPlaneView ? ` · ${ts('planeHere')}` : ''}
                  </span>
                  {given && cell ? (
                    <ScaledView drawing={given[i]!} cell={cell} label={td(v)} />
                  ) : (
                    <div style={{ aspectRatio: aspect }} />
                  )}
                </div>
              ))}
              <div
                style={gridArea(bounds, FIRST_ANGLE_LAYOUT[task.view])}
                className={`rounded-md border-2 border-dashed ${state ? 'border-green-700' : 'border-accent'}`}
                data-testid="section-frame"
                data-slot={positionKey(FIRST_ANGLE_LAYOUT[task.view])}
              >
                <span className="flex h-5 items-center px-1.5 text-xs font-semibold text-accent">
                  {ts('frame')}
                </span>
                {state && options && cell ? (
                  <ScaledView
                    drawing={options[correctIndex]!}
                    cell={cell}
                    label={ts('correctSection')}
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
          <section className="flex flex-col gap-2" aria-labelledby="section-model">
            <h3 id="section-model" className="text-sm font-semibold text-muted">
              {state ? ts('modelCut') : ts('model')}
            </h3>
            <Model3D
              data={model.data}
              ariaLabel={state ? ts('modelCutLabel') : ts('modelLabel')}
              xray={xray}
              viewerRef={viewer}
              highlightedEdgeIds={model.highlighted}
              sectionPlane={state ? { axis: task.section.axis, at: task.section.at } : null}
              className="aspect-[4/3] w-full max-w-xl"
            />
            <ModelControls viewer={viewer} xray={xray} setXray={setXray} />
          </section>
        </div>

        <section className="flex flex-col gap-2" aria-labelledby="section-options">
          <h3 id="section-options" className="text-sm font-semibold text-muted">
            {ts('options')}
          </h3>
          <div
            className="grid w-full grid-cols-2 gap-3"
            style={{ maxWidth: gridMaxWidth(2, 2, aspect, 46) }}
            data-test-correct={correct.id}
          >
            {task.options.map((o, i) => (
              <OptionCard
                key={o.id}
                index={i}
                optionId={o.id}
                label={ts('optionLabel', { letter: letterOf(i) })}
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
          <p className="text-sm">
            {t('optionLetter', { letter: letterOf(correctIndex) })}. {ts('correctHint')}
          </p>
        }
        onNext={onNext}
        nextLabel={nextLabel}
      />
    </div>
  )
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

function SectionPlace({ task, onResult, onNext, nextLabel }: ExerciseProps<SectionPlaceTask>) {
  const ts = useTranslations('exercises.section')
  const t = useTranslations('exercises')
  const tc = useTranslations('common')
  const [at, setAt] = useState(task.start)
  const [result, setResult] = useState<TaskResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [showCorrect, setShowCorrect] = useState(false)
  const [xray, setXray] = useState(false)
  const viewer = useRef<PartViewerHandle>(null)
  const model = useModel(task)
  const axisName = task.section.axis.toUpperCase()

  const answered = result !== null
  const setPlane = (x: number) => {
    if (answered) return
    const snapped = Math.round(x / task.step) * task.step
    setAt(clamp(snapped, task.range.min, task.range.max))
  }

  // zadání: správný řez; po chybné odpovědi i řez v rovině, kterou zvolil uživatel
  const renders = useMemo<SectionRender[]>(() => {
    const target = targetRender(task)
    if (!result || result.correct) return [target]
    return [target, { ...target, section: { ...task.section, at } }]
  }, [task, result, at])
  const svgs = useSectionSvgs(renders)
  const cell = svgs.data ? cellFor(svgs.data.flat()) : null

  const check = async () => {
    if (answered || busy) return
    setBusy(true)
    try {
      const answer = { kind: 'section', at } as const
      const r = await evaluateAnswer(task, answer)
      setResult(r)
      onResult(r, answer)
    } finally {
      setBusy(false)
    }
  }

  const planeAt = showCorrect ? task.section.at : at
  return (
    <div
      className="flex flex-col gap-4"
      data-testid="section-place"
      data-test-answer-at={task.section.at}
      data-test-tolerance={task.toleranceMm}
    >
      {svgs.error ? (
        <p role="alert" className="text-red-700">
          {tc('error', { message: svgs.error })}
        </p>
      ) : null}
      <p className="max-w-3xl text-sm">{ts('placeTask', { axis: axisName })}</p>
      <div className="grid items-start gap-6 lg:grid-cols-[2fr_3fr]">
        <section className="flex flex-col gap-2" aria-labelledby="section-target">
          <h3 id="section-target" className="text-sm font-semibold text-muted">
            {ts('target')}
          </h3>
          <div className={`p-2 ${panel}`} data-testid="section-target">
            {svgs.data && cell ? (
              <ScaledView drawing={svgs.data[0]![0]!} cell={cell} label={ts('targetLabel')} />
            ) : (
              <div className="aspect-[4/3]" />
            )}
          </div>
        </section>
        <section className="flex flex-col gap-2" aria-labelledby="section-model">
          <h3 id="section-model" className="text-sm font-semibold text-muted">
            {ts('modelPlane')}
          </h3>
          <Model3D
            data={model.data}
            ariaLabel={ts('modelPlaneLabel')}
            xray={xray}
            viewerRef={viewer}
            sectionPlane={{ axis: task.section.axis, at: planeAt }}
            {...(answered ? {} : { onSectionChange: setPlane })}
            sectionStep={task.step}
            className="aspect-[4/3] w-full"
          />
          <ModelControls viewer={viewer} xray={xray} setXray={setXray} />
          <label className="flex flex-col gap-1 text-sm">
            <span>{ts('position', { axis: axisName, value: planeAt })}</span>
            <input
              type="range"
              min={task.range.min}
              max={task.range.max}
              step={task.step}
              value={planeAt}
              disabled={answered}
              aria-label={ts('slider')}
              aria-valuetext={ts('sliderValue', { axis: axisName, value: planeAt })}
              data-testid="section-slider"
              onChange={(e) => setPlane(Number(e.target.value))}
            />
          </label>
          <p className="text-sm text-muted">{ts('placeHint')}</p>
        </section>
      </div>
      {!answered ? (
        <div>
          <button
            type="button"
            className={btnPrimary}
            onClick={check}
            disabled={busy}
            data-testid="check"
          >
            {busy ? t('checking') : t('check')}
          </button>
        </div>
      ) : null}
      <Feedback
        result={result}
        correctAnswer={
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              {ts('correctPlane', {
                axis: axisName,
                value: task.section.at,
                chosen: at,
              })}
            </p>
            {svgs.data?.[1] && cell ? (
              <figure className="flex max-w-sm flex-col gap-1">
                <figcaption className="text-xs font-semibold text-muted">
                  {ts('yourSection')}
                </figcaption>
                <div className={`p-2 ${panel}`}>
                  <ScaledView drawing={svgs.data[1][0]!} cell={cell} label={ts('yourSection')} />
                </div>
              </figure>
            ) : null}
            <div>
              <button
                type="button"
                className={btnSecondary}
                aria-pressed={showCorrect}
                onClick={() => setShowCorrect((s) => !s)}
                data-testid="show-correct-plane"
              >
                {showCorrect ? ts('showYourPlane') : ts('showCorrectPlane')}
              </button>
            </div>
          </div>
        }
        onNext={onNext}
        nextLabel={nextLabel}
      />
    </div>
  )
}
