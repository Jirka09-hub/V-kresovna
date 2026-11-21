/** Vyhodnocení odpovědi s kódy chyb (docs/plan.md, kapitola 5.1). */
import {
  FIRST_ANGLE_LAYOUT,
  THIRD_ANGLE_DEMO_ONLY,
  type GridPosition,
} from '@vykresovna/drafting-standards'
import { evaluateFindError } from './find-error'
import type {
  Answer,
  AssignViewsAnswer,
  AssignViewsTask,
  Task,
  TaskError,
  TaskResult,
} from './types'

const samePos = (a: GridPosition | null | undefined, b: GridPosition) =>
  !!a && a[0] === b[0] && a[1] === b[1]

function evaluateAssignViews(task: AssignViewsTask, answer: AssignViewsAnswer): TaskResult {
  const placed = task.cards.map((card) => ({ card, pos: answer.placement[card.id] ?? null }))
  const placedCards = placed.filter((p) => p.pos !== null)

  // celé rozmístění podle amerického promítání (aspoň dvě položené karty, všechny „zrcadlově“)
  const thirdAngle =
    placedCards.length >= 2 &&
    placedCards.every((p) => samePos(p.pos, THIRD_ANGLE_DEMO_ONLY[p.card.view]))

  // půdorys na místě bokorysu a bokorys na místě půdorysu
  const top = placed.find((p) => p.card.view === 'top')
  const left = placed.find((p) => p.card.view === 'left')
  const swapped =
    !!top &&
    !!left &&
    samePos(top.pos, FIRST_ANGLE_LAYOUT.left) &&
    samePos(left.pos, FIRST_ANGLE_LAYOUT.top)

  const errors: TaskError[] = []
  let ok = 0
  for (const { card, pos } of placed) {
    if (samePos(pos, FIRST_ANGLE_LAYOUT[card.view])) {
      ok++
      continue
    }
    let code: TaskError['code']
    if (pos === null) code = 'VIEW_MISSING'
    else if (thirdAngle) code = 'LAYOUT_THIRD_ANGLE'
    else if (swapped && (card.view === 'top' || card.view === 'left')) code = 'TOP_SIDE_SWAPPED'
    else code = 'VIEW_MISPLACED'
    errors.push({ code, cardId: card.id, view: card.view })
  }
  return { correct: errors.length === 0, score: ok / task.cards.length, errors }
}

/** Vyhodnotí odpověď. U výběru 1 ze 4 vrací kód chyby zvolené možnosti, prvek a pohled. */
export function evaluate(task: Task, answer: Answer): TaskResult {
  if (task.kind === 'assign-views') {
    if (answer.kind !== 'assign-views') throw new Error('odpověď neodpovídá typu úlohy')
    return evaluateAssignViews(task, answer)
  }
  if (task.kind === 'find-error') {
    if (answer.kind !== 'find-error') throw new Error('odpověď neodpovídá typu úlohy')
    return evaluateFindError(task, answer)
  }
  if (answer.kind !== task.kind) throw new Error('odpověď neodpovídá typu úlohy')
  const option = task.options.find((o) => o.id === answer.optionId)
  if (!option) throw new Error(`neznámá možnost ${answer.optionId}`)
  if (option.errorCode === null) return { correct: true, score: 1, errors: [] }
  const view =
    option.drawingMutation?.view ??
    option.view ??
    (task.kind === 'missing-view' ? task.missingView : undefined)
  const error: TaskError = {
    code: option.errorCode,
    ...(option.featureId ? { featureId: option.featureId } : {}),
    ...(view ? { view } : {}),
  }
  return { correct: false, score: 0, errors: [error] }
}
