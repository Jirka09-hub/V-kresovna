/**
 * Historie pokusů pro adaptivní výběr úloh v lekcích (D-023, D-029). Žije v paměti prohlížeče:
 * přežije přechod mezi stránkami, ne obnovení. Přihlášenému uživateli se na začátku doplní
 * posledními pokusy z databáze (`setBaseHistory`), takže adaptivita navazuje na minulé dny.
 */
import type { AttemptRecord } from '@vykresovna/exercises/adaptivity'
import type { Difficulty, ErrorCode, ExerciseKind, TaskResult } from '@vykresovna/exercises'

const MAX_ATTEMPTS = 200
/** Pokusy z databáze (nejstarší první). */
let base: readonly AttemptRecord[] = []
/** Klíč (uživatel a organizace), ke kterému patří `base`; null = nikdo přihlášený. */
let baseKey: string | null = null
/** Pokusy této relace (nejstarší první). */
const attempts: AttemptRecord[] = []

export function recordAttempt(
  task: { kind: ExerciseKind; difficulty: Difficulty; focus?: ErrorCode },
  result: TaskResult,
): void {
  attempts.push({
    kind: task.kind,
    difficulty: task.difficulty,
    correct: result.correct,
    errorCodes: [...new Set(result.errors.map((e) => e.code))],
    ...(task.focus ? { focus: task.focus } : {}),
  })
  if (attempts.length > MAX_ATTEMPTS) attempts.splice(0, attempts.length - MAX_ATTEMPTS)
}

/** Kopie historie (nejstarší první): pokusy z databáze, pak pokusy této relace. */
export function sessionHistory(): readonly AttemptRecord[] {
  return [...base, ...attempts].slice(-MAX_ATTEMPTS)
}

/**
 * Začátek historie jiného uživatele nebo organizace: pokusy této relace se zahodí (buď už jsou
 * v databázi, nebo patří někomu jinému) a základem jsou zatím prázdná data. `records` přijdou až
 * z databáze (`setBaseHistory`). Vrací false, když se klíč nezměnil (není co načítat).
 */
export function startHistory(key: string | null): boolean {
  if (key === baseKey) return false
  baseKey = key
  base = []
  attempts.length = 0
  return true
}

/** Pokusy z databáze pro aktuální klíč (když se mezitím klíč nezměnil). */
export function setBaseHistory(key: string, records: readonly AttemptRecord[]): void {
  if (key !== baseKey) return
  base = records.slice(-MAX_ATTEMPTS)
}
