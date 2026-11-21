'use client'

import type { ErrorCode, TaskResult } from '@vykresovna/exercises'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { panel } from '@/components/ui'
import { ExerciseRunner, KIND_KEY, type TaskRef } from './ExerciseRunner'
import { CheckIcon, CrossIcon } from './icons'

type Outcome = TaskResult | 'skipped' | null

type Props = {
  tasks: readonly TaskRef[]
  /** Tlačítka pod shrnutím (nová sada, další lekce…). */
  summaryActions: ReactNode
  /** Text pod skóre ve shrnutí. */
  summaryText?: string
}

/** Úlohy jedna po druhé s ukazatelem postupu a shrnutím na konci. Nic se neukládá. */
export function TaskSequence({ tasks, summaryActions, summaryText }: Props) {
  const ts = useTranslations('sequence')
  const t = useTranslations('exercises')
  const [index, setIndex] = useState(0)
  const [outcomes, setOutcomes] = useState<Outcome[]>(() => tasks.map(() => null))
  const heading = useRef<HTMLHeadingElement>(null)
  const first = useRef(true)
  const done = index >= tasks.length

  // při přechodu na další úlohu (ne při prvním zobrazení) přesunout fokus na nadpis
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    heading.current?.focus()
    heading.current?.scrollIntoView({ block: 'start' })
  }, [index])

  const next = () => {
    setOutcomes((o) => o.map((x, i) => (i === index && x === null ? 'skipped' : x)))
    setIndex((i) => i + 1)
  }

  const current = tasks[index]
  return (
    <div className="flex flex-col gap-5">
      <Progress tasks={tasks} outcomes={outcomes} index={index} />
      {!done && current ? (
        <section className="flex flex-col gap-3" aria-labelledby="task-heading">
          <h2
            id="task-heading"
            ref={heading}
            tabIndex={-1}
            className="scroll-mt-4 text-xl font-bold focus:outline-none"
          >
            {ts('progress', { current: index + 1, total: tasks.length })}
            <span className="font-normal text-muted"> · </span>
            {t(`kind.${KIND_KEY[current.kind]}`)}
            <span className="ml-3 align-middle text-sm font-normal text-muted">
              {t('difficulty', { level: current.difficulty })}
            </span>
          </h2>
          <ExerciseRunner
            key={`${index}:${current.kind}:${current.seed}`}
            task={current}
            onResult={(r) => setOutcomes((o) => o.map((x, i) => (i === index ? r : x)))}
            onNext={next}
            nextLabel={index === tasks.length - 1 ? t('finish') : t('next')}
          />
        </section>
      ) : (
        <Summary
          tasks={tasks}
          outcomes={outcomes}
          headingRef={heading}
          text={summaryText}
          actions={summaryActions}
        />
      )}
    </div>
  )
}

type StepState = 'current' | 'todo' | 'skipped' | 'done' | 'wrong'

function stepState(o: Outcome | undefined, i: number, index: number): StepState {
  if (o === null || o === undefined) return i === index ? 'current' : 'todo'
  if (o === 'skipped') return 'skipped'
  return o.correct ? 'done' : 'wrong'
}

function Progress({
  tasks,
  outcomes,
  index,
}: {
  tasks: readonly TaskRef[]
  outcomes: readonly Outcome[]
  index: number
}) {
  const ts = useTranslations('sequence')
  return (
    <nav aria-label={ts('progressLabel')}>
      <ol className="flex flex-wrap items-center gap-2" data-testid="progress">
        {tasks.map((task, i) => {
          const state = stepState(outcomes[i], i, index)
          const label =
            state === 'current'
              ? ts('stepCurrent', { n: i + 1 })
              : state === 'done'
                ? ts('stepDone', { n: i + 1 })
                : state === 'wrong'
                  ? ts('stepWrong', { n: i + 1 })
                  : state === 'skipped'
                    ? ts('stepSkipped', { n: i + 1 })
                    : ts('stepTodo', { n: i + 1 })
          return (
            <li
              key={`${i}:${task.seed}`}
              aria-label={label}
              aria-current={state === 'current' ? 'step' : undefined}
              data-state={state}
              className={`flex h-8 min-w-8 items-center justify-center rounded-full border-2 px-2 text-sm font-semibold ${
                state === 'current'
                  ? 'border-accent bg-blue-50 text-accent'
                  : state === 'done'
                    ? 'border-green-700 bg-green-50 text-green-700'
                    : state === 'wrong'
                      ? 'border-red-700 bg-red-50 text-red-700'
                      : 'border-slate-300 bg-white text-muted'
              }`}
            >
              {state === 'done' ? (
                <CheckIcon className="h-4 w-4" />
              ) : state === 'wrong' ? (
                <CrossIcon className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Summary({
  tasks,
  outcomes,
  headingRef,
  text,
  actions,
}: {
  tasks: readonly TaskRef[]
  outcomes: readonly Outcome[]
  headingRef: React.RefObject<HTMLHeadingElement | null>
  text: string | undefined
  actions: ReactNode
}) {
  const ts = useTranslations('sequence')
  const t = useTranslations('exercises')
  const correct = outcomes.filter((o) => o && o !== 'skipped' && o.correct).length
  const codes = new Map<ErrorCode, number>()
  for (const o of outcomes) {
    if (!o || o === 'skipped') continue
    for (const code of new Set(o.errors.map((e) => e.code))) {
      codes.set(code, (codes.get(code) ?? 0) + 1)
    }
  }
  const verdict =
    correct === tasks.length
      ? ts('summaryPerfect')
      : correct >= tasks.length * 0.6
        ? ts('summaryGood')
        : ts('summaryPractice')
  return (
    <section
      className={`flex flex-col gap-4 p-6 ${panel}`}
      aria-labelledby="task-heading"
      data-testid="summary"
    >
      <h2 id="task-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold focus:outline-none">
        {ts('summaryTitle')}
      </h2>
      <p className="text-lg" role="status">
        {ts('summaryScore', { correct, total: tasks.length })} {verdict}
      </p>
      <ol className="flex flex-col gap-1 text-sm">
        {tasks.map((task, i) => {
          const o = outcomes[i]
          const ok = !!o && o !== 'skipped' && o.correct
          return (
            <li key={`${i}:${task.seed}`} className="flex items-center gap-2">
              <span className={ok ? 'text-green-700' : 'text-red-700'}>
                {ok ? <CheckIcon className="h-4 w-4" /> : <CrossIcon className="h-4 w-4" />}
              </span>
              <span>
                {ts('progress', { current: i + 1, total: tasks.length })} ·{' '}
                {t(`kind.${KIND_KEY[task.kind]}`)}:{' '}
                {ok
                  ? ts('summaryTaskCorrect')
                  : o === 'skipped' || o === null
                    ? ts('summaryTaskSkipped')
                    : ts('summaryTaskWrong')}
              </span>
            </li>
          )
        })}
      </ol>
      {codes.size > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">{ts('commonErrors')}</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {[...codes.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([code]) => (
                <li key={code}>{t(`errors.${code}`)}</li>
              ))}
          </ul>
        </div>
      ) : null}
      {text ? <p className="text-muted">{text}</p> : null}
      <div className="flex flex-wrap gap-3">{actions}</div>
    </section>
  )
}
