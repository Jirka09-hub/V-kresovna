'use client'

import { ENGINE_VERSION } from '@vykresovna/engine/version'
import { useCallback, useEffect, useRef, useState } from 'react'
import { activeClientMembership, useViewer } from '@/components/auth/ViewerContext'
import { licenseActive } from '@/lib/auth/license'
import { createClient } from '@/lib/supabase/client'
import { setBaseHistory, startHistory } from '@/lib/session-history'
import { loadAttemptHistory, supabaseResultsDb } from './db'
import { LessonRecorder, type OutcomeEvent, type RecorderState } from './recorder'

/**
 * Ukládají se výsledky? `loading` = ještě nevíme, kdo je přihlášený; `anonymous` = nepřihlášený;
 * `no-org` = bez organizace; `expired` = licence vypršela; `active` = ukládá se.
 */
export type RecordingMode = 'loading' | 'anonymous' | 'no-org' | 'expired' | 'active'

export function useRecordingMode(): {
  mode: RecordingMode
  userId: string | null
  orgId: string | null
  orgName: string | null
} {
  const { status, viewer } = useViewer()
  const m = activeClientMembership(viewer)
  const mode: RecordingMode =
    status === 'loading'
      ? 'loading'
      : !viewer
        ? 'anonymous'
        : !m
          ? 'no-org'
          : !licenseActive(m.licenseValidUntil)
            ? 'expired'
            : 'active'
  return {
    mode,
    userId: viewer?.userId ?? null,
    orgId: m?.orgId ?? null,
    orgName: m?.orgName ?? null,
  }
}

type Options = {
  readonly moduleSlug: string
  readonly lessonSlug: string
  readonly taskCount: number
  /** Seed celé sady (závěrečný test). */
  readonly seed?: number | null
  /** Pořadí sady: nová sada (opakování lekce, nový test) = nový průchod. */
  readonly round: number
}

const IDLE: RecorderState = { status: 'idle', runId: null, correctCount: null }

/**
 * Ukládání výsledků jedné lekce: vrací `onOutcome` pro `TaskSequence` a stav ukládání. Mimo režim
 * `active` nedělá nic. Sada, jejíž první úloha proběhla ještě bez přihlášení, se neukládá vůbec
 * (průchod by nebyl úplný).
 */
export function useLessonRecorder({
  moduleSlug,
  lessonSlug,
  taskCount,
  seed = null,
  round,
}: Options) {
  const { mode, orgId } = useRecordingMode()
  const [state, setState] = useState<{ round: number; value: RecorderState }>({
    round,
    value: IDLE,
  })
  const current = useRef<{ round: number; recorder: LessonRecorder | null } | null>(null)

  const onOutcome = useCallback(
    (ev: OutcomeEvent) => {
      if (!current.current || current.current.round !== round) {
        // první výsledek nové sady rozhodne, jestli se sada ukládá
        let recorder: LessonRecorder | null = null
        if (mode === 'active' && orgId && ev.index === 0) {
          recorder = new LessonRecorder(
            supabaseResultsDb(createClient()),
            { orgId, moduleSlug, lessonSlug, taskCount, seed, engineVersion: ENGINE_VERSION },
            (value) => {
              if (current.current?.recorder === recorder) setState({ round, value })
            },
          )
        }
        current.current = { round, recorder }
      }
      void current.current.recorder?.record(ev)
    },
    [mode, orgId, moduleSlug, lessonSlug, taskCount, seed, round],
  )

  return { mode, save: state.round === round ? state.value : IDLE, onOutcome }
}

/**
 * Přihlášenému uživateli doplní historii pro adaptivitu posledními pokusy z databáze (jednou za
 * uživatele a organizaci). Chyba načtení nevadí: adaptivita pak vychází jen z této relace.
 */
export function useAttemptHistory(): void {
  const { mode, userId, orgId } = useRecordingMode()
  useEffect(() => {
    if (mode === 'loading') return
    const key = userId && orgId ? `${userId}:${orgId}` : null
    // jednou za uživatele a organizaci; výsledek se zahodí, když se mezitím klíč změní
    if (!startHistory(key) || !key || !userId || !orgId) return
    loadAttemptHistory(createClient(), userId, orgId)
      .then((records) => setBaseHistory(key, records))
      .catch(() => {})
  }, [mode, userId, orgId])
}
