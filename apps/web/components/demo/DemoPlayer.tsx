'use client'

import { DEMO_SHOWCASE_PART, DEMO_TASKS } from '@vykresovna/content'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { TaskRef } from '@/components/exercises/ExerciseRunner'
import { TaskSequence } from '@/components/exercises/TaskSequence'
import { UnfoldDemo } from '@/components/lessons/UnfoldDemo'
import { btnPrimary, btnSecondary, panel } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { randomSeed } from '@/lib/seeds'

/** Demo: 3D ukázka rozložení pohledů → pět úloh → shrnutí. Nic se neukládá. */
export function DemoPlayer() {
  const t = useTranslations('demo')
  const [phase, setPhase] = useState<'showcase' | 'tasks'>('showcase')
  const [tasks, setTasks] = useState<readonly TaskRef[]>(DEMO_TASKS)
  const [round, setRound] = useState(0)

  const newVariant = () => {
    setTasks(DEMO_TASKS.map((task) => ({ ...task, seed: randomSeed() })))
    setRound((r) => r + 1)
    setPhase('tasks')
  }

  if (phase === 'showcase') {
    return (
      <section
        className={`flex flex-col gap-4 p-4 sm:p-6 ${panel}`}
        aria-labelledby="showcase-title"
        data-testid="showcase"
      >
        <div className="flex max-w-3xl flex-col gap-2">
          <h2 id="showcase-title" className="text-xl font-bold">
            {t('showcaseTitle')}
          </h2>
          <p className="text-muted">{t('showcaseText')}</p>
        </div>
        <UnfoldDemo part={DEMO_SHOWCASE_PART} label={t('showcaseTitle')} />
        <div>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setPhase('tasks')}
            data-testid="start-tasks"
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
      tasks={tasks}
      toolbar={
        <button
          type="button"
          className={btnSecondary}
          onClick={newVariant}
          title={t('newVariantHint')}
          data-testid="new-variant"
        >
          {t('newVariant')}
        </button>
      }
      summaryText={t('summaryText')}
      summaryActions={
        <>
          <Link href="/lekce" className={btnPrimary}>
            {t('toLessons')}
          </Link>
          <button type="button" className={btnSecondary} onClick={newVariant}>
            {t('newVariant')}
          </button>
        </>
      }
    />
  )
}
