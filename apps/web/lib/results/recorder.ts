/**
 * Ukládání výsledků lekce nebo závěrečného testu (D-029). Bez Reactu: průchod (`lesson_runs`) se
 * založí až s první odpovědí, každá úloha zapíše jeden pokus (`attempts`) a po poslední úloze se
 * průchod uzavře (`finish_lesson_run`). Zápisy jdou po sobě ve frontě; chyba ukládání nikdy
 * nezastaví cvičení, jen se oznámí stavem `error`.
 */
import type { Answer, Difficulty, ErrorCode, ExerciseKind, TaskResult } from '@vykresovna/exercises'

/** Výsledek jedné úlohy, jak ho hlásí `TaskSequence` (`result: null` = úloha přeskočena). */
export type OutcomeEvent = {
  readonly index: number
  readonly task: {
    readonly kind: ExerciseKind
    readonly seed: number
    readonly difficulty: Difficulty
    readonly focus?: ErrorCode
  }
  readonly result: TaskResult | null
  readonly answer: Answer | null
  readonly durationMs: number
}

export type RunInsert = {
  readonly org_id: string
  readonly module_slug: string
  readonly lesson_slug: string
  readonly task_count: number
  readonly engine_version: string
  readonly seed: number | null
}

export type AttemptInsert = {
  readonly run_id: string
  readonly org_id: string
  readonly module_slug: string
  readonly lesson_slug: string
  readonly task_index: number
  readonly exercise_type: ExerciseKind
  readonly difficulty: Difficulty
  readonly seed: number
  readonly engine_version: string
  readonly answer: unknown
  readonly is_correct: boolean
  readonly score: number
  readonly error_codes: string[]
  readonly duration_ms: number
  readonly focus: ErrorCode | null
}

/** Úzké rozhraní k databázi (v aplikaci Supabase, v testech náhrada). */
export interface ResultsDb {
  createRun(row: RunInsert): Promise<string>
  insertAttempt(row: AttemptInsert): Promise<void>
  finishRun(runId: string): Promise<number>
}

/** Nejvyšší délka uložené odpovědi v JSON (sloupec povoluje 4 kB). */
export const MAX_ANSWER_CHARS = 3500
/** Nejdelší doba úlohy, která se uloží (sloupec povoluje 24 h). */
const MAX_DURATION_MS = 86_400_000

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Odpověď do JSON: čísla zaokrouhlená na setiny (souřadnice kliknutí v mm), nic navíc. Kdyby
 * odpověď přesto byla moc dlouhá, uloží se jen značka (pokus i tak nese seed a výsledek).
 */
export function compactAnswer(answer: Answer | null): unknown {
  if (answer === null) return null
  const json = JSON.stringify(answer, (_key, value: unknown) =>
    typeof value === 'number' ? round2(value) : value,
  )
  if (json.length > MAX_ANSWER_CHARS) return { kind: answer.kind, truncated: true }
  return JSON.parse(json) as unknown
}

export type RunContext = {
  readonly orgId: string
  readonly moduleSlug: string
  readonly lessonSlug: string
  /** Počet úloh včetně adaptivních míst. */
  readonly taskCount: number
  /** Seed celé sady (závěrečný test), jinak null. */
  readonly seed: number | null
  readonly engineVersion: string
}

/** Řádek pokusu z výsledku úlohy. */
export function attemptRow(ctx: RunContext, runId: string, ev: OutcomeEvent): AttemptInsert {
  const r = ev.result
  return {
    run_id: runId,
    org_id: ctx.orgId,
    module_slug: ctx.moduleSlug,
    lesson_slug: ctx.lessonSlug,
    task_index: ev.index,
    exercise_type: ev.task.kind,
    difficulty: ev.task.difficulty,
    seed: ev.task.seed,
    engine_version: ctx.engineVersion,
    answer: r ? compactAnswer(ev.answer) : null,
    is_correct: r?.correct ?? false,
    score: r ? Math.min(1, Math.max(0, r.score)) : 0,
    error_codes: r ? [...new Set(r.errors.map((e) => e.code))] : [],
    duration_ms: Math.min(MAX_DURATION_MS, Math.max(0, Math.round(ev.durationMs))),
    focus: ev.task.focus ?? null,
  }
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'finished' | 'error'

export type RecorderState = {
  readonly status: SaveStatus
  readonly runId: string | null
  /** Počet správných odpovědí podle databáze (po uzavření průchodu). */
  readonly correctCount: number | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Jeden pokus o operaci a při chybě ještě jeden (výpadek sítě na chvíli). */
async function withRetry<T>(fn: () => Promise<T>, delayMs: number): Promise<T> {
  try {
    return await fn()
  } catch {
    await sleep(delayMs)
    return fn()
  }
}

/** Zapisovač jednoho průchodu (nová sada úloh = nový zapisovač). */
export class LessonRecorder {
  private chain: Promise<void> = Promise.resolve()
  private runId: string | null = null
  private failed = false
  private readonly reported = new Set<number>()

  constructor(
    private readonly db: ResultsDb,
    private readonly ctx: RunContext,
    private readonly onState: (s: RecorderState) => void = () => {},
    private readonly retryDelayMs = 800,
  ) {}

  /** Zařadí výsledek úlohy do fronty zápisů (každá úloha se počítá jen jednou). */
  record(ev: OutcomeEvent): Promise<void> {
    if (this.reported.has(ev.index) || ev.index < 0 || ev.index >= this.ctx.taskCount) {
      return this.chain
    }
    this.reported.add(ev.index)
    const complete = this.reported.size === this.ctx.taskCount
    this.chain = this.chain.then(() => this.write(ev, complete))
    return this.chain
  }

  /** Počká na dokončení všech zápisů (testy). */
  flush(): Promise<void> {
    return this.chain
  }

  private emit(status: SaveStatus, correctCount: number | null = null) {
    this.onState({ status, runId: this.runId, correctCount })
  }

  private async write(ev: OutcomeEvent, complete: boolean): Promise<void> {
    // po chybě už nezapisovat: průchod by stejně nešel uzavřít
    if (this.failed) return
    this.emit('saving')
    try {
      if (!this.runId) {
        const { orgId, moduleSlug, lessonSlug, taskCount, engineVersion, seed } = this.ctx
        this.runId = await withRetry(
          () =>
            this.db.createRun({
              org_id: orgId,
              module_slug: moduleSlug,
              lesson_slug: lessonSlug,
              task_count: taskCount,
              engine_version: engineVersion,
              seed,
            }),
          this.retryDelayMs,
        )
      }
      const row = attemptRow(this.ctx, this.runId, ev)
      await withRetry(() => this.db.insertAttempt(row), this.retryDelayMs)
      if (complete) {
        const runId = this.runId
        const correct = await withRetry(() => this.db.finishRun(runId), this.retryDelayMs)
        this.emit('finished', correct)
      } else {
        this.emit('saved')
      }
    } catch {
      this.failed = true
      this.emit('error')
    }
  }
}
