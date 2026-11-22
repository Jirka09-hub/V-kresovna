/**
 * Historie pokusů této relace (jen v paměti prohlížeče, nic se neukládá; účty přijdou ve fázi 4).
 * Slouží adaptivnímu výběru úloh v lekcích (D-023). Přežije přechod mezi stránkami, ne obnovení.
 */
import type { AttemptRecord } from '@vykresovna/exercises/adaptivity'
import type { Difficulty, ErrorCode, ExerciseKind, TaskResult } from '@vykresovna/exercises'

const MAX_ATTEMPTS = 200
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

/** Kopie historie (nejstarší první). */
export function sessionHistory(): readonly AttemptRecord[] {
  return [...attempts]
}
