'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { CheckIcon } from '@/components/exercises/icons'
import { useRecordingMode } from '@/lib/results/hooks'
import { createClient } from '@/lib/supabase/client'

type LessonState = {
  readonly finishedRuns: number
  readonly bestScore: number | null
  readonly started: boolean
}

type Assignment = { readonly dueAt: string | null }

type Progress = {
  readonly lessons: ReadonlyMap<string, LessonState>
  readonly assignments: ReadonlyMap<string, Assignment>
}

const EMPTY: Progress = { lessons: new Map(), assignments: new Map() }
const ProgressContext = createContext<Progress>(EMPTY)

/** Dřívější termín (bez termínu = nejpozději). */
function earlier(a: Assignment | undefined, b: Assignment): Assignment {
  if (!a) return b
  if (!a.dueAt) return b
  if (!b.dueAt) return a
  return a.dueAt <= b.dueAt ? a : b
}

/**
 * Postup přihlášeného uživatele v aktivní organizaci pro přehled lekcí: dokončené a rozpracované
 * lekce (`lesson_progress`) a lekce přiřazené školitelem jeho skupinám. Stránka zůstává statická,
 * data se načtou až v prohlížeči.
 */
export function LessonProgressProvider({
  moduleSlug,
  children,
}: {
  moduleSlug: string
  children: ReactNode
}) {
  const { userId, orgId } = useRecordingMode()
  const [data, setData] = useState<{ key: string; progress: Progress } | null>(null)
  const key = userId && orgId ? `${userId}:${orgId}` : null

  useEffect(() => {
    if (!key || !userId || !orgId) return
    let alive = true
    const supabase = createClient()
    void (async () => {
      const [progress, groups] = await Promise.all([
        supabase
          .from('lesson_progress')
          .select('lesson_slug, finished_runs, best_score, last_started_at')
          .eq('user_id', userId)
          .eq('org_id', orgId)
          .eq('module_slug', moduleSlug),
        supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', userId)
          .eq('org_id', orgId)
          .eq('role', 'participant'),
      ])
      const groupIds = (groups.data ?? []).map((g) => g.group_id)
      const assigned = groupIds.length
        ? await supabase
            .from('assignments')
            .select('lesson_slug, due_at')
            .eq('module_slug', moduleSlug)
            .in('group_id', groupIds)
        : { data: [] as { lesson_slug: string; due_at: string | null }[] }
      if (!alive) return
      const lessons = new Map<string, LessonState>()
      for (const row of progress.data ?? []) {
        lessons.set(row.lesson_slug, {
          finishedRuns: row.finished_runs ?? 0,
          bestScore: row.best_score,
          started: !!row.last_started_at,
        })
      }
      const assignments = new Map<string, Assignment>()
      for (const row of assigned.data ?? []) {
        assignments.set(
          row.lesson_slug,
          earlier(assignments.get(row.lesson_slug), { dueAt: row.due_at }),
        )
      }
      setData({ key, progress: { lessons, assignments } })
    })().catch(() => {})
    return () => {
      alive = false
    }
  }, [key, userId, orgId, moduleSlug])

  const value = data && data.key === key ? data.progress : EMPTY
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

/** Stav lekce v přehledu (jen přihlášenému s organizací): hotovo, rozpracováno, přiřazeno. */
export function LessonStatus({ slug }: { slug: string }) {
  const t = useTranslations('progress')
  const format = useFormatter()
  const { lessons, assignments } = useContext(ProgressContext)
  const lesson = lessons.get(slug)
  const assignment = assignments.get(slug)
  const done = !!lesson && lesson.finishedRuns > 0
  if (!lesson && !assignment) return null
  return (
    <span className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
      {done ? (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-green-800"
          data-testid="lesson-status"
          data-state="done"
        >
          <CheckIcon className="h-3.5 w-3.5" />
          {lesson.bestScore === null
            ? t('done')
            : t('doneScore', { percent: Math.round(lesson.bestScore * 100) })}
        </span>
      ) : lesson?.started ? (
        <span
          className="rounded-full bg-blue-50 px-2 py-0.5 text-accent"
          data-testid="lesson-status"
          data-state="in-progress"
        >
          {t('inProgress')}
        </span>
      ) : null}
      {assignment ? (
        <span
          className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-900"
          data-testid="lesson-assigned"
        >
          {assignment.dueAt
            ? t('assignedDue', {
                date: format.dateTime(new Date(assignment.dueAt), {
                  dateStyle: 'medium',
                  timeZone: 'Europe/Prague',
                }),
              })
            : t('assigned')}
        </span>
      ) : null}
    </span>
  )
}
