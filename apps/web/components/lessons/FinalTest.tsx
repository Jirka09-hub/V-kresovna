'use client'

import { finalTestTasks, type FinalTestSpec } from '@vykresovna/content'
import { EXERCISE_KINDS, type ErrorCode } from '@vykresovna/exercises'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { KIND_KEY, type TaskRef } from '@/components/exercises/ExerciseRunner'
import { CheckIcon, CrossIcon } from '@/components/exercises/icons'
import { TaskSequence, type Outcome } from '@/components/exercises/TaskSequence'
import { btnPrimary, btnSecondary, panel } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { randomSeed } from '@/lib/seeds'

/**
 * Závěrečný test modulu: pevný počet úloh ze všech typů cvičení (seedy z jednoho seedu testu),
 * během testu bez zpětné vazby, na konci skóre, rozpis podle typů a vysvětlení chyb. Nic se
 * neukládá (certifikát přijde s účty ve fázi 4).
 */
export function FinalTest({ spec }: { spec: FinalTestSpec }) {
  const t = useTranslations('finalTest')
  const [phase, setPhase] = useState<'intro' | 'test'>('intro')
  const [testSeed, setTestSeed] = useState(randomSeed)
  const [round, setRound] = useState(0)
  const percent = Math.round(spec.passThreshold * 100)

  if (phase === 'intro') {
    return (
      <section
        className={`flex flex-col gap-4 p-4 sm:p-6 ${panel}`}
        aria-labelledby="test-intro"
        data-testid="test-intro"
      >
        <h2 id="test-intro" className="text-xl font-bold">
          {t('introTitle')}
        </h2>
        <ul className="flex max-w-3xl list-disc flex-col gap-1 pl-5 text-muted">
          <li>{t('ruleCount', { count: spec.plan.length })}</li>
          <li>{t('ruleNoFeedback')}</li>
          <li>{t('rulePass', { percent })}</li>
          <li>{t('ruleNothingStored')}</li>
        </ul>
        <div>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setPhase('test')}
            data-testid="start-test"
          >
            {t('start')}
          </button>
        </div>
      </section>
    )
  }

  return (
    <TaskSequence
      key={round}
      tasks={finalTestTasks(testSeed, spec)}
      testMode
      summaryActions={null}
      summaryTitle={t('resultsTitle')}
      renderSummary={(tasks, outcomes) => (
        <Results
          tasks={tasks}
          outcomes={outcomes}
          threshold={spec.passThreshold}
          onRetry={() => {
            setTestSeed(randomSeed())
            setRound((r) => r + 1)
          }}
        />
      )}
    />
  )
}

function Results({
  tasks,
  outcomes,
  threshold,
  onRetry,
}: {
  tasks: readonly TaskRef[]
  outcomes: readonly Outcome[]
  threshold: number
  onRetry: () => void
}) {
  const t = useTranslations('finalTest')
  const te = useTranslations('exercises')
  const ok = (o: Outcome | undefined) => !!o && o !== 'skipped' && o.correct
  const correct = outcomes.filter(ok).length
  const total = tasks.length
  const score = total ? correct / total : 0
  const passed = score >= threshold - 1e-9
  const kinds = EXERCISE_KINDS.filter((k) => tasks.some((task) => task.kind === k))
  const mistakes = tasks.map((task, i) => ({ task, i, o: outcomes[i] })).filter(({ o }) => !ok(o))

  return (
    <div
      className="flex flex-col gap-5"
      data-testid="test-results"
      data-score={correct}
      data-passed={String(passed)}
    >
      <div
        role="status"
        className={`flex items-start gap-3 rounded-lg border-2 p-4 ${
          passed ? 'border-green-700 bg-green-50' : 'border-red-700 bg-red-50'
        }`}
      >
        <span className={passed ? 'text-green-700' : 'text-red-700'}>
          {passed ? <CheckIcon className="h-7 w-7" /> : <CrossIcon className="h-7 w-7" />}
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-bold">{passed ? t('passed') : t('failed')}</p>
          <p>
            {t('score', { correct, total, percent: Math.round(score * 100) })}{' '}
            {t('threshold', { percent: Math.round(threshold * 100) })}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">{t('byKind')}</h3>
        <table className="w-full max-w-xl text-left text-sm" data-testid="test-by-kind">
          <thead>
            <tr className="border-b border-slate-300">
              <th scope="col" className="py-1 pr-4 font-semibold">
                {t('kindColumn')}
              </th>
              <th scope="col" className="py-1 font-semibold">
                {t('resultColumn')}
              </th>
            </tr>
          </thead>
          <tbody>
            {kinds.map((kind) => {
              const idx = tasks.flatMap((task, i) => (task.kind === kind ? [i] : []))
              const good = idx.filter((i) => ok(outcomes[i])).length
              return (
                <tr key={kind} className="border-b border-slate-200" data-kind={kind}>
                  <th scope="row" className="py-1 pr-4 font-normal">
                    {te(`kind.${KIND_KEY[kind]}`)}
                  </th>
                  <td className="py-1 tabular-nums">
                    {t('kindScore', { correct: good, total: idx.length })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {mistakes.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{t('mistakes')}</h3>
          <ol className="flex flex-col gap-2 text-sm" data-testid="test-mistakes">
            {mistakes.map(({ task, i, o }) => {
              const codes: ErrorCode[] =
                o && o !== 'skipped' ? [...new Set(o.errors.map((e) => e.code))] : []
              return (
                <li key={i} className="flex flex-col gap-0.5">
                  <span className="font-semibold">
                    {t('mistakeTask', { n: i + 1 })} · {te(`kind.${KIND_KEY[task.kind]}`)}
                  </span>
                  {codes.length ? (
                    codes.map((code) => <span key={code}>{te(`errors.${code}`)}</span>)
                  ) : (
                    <span>{t('skipped')}</span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}

      <p className="text-sm text-muted" data-testid="certificate-note">
        {t('certificateNote')}
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={btnPrimary} onClick={onRetry} data-testid="retry-test">
          {t('retry')}
        </button>
        <Link href="/lekce" className={btnSecondary}>
          {t('backToLessons')}
        </Link>
      </div>
    </div>
  )
}
