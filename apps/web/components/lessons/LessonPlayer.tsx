'use client'

import { expandPlan, getLesson, type IntroScreen, type Lesson } from '@vykresovna/content'
import { pickNextTask } from '@vykresovna/exercises/adaptivity'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { TaskSequence, type SequenceItem } from '@/components/exercises/TaskSequence'
import type { TaskRef } from '@/components/exercises/ExerciseRunner'
import { ResultsBanner, SaveNotice } from '@/components/results/ResultsBanner'
import { btnPrimary, btnSecondary, panel } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { useAttemptHistory, useLessonRecorder } from '@/lib/results/hooks'
import { randomSeed } from '@/lib/seeds'
import { sessionHistory } from '@/lib/session-history'
import { DimensionDemo } from './DimensionDemo'
import { ErrorExampleDemo } from './ErrorExampleDemo'
import { FinalTest } from './FinalTest'
import { LinkedDemo } from './LinkedDemo'
import { SectionDemo } from './SectionDemo'
import { UnfoldDemo } from './UnfoldDemo'

/** Pevné úlohy plánu s novými seedy a na konci místa pro adaptivní úlohy. */
function lessonItems(lesson: Lesson): SequenceItem[] {
  return [
    ...expandPlan(lesson.plan).map((p) => ({ ...p, seed: randomSeed() })),
    ...Array.from({ length: lesson.adaptive?.count ?? 0 }, () => ({
      adaptiveSlot: true as const,
      seed: randomSeed(),
    })),
  ]
}

/** Adaptivní úloha podle historie (relace a u přihlášeného i minulých pokusů, D-023, D-029). */
function adaptiveTask(lesson: Lesson, seed: number): TaskRef {
  const slots = lesson.adaptive!
  const pick = pickNextTask(sessionHistory(), seed, {
    kinds: slots.kinds,
    minDifficulty: slots.minDifficulty,
    maxDifficulty: slots.maxDifficulty,
    baseDifficulty: lesson.plan.at(-1)?.difficulty ?? slots.minDifficulty,
  })
  return {
    kind: pick.kind,
    difficulty: pick.difficulty,
    seed,
    ...(pick.focus ? { focus: pick.focus } : {}),
    adaptive: pick.reason,
  }
}

/** Lekce: úvodní výklad (1–2 obrazovky s živým 3D) → úlohy podle plánu → shrnutí. */
export function LessonPlayer({ slug }: { slug: string }) {
  const t = useTranslations('lessons')
  const found = getLesson(slug)!
  const { lesson, module: mod } = found
  const [screen, setScreen] = useState(0)
  const [phase, setPhase] = useState<'intro' | 'tasks'>(lesson.intro.length ? 'intro' : 'tasks')
  const makeTasks = () => lessonItems(lesson)
  // seedy se losují až při přechodu na úlohy (v obsluze kliknutí, tedy jednou): React smí první
  // vykreslení zahodít a zopakovat (načítání, přihlášení), a pak by se losovalo znovu
  const [tasks, setTasks] = useState<SequenceItem[] | null>(() =>
    lesson.intro.length || lesson.test ? null : makeTasks(),
  )
  const toTasks = () => {
    if (!tasks) setTasks(makeTasks())
    setPhase('tasks')
  }
  const [round, setRound] = useState(0)
  useAttemptHistory()
  const recorder = useLessonRecorder({
    moduleSlug: mod.slug,
    lessonSlug: slug,
    taskCount: tasks?.length ?? 0,
    round,
  })

  const available = mod.lessons.filter((l) => l.status === 'available')
  const nextLesson = available[available.findIndex((l) => l.slug === slug) + 1]

  if (lesson.test && phase === 'tasks') {
    return (
      <div className="flex flex-col gap-4">
        <ResultsBanner slug={slug} />
        <FinalTest spec={lesson.test} moduleSlug={mod.slug} lessonSlug={slug} />
      </div>
    )
  }

  if (phase === 'intro') {
    const current = lesson.intro[screen]!
    const last = screen === lesson.intro.length - 1
    return (
      <div className="flex flex-col gap-4">
        <ResultsBanner slug={slug} />
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
              <button type="button" className={btnPrimary} onClick={toTasks} data-testid="to-tasks">
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
                <button type="button" className={btnSecondary} onClick={toTasks}>
                  {t('skipIntro')}
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    )
  }

  if (!tasks) return null
  return (
    <div className="flex flex-col gap-4">
      <ResultsBanner slug={slug} />
      <SaveNotice save={recorder.save} />
      <TaskSequence
        key={round}
        tasks={tasks}
        onOutcome={recorder.onOutcome}
        resolveAdaptive={(seed) => adaptiveTask(lesson, seed)}
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
    </div>
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
      ) : screen.demo.kind === 'error-example' ? (
        <ErrorExampleDemo part={screen.part} mutation={screen.demo.mutation} />
      ) : screen.demo.kind === 'section' ? (
        <SectionDemo part={screen.part} axis={screen.demo.axis} at={screen.demo.at} />
      ) : screen.demo.kind === 'dimensions' ? (
        <DimensionDemo
          part={screen.part}
          {...(screen.demo.features ? { features: screen.demo.features } : {})}
        />
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
