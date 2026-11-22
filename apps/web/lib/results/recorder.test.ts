import type { TaskResult } from '@vykresovna/exercises'
import { describe, expect, it } from 'vitest'
import { toAttemptRecords } from './db'
import {
  compactAnswer,
  LessonRecorder,
  MAX_ANSWER_CHARS,
  type AttemptInsert,
  type OutcomeEvent,
  type RecorderState,
  type ResultsDb,
  type RunContext,
  type RunInsert,
} from './recorder'

const ctx: RunContext = {
  orgId: 'org-1',
  moduleSlug: 'pohledy-a-rezy',
  lessonSlug: 'diry-a-osy',
  taskCount: 3,
  seed: null,
  engineVersion: '0.4.0',
}

const ok: TaskResult = { correct: true, score: 1, errors: [] }
const wrong: TaskResult = {
  correct: false,
  score: 0.5,
  errors: [{ code: 'TOP_SIDE_SWAPPED' }, { code: 'TOP_SIDE_SWAPPED', view: 'top' }],
}

function event(index: number, result: TaskResult | null, extra: Partial<OutcomeEvent> = {}) {
  return {
    index,
    task: { kind: 'assign-views', seed: 100 + index, difficulty: 2 },
    result,
    answer: result ? { kind: 'missing-view', optionId: 'b' } : null,
    durationMs: 1234.6,
    ...extra,
  } as OutcomeEvent
}

/** Databáze v paměti; `failures` = kolikrát má ještě selhat daná operace. */
function fakeDb(failures: Partial<Record<keyof ResultsDb, number>> = {}) {
  const runs: RunInsert[] = []
  const attempts: AttemptInsert[] = []
  const finished: string[] = []
  const left = { ...failures }
  const maybeFail = (op: keyof ResultsDb) => {
    if ((left[op] ?? 0) > 0) {
      left[op]!--
      throw new Error(`${op} selhalo`)
    }
  }
  const db: ResultsDb = {
    async createRun(row) {
      maybeFail('createRun')
      runs.push(row)
      return `run-${runs.length}`
    },
    async insertAttempt(row) {
      maybeFail('insertAttempt')
      attempts.push(row)
    },
    async finishRun(runId) {
      maybeFail('finishRun')
      finished.push(runId)
      return attempts.filter((a) => a.run_id === runId && a.is_correct).length
    },
  }
  return { db, runs, attempts, finished }
}

describe('LessonRecorder', () => {
  it('založí průchod s první odpovědí, zapíše pokusy a po poslední úloze průchod uzavře', async () => {
    const { db, runs, attempts, finished } = fakeDb()
    const states: RecorderState[] = []
    const rec = new LessonRecorder(db, ctx, (s) => states.push(s), 0)
    rec.record(event(0, ok))
    rec.record(event(0, wrong)) // stejná úloha podruhé se nepočítá
    rec.record(event(1, null)) // přeskočená
    await rec.record(
      event(2, wrong, {
        task: { kind: 'find-error', seed: 7, difficulty: 3, focus: 'TOP_SIDE_SWAPPED' },
      }),
    )

    expect(runs).toEqual([
      {
        org_id: 'org-1',
        module_slug: 'pohledy-a-rezy',
        lesson_slug: 'diry-a-osy',
        task_count: 3,
        engine_version: '0.4.0',
        seed: null,
      },
    ])
    expect(attempts.map((a) => a.task_index)).toEqual([0, 1, 2])
    expect(attempts[0]).toMatchObject({
      run_id: 'run-1',
      exercise_type: 'assign-views',
      seed: 100,
      difficulty: 2,
      is_correct: true,
      score: 1,
      error_codes: [],
      duration_ms: 1235,
      answer: { kind: 'missing-view', optionId: 'b' },
      focus: null,
    })
    expect(attempts[1]).toMatchObject({
      answer: null,
      is_correct: false,
      score: 0,
      error_codes: [],
    })
    expect(attempts[2]).toMatchObject({
      exercise_type: 'find-error',
      error_codes: ['TOP_SIDE_SWAPPED'],
      score: 0.5,
      focus: 'TOP_SIDE_SWAPPED',
    })
    expect(finished).toEqual(['run-1'])
    expect(states.at(-1)).toEqual({ status: 'finished', runId: 'run-1', correctCount: 1 })
  })

  it('krátký výpadek zopakuje, trvalou chybu oznámí a dál nezapisuje', async () => {
    const once = fakeDb({ insertAttempt: 1 })
    const rec1 = new LessonRecorder(once.db, { ...ctx, taskCount: 1 }, () => {}, 0)
    await rec1.record(event(0, ok))
    expect(once.attempts).toHaveLength(1)
    expect(once.finished).toEqual(['run-1'])

    const broken = fakeDb({ createRun: 5 })
    const states: RecorderState[] = []
    const rec2 = new LessonRecorder(broken.db, ctx, (s) => states.push(s), 0)
    rec2.record(event(0, ok))
    await rec2.record(event(1, ok))
    expect(broken.attempts).toHaveLength(0)
    expect(states.at(-1)?.status).toBe('error')
  })

  it('závěrečný test uloží seed sady', async () => {
    const { db, runs } = fakeDb()
    const rec = new LessonRecorder(db, { ...ctx, taskCount: 1, seed: 424242 }, () => {}, 0)
    await rec.record(event(0, ok))
    expect(runs[0]!.seed).toBe(424242)
  })
})

describe('compactAnswer', () => {
  it('zaokrouhlí čísla na setiny', () => {
    expect(
      compactAnswer({
        kind: 'find-error',
        pick: 'point',
        view: 'front',
        point: [12.34567, -3.001],
      }),
    ).toEqual({ kind: 'find-error', pick: 'point', view: 'front', point: [12.35, -3] })
  })

  it('příliš dlouhou odpověď nahradí značkou', () => {
    const placement = Object.fromEntries(
      Array.from({ length: 400 }, (_, i) => [`karta-${i}`, [i, i] as [number, number]]),
    )
    const answer = compactAnswer({ kind: 'assign-views', placement })
    expect(answer).toEqual({ kind: 'assign-views', truncated: true })
    expect(JSON.stringify(answer).length).toBeLessThan(MAX_ANSWER_CHARS)
  })
})

describe('toAttemptRecords', () => {
  it('obrátí pořadí na nejstarší první a vynechá neznámé typy a kódy', () => {
    const records = toAttemptRecords([
      {
        exercise_type: 'find-error',
        difficulty: 3,
        is_correct: false,
        error_codes: ['MISSED_ERROR', 'NEZNAMY'],
        focus: 'TOP_SIDE_SWAPPED',
      },
      { exercise_type: 'stary-typ', difficulty: 2, is_correct: true, error_codes: [], focus: null },
      { exercise_type: 'section', difficulty: 2, is_correct: true, error_codes: [], focus: null },
    ])
    expect(records).toEqual([
      { kind: 'section', difficulty: 2, correct: true, errorCodes: [] },
      {
        kind: 'find-error',
        difficulty: 3,
        correct: false,
        errorCodes: ['MISSED_ERROR'],
        focus: 'TOP_SIDE_SWAPPED',
      },
    ])
  })
})
