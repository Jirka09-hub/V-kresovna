'use client'

import type { Difficulty, ErrorCode, ExerciseKind, TaskResult } from '@vykresovna/exercises'
import { useTranslations } from 'next-intl'
import { useTask } from '@/lib/engine/hooks'
import { AssignViews } from './AssignViews'
import { DrawingToModel } from './DrawingToModel'
import { FindError } from './FindError'
import { MissingView } from './MissingView'

export type TaskRef = {
  readonly kind: ExerciseKind
  readonly seed: number
  readonly difficulty: Difficulty
  /** Upřednostněný druh chyby (vstup generátoru, adaptivita). */
  readonly focus?: ErrorCode
  /** Úloha vybraná adaptivně: 'weakness' = podle chyb uživatele. */
  readonly adaptive?: 'weakness' | 'practice'
}

/** Klíč textů podle typu cvičení (`exercises.kind.*`, `exercises.instructions.*`). */
export const KIND_KEY: Record<
  ExerciseKind,
  'assignViews' | 'missingView' | 'drawingToModel' | 'findError'
> = {
  'assign-views': 'assignViews',
  'missing-view': 'missingView',
  'drawing-to-model': 'drawingToModel',
  'find-error': 'findError',
}

type Props = {
  task: TaskRef
  onResult: (r: TaskResult) => void
  onNext: () => void
  nextLabel: string
}

/** Vygeneruje úlohu ze seedu (ve workeru) a zobrazí odpovídající cvičení. */
export function ExerciseRunner({ task: ref, onResult, onNext, nextLabel }: Props) {
  const t = useTranslations('exercises')
  const tc = useTranslations('common')
  const { data: task, error } = useTask(ref.kind, ref.seed, ref.difficulty, ref.focus)
  const props = { onResult, onNext, nextLabel }

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="exercise"
      data-kind={ref.kind}
      data-seed={ref.seed}
      data-difficulty={ref.difficulty}
      data-adaptive={ref.adaptive}
    >
      <p className="max-w-3xl text-muted">{t(`instructions.${KIND_KEY[ref.kind]}`)}</p>
      {error ? (
        <p role="alert" className="text-red-700">
          {tc('error', { message: error })}
        </p>
      ) : !task ? (
        <p role="status" className="py-16 text-center text-muted">
          {t('loading')}
        </p>
      ) : task.kind === 'assign-views' ? (
        <AssignViews task={task} {...props} />
      ) : task.kind === 'missing-view' ? (
        <MissingView task={task} {...props} />
      ) : task.kind === 'find-error' ? (
        <FindError task={task} {...props} />
      ) : (
        <DrawingToModel task={task} {...props} />
      )}
    </div>
  )
}
