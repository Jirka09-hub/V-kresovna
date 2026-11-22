/**
 * Supabase za rozhraním `ResultsDb` a načtení historie pokusů pro adaptivitu (D-029). Běží
 * v prohlížeči s klíčem pro veřejnost; co smí, hlídá RLS (vlastní průchody a pokusy v organizaci,
 * kde je uživatel členem a licence platí).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DIFFICULTIES,
  ERROR_CODES,
  EXERCISE_KINDS,
  type AttemptRecord,
} from '@vykresovna/exercises/adaptivity'
import type { Difficulty, ErrorCode, ExerciseKind } from '@vykresovna/exercises'
import type { Database, Json } from '@/lib/supabase/database.types'
import type { ResultsDb } from './recorder'

type Client = SupabaseClient<Database>

/** Pokus už je zapsaný (odpověď na první zápis se ztratila a zápis se opakoval). */
const UNIQUE_VIOLATION = '23505'

export function supabaseResultsDb(client: Client): ResultsDb {
  return {
    async createRun(row) {
      const { data, error } = await client.from('lesson_runs').insert(row).select('id').single()
      if (error) throw error
      return data.id
    },
    async insertAttempt(row) {
      const { error } = await client.from('attempts').insert({
        ...row,
        answer: row.answer as Json,
      })
      if (error && error.code !== UNIQUE_VIOLATION) throw error
    },
    async finishRun(runId) {
      const { data, error } = await client.rpc('finish_lesson_run', { p_run: runId })
      if (error) throw error
      return data
    },
  }
}

/** Kolik posledních pokusů z databáze vstupuje do adaptivního výběru. */
export const HISTORY_LIMIT = 60

type AttemptHistoryRow = {
  exercise_type: string
  difficulty: number
  is_correct: boolean
  error_codes: string[]
  focus: string | null
}

const isKind = (x: string): x is ExerciseKind => (EXERCISE_KINDS as readonly string[]).includes(x)
const isCode = (x: string): x is ErrorCode => (ERROR_CODES as readonly string[]).includes(x)
const isDifficulty = (x: number): x is Difficulty => (DIFFICULTIES as readonly number[]).includes(x)

/**
 * Řádky z databáze (nejnovější první) → historie pro adaptivitu (nejstarší první). Neznámé typy
 * a kódy (např. ze starší verze) se vynechají.
 */
export function toAttemptRecords(rows: readonly AttemptHistoryRow[]): AttemptRecord[] {
  return rows
    .filter((r) => isKind(r.exercise_type) && isDifficulty(r.difficulty))
    .map((r) => {
      const focus = r.focus && isCode(r.focus) ? r.focus : null
      return {
        kind: r.exercise_type as ExerciseKind,
        difficulty: r.difficulty as Difficulty,
        correct: r.is_correct,
        errorCodes: [...new Set(r.error_codes.filter(isCode))],
        ...(focus ? { focus } : {}),
      }
    })
    .reverse()
}

/** Posledních `HISTORY_LIMIT` pokusů uživatele v organizaci (pro adaptivní úlohy). */
export async function loadAttemptHistory(
  client: Client,
  userId: string,
  orgId: string,
): Promise<AttemptRecord[]> {
  const { data, error } = await client
    .from('attempts')
    .select('exercise_type, difficulty, is_correct, error_codes, focus')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  if (error) throw error
  return toAttemptRecords(data ?? [])
}
