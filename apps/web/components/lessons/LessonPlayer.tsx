'use client'

import { expandPlan, getLesson, type IntroScreen } from '@vykresovna/content'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { TaskSequence } from '@/components/exercises/TaskSequence'
import type { TaskRef } from '@/components/exercises/ExerciseRunner'
import { btnPrimary, btnSecondary, panel } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { randomSeed } from '@/lib/seeds'
import { LinkedDemo } from './LinkedDemo'
import { UnfoldDemo } from './UnfoldDemo'

/** Lekce: úvodní výklad (1–2 obrazovky s živým 3D) → úlohy podle plánu → shrnutí. */
export function LessonPlayer({ slug }: { slug: string }) {
  const t = useTranslations('lessons')
  const found = getLesson(slug)!
  const { lesson, module: mod } = found
  const [screen, setScreen] = useState(0)
  const [phase, setPhase] = useState<'intro' | 'tasks'>(lesson.intro.length ? 'intro' : 'tasks')
  const makeTasks = (): TaskRef[] =>
    expandPlan(lesson.plan).map((p) => ({ ...p, seed: randomSeed() }))
  const [tasks, setTasks] = useState(makeTasks)
  const [round, setRound] = useState(0)

  const available = mod.lessons.filter((l) => l.status === 'available')
  const nextLesson = available[available.findIndex((l) => l.slug === slug) + 1]

  if (phase === 'intro') {
    const current = lesson.intro[screen]!
    const last = screen === lesson.intro.length - 1
    return (
      <section className="flex flex-col gap-4" aria-labelledby="intro-title" data-testid="intro">
        <p className="text-sm font-semibold text-muted">
          {t('introProgress', { current: screen + 1, total: lesson.intro.length })}
        </p>
        <IntroScreenView key={current.id} slug={slug} screen={current} />
        <div className="flex flex-wrap items-center gap-3">
          {screen > 0 ? (
            <button type="button" className={btnSecondary} onClick={() => setScreen(screen - 1)}>
              {t('prevScreen')}
            </button>
          ) : null}
          {last ? (
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setPhase('tasks')}
              data-testid="to-tasks"
            >
              {t('toTasks')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setScreen(screen + 1)}
                data-testid="next-screen"
              >
                {t('nextScreen')}
              </button>
              <button type="button" className={btnSecondary} onClick={() => setPhase('tasks')}>
                {t('skipIntro')}
              </button>
            </>
          )}
        </div>
      </section>
    )
  }

  return (
    <TaskSequence
      key={round}
      tasks={tasks}
      summaryText={t('summaryText')}
      summaryActions={
        <>
          {nextLesson ? (
            <Link href={`/lekce/${nextLesson.slug}`} className={btnPrimary}>
              {t('nextLesson', { title: t(`items.${nextLesson.slug}.title`) })}
            </Link>
          ) : null}
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setTasks(makeTasks())
              setRound((r) => r + 1)
            }}
          >
            {t('repeat')}
          </button>
          <Link href="/lekce" className={btnSecondary}>
            {t('backToOverview')}
          </Link>
        </>
      }
    />
  )
}

function IntroScreenView({ slug, screen }: { slug: string; screen: IntroScreen }) {
  const t = useTranslations('lessons')
  const base = `items.${slug}.intro.${screen.id}`
  return (
    <div className={`flex flex-col gap-4 p-4 sm:p-6 ${panel}`}>
      <div className="flex max-w-3xl flex-col gap-2">
        <h2 id="intro-title" className="text-xl font-bold">
          {t(`${base}.title`)}
        </h2>
        <p className="text-muted">{t(`${base}.text`)}</p>
      </div>
      {screen.demo.kind === 'unfold' ? (
        <UnfoldDemo part={screen.part} label={t(`${base}.title`)} />
      ) : (
        <LinkedDemo
          part={screen.part}
          {...(screen.demo.xray !== undefined ? { xray: screen.demo.xray } : {})}
          {...(screen.demo.reveal !== undefined ? { reveal: screen.demo.reveal } : {})}
          {...(screen.demo.features ? { features: screen.demo.features } : {})}
        />
      )}
    </div>
  )
}
