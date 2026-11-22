'use client'

import type { ViewName } from '@vykresovna/drafting-standards'
import type {
  FindErrorAnswer,
  FindErrorTarget,
  FindErrorTask,
  TaskResult,
  ViewPlacement,
} from '@vykresovna/exercises'
import { useTranslations } from 'next-intl'
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { DrawingSvg } from '@/components/drawing/DrawingSvg'
import { Legend } from '@/components/drawing/Legend'
import { Model3D } from '@/components/three/Model3D'
import { btnPrimary, btnSecondary, focusRing, panel } from '@/components/ui'
import { evaluateAnswer, renderFindError } from '@/lib/engine/client'
import { featureEdgeIds, isRelated } from '@/lib/engine/highlight'
import { useAsync, useRenderParts } from '@/lib/engine/hooks'
import type { ExerciseProps } from './AssignViews'
import { Feedback } from './Feedback'
import {
  CELLS,
  cellArea,
  cellOf,
  cellRect,
  drawingToView,
  locateView,
  targetPoint,
  viewToDrawing,
  type Point,
} from './find-error-geometry'

/** Výběr uživatele před kontrolou. */
type Selection =
  | { readonly pick: 'point'; readonly view: ViewName; readonly point: Point }
  | { readonly pick: 'area'; readonly view: ViewName; readonly cell: readonly [number, number] }
  | { readonly pick: 'layout' }

const CELL_KEYS = [
  ['topLeft', 'top', 'topRight'],
  ['left', 'center', 'right'],
  ['bottomLeft', 'bottom', 'bottomRight'],
] as const

const pct = (n: number, of: number) => `${(n / of) * 100}%`

/** Cvičení 4: najdi chybu ve výkresu (klik do výkresu, oblast z klávesnice, nebo rozmístění). */
export function FindError({ task, onResult, onNext, nextLabel }: ExerciseProps<FindErrorTask>) {
  const t = useTranslations('exercises')
  const tf = useTranslations('exercises.findError')
  const td = useTranslations('drafting.view')
  const tc = useTranslations('common')
  const key = `${task.part.id}:${task.seed}:${task.difficulty}:${task.focus ?? ''}`
  const shown = useAsync(`fe:${key}`, () => renderFindError(task))
  const [result, setResult] = useState<TaskResult | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [busy, setBusy] = useState(false)
  const [showCorrect, setShowCorrect] = useState(false)
  const [outside, setOutside] = useState(false)
  const correctDrawing = useAsync(result && showCorrect ? `fe-ok:${key}` : null, () =>
    renderFindError(task, true),
  )
  const parts = useMemo(() => [task.part], [task.part])
  const model = useRenderParts(parts).data?.[0] ?? null

  const drawing = showCorrect && correctDrawing.data ? correctDrawing.data : shown.data
  const placements = drawing?.placements ?? []
  const placementOf = (v: ViewName) => placements.find((p) => p.view === v)
  const answered = result !== null

  const targetIds = useMemo(
    () => new Set(task.targets.flatMap((x) => (x.kind === 'lines' ? x.edgeIds : []))),
    [task.targets],
  )
  const highlighted3d = useMemo(() => {
    if (!result || !model) return undefined
    const ids = model.edges
      .filter((e) => [...targetIds].some((id) => e.id === id || isRelated(e.id, id)))
      .map((e) => e.id)
    if (ids.length === 0 && task.featureId) return featureEdgeIds(model.edges, task.featureId)
    return ids
  }, [result, model, targetIds, task.featureId])

  const choosePoint = (e: MouseEvent<HTMLDivElement>) => {
    // klávesnice (detail 0) vybírá oblast tlačítkem, tady jen myš a dotyk
    if (answered || e.detail === 0 || !shown.data) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * shown.data.width
    const y = ((e.clientY - rect.top) / rect.height) * shown.data.height
    const p = locateView(shown.data.placements ?? [], x, y, task.toleranceMm)
    if (!p) {
      setOutside(true)
      return
    }
    setOutside(false)
    setSelection({ pick: 'point', view: p.view, point: drawingToView(p, x, y) })
  }

  const check = async () => {
    if (!selection || busy || answered) return
    let answer: FindErrorAnswer
    if (selection.pick === 'layout') answer = { kind: 'find-error', pick: 'layout' }
    else if (selection.pick === 'point') answer = { kind: 'find-error', ...selection }
    else {
      const p = placementOf(selection.view)!
      answer = {
        kind: 'find-error',
        pick: 'area',
        view: selection.view,
        area: cellArea(p, selection.cell[0], selection.cell[1]),
      }
    }
    setBusy(true)
    try {
      const r = await evaluateAnswer(task, answer)
      setResult(r)
      onResult(r, answer)
    } finally {
      setBusy(false)
    }
  }

  const errorView = task.layoutError ? null : (task.targets[0]?.view ?? null)
  const where = errorView ? tf('whereView', { view: td(errorView) }) : tf('whereLayout')
  const selectionText = !selection
    ? tf('nothingSelected')
    : selection.pick === 'layout'
      ? tf('selectedLayout')
      : selection.pick === 'point'
        ? tf('selectedPoint', { view: td(selection.view) })
        : tf('selectedCell', {
            view: td(selection.view),
            cell: tf(`cell.${CELL_KEYS[selection.cell[0]]![selection.cell[1]]!}`),
          })

  // testovací atributy: kde je chyba (první místo)
  const firstTarget = task.targets[0]
  const firstPlacement = firstTarget ? placementOf(firstTarget.view) : undefined
  const testAttrs: Record<string, string> = { 'data-layout-error': String(task.layoutError) }
  if (firstTarget && firstPlacement && shown.data && !showCorrect) {
    const pt = targetPoint(firstTarget, firstPlacement)
    const [x, y] = viewToDrawing(firstPlacement, pt)
    const [row, col] = cellOf(firstPlacement, pt)
    testAttrs['data-target-view'] = firstTarget.view
    testAttrs['data-target-cell'] = `${row},${col}`
    testAttrs['data-target-x'] = (x / shown.data.width).toFixed(4)
    testAttrs['data-target-y'] = (y / shown.data.height).toFixed(4)
  }

  const chosenView = selection && selection.pick !== 'layout' ? selection.view : null

  return (
    <div className="flex flex-col gap-4">
      {shown.error ? (
        <p role="alert" className="text-red-700">
          {tc('error', { message: shown.error })}
        </p>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <section className="flex flex-col gap-2" aria-labelledby="fe-drawing">
          <h3 id="fe-drawing" className="text-sm font-semibold text-muted">
            {showCorrect ? tf('correctDrawing') : tf('drawing')}
          </h3>
          <div className={`p-2 ${panel}`}>
            {drawing ? (
              <div
                className={`relative mx-auto ${answered ? '' : 'cursor-crosshair'}`}
                style={{
                  aspectRatio: `${drawing.width} / ${drawing.height}`,
                  maxWidth: `min(100%, ${((62 * drawing.width) / drawing.height).toFixed(1)}vh)`,
                }}
                onClick={choosePoint}
                data-testid="find-error-drawing"
                data-showing={showCorrect ? 'correct' : 'task'}
                {...testAttrs}
              >
                <DrawingSvg
                  svg={drawing.svg}
                  label={showCorrect ? tf('correctDrawingLabel') : tf('drawingLabel')}
                  className="h-full w-full"
                />
                <Overlay
                  width={drawing.width}
                  height={drawing.height}
                  placements={placements}
                  targets={answered ? task.targets : []}
                  missing={task.mutation.kind === 'remove-edge'}
                  selection={showCorrect ? null : selection}
                  correct={result?.correct ?? null}
                  tolerance={task.toleranceMm}
                />
                {!answered
                  ? placements.map((p) => (
                      <ViewCells
                        key={p.view}
                        placement={p}
                        width={drawing.width}
                        height={drawing.height}
                        label={td(p.view)}
                        cellLabel={(r, c) =>
                          tf('cellLabel', {
                            view: td(p.view),
                            cell: tf(`cell.${CELL_KEYS[r]![c]!}`),
                          })
                        }
                        selected={
                          selection?.pick === 'area' && selection.view === p.view
                            ? selection.cell
                            : null
                        }
                        onSelect={(cell) => {
                          setOutside(false)
                          setSelection({ pick: 'area', view: p.view, cell })
                        }}
                      />
                    ))
                  : null}
              </div>
            ) : (
              <p role="status" className="py-16 text-center text-sm text-muted">
                {t('loading')}
              </p>
            )}
          </div>
          <Legend />
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="fe-model">
          <h3 id="fe-model" className="text-sm font-semibold text-muted">
            {tf('model')}
          </h3>
          <Model3D
            data={model}
            ariaLabel={tf('modelLabel')}
            highlightedEdgeIds={highlighted3d}
            // po odpovědi rentgen: i schovaná hrana, které se chyba týká, je vidět
            xray={answered}
            className="aspect-[4/3] w-full"
          />
          <p className="text-xs text-muted">{tf('modelHint')}</p>
        </section>
      </div>

      {!answered ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{tf('keyboardHint')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={btnSecondary}
              aria-pressed={selection?.pick === 'layout'}
              onClick={() => {
                setOutside(false)
                setSelection(selection?.pick === 'layout' ? null : { pick: 'layout' })
              }}
              data-testid="layout-wrong"
            >
              {tf('layoutWrong')}
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={!selection || busy}
              onClick={check}
              data-testid="check"
            >
              {busy ? t('checking') : t('check')}
            </button>
          </div>
          <p
            className="text-sm font-medium"
            role="status"
            aria-live="polite"
            data-testid="selection"
          >
            {outside ? tf('outside') : selectionText}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={btnSecondary}
            aria-pressed={showCorrect}
            onClick={() => setShowCorrect((s) => !s)}
            data-testid="toggle-correct"
          >
            {showCorrect ? tf('showTask') : tf('showCorrect')}
          </button>
        </div>
      )}

      <Feedback
        result={result}
        detail={
          result
            ? result.correct
              ? `${where} ${t(`errors.${task.errorCode}`)}`
              : chosenView && chosenView !== errorView
                ? `${tf('youChose', { view: td(chosenView) })} ${where}`
                : where
            : undefined
        }
        correctAnswer={<p className="text-sm">{tf('highlightHint')}</p>}
        onNext={onNext}
        nextLabel={nextLabel}
      />
    </div>
  )
}

/** Neviditelná tlačítka 3 × 3 nad pohledem: výběr oblasti z klávesnice (šipky, Enter). */
function ViewCells({
  placement: p,
  width,
  height,
  label,
  cellLabel,
  selected,
  onSelect,
}: {
  placement: ViewPlacement
  width: number
  height: number
  label: string
  cellLabel: (row: number, col: number) => string
  selected: readonly [number, number] | null
  onSelect: (cell: readonly [number, number]) => void
}) {
  const [active, setActive] = useState<readonly [number, number]>([1, 1])
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const move = (e: KeyboardEvent, row: number, col: number) => {
    const delta: Record<string, readonly [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }
    const d = delta[e.key]
    if (!d) return
    e.preventDefault()
    const r = Math.min(CELLS - 1, Math.max(0, row + d[0]))
    const c = Math.min(CELLS - 1, Math.max(0, col + d[1]))
    setActive([r, c])
    refs.current[r * CELLS + c]?.focus()
  }
  return (
    <div
      role="group"
      aria-label={label}
      className="absolute"
      style={{
        left: pct(p.origin[0], width),
        top: pct(p.origin[1], height),
        width: pct(p.size[0], width),
        height: pct(p.size[1], height),
      }}
      data-view={p.view}
    >
      {Array.from({ length: CELLS * CELLS }, (_, i) => {
        const row = Math.floor(i / CELLS)
        const col = i % CELLS
        const r = cellRect(p, row, col)
        const isSelected = selected?.[0] === row && selected[1] === col
        return (
          <button
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            tabIndex={active[0] === row && active[1] === col ? 0 : -1}
            aria-label={cellLabel(row, col)}
            aria-pressed={isSelected}
            className={`absolute cursor-crosshair rounded-sm focus-visible:bg-blue-500/10 ${focusRing} ${
              isSelected ? 'bg-blue-500/15 outline-2 outline-accent' : ''
            }`}
            style={{
              left: pct(r.x - p.origin[0], p.size[0]),
              top: pct(r.y - p.origin[1], p.size[1]),
              width: pct(r.width, p.size[0]),
              height: pct(r.height, p.size[1]),
            }}
            onFocus={() => setActive([row, col])}
            onKeyDown={(e) => move(e, row, col)}
            onClick={(e) => {
              // myš řeší přesný bod (rodič), tady jen klávesnice (Enter, mezerník)
              if (e.detail === 0) onSelect([row, col])
            }}
            data-testid="find-error-cell"
            data-view={p.view}
            data-cell={`${row},${col}`}
          />
        )
      })}
    </div>
  )
}

const TARGET = '#15803d'
/** Čárkování místa, kde hrana chybí. */
const MISSING_DASH = '1.5 1'
const HALO = '#22c55e'
/** Atributy čáry vrstvy (styly výkresu jsou omezené na jeho `<svg>`, vrstvu neovlivní). */
const stroke = (color: string, width: number) => ({
  stroke: color,
  strokeWidth: width,
  fill: 'none',
})

/** Vrstva nad výkresem: vybrané místo a po kontrole místo chyby (ne jen barvou: i tvarem). */
function Overlay({
  width,
  height,
  placements,
  targets,
  missing,
  selection,
  correct,
  tolerance,
}: {
  width: number
  height: number
  placements: readonly ViewPlacement[]
  targets: readonly FindErrorTarget[]
  missing: boolean
  selection: Selection | null
  correct: boolean | null
  tolerance: number
}) {
  const placementOf = (v: ViewName) => placements.find((p) => p.view === v)
  const marker = correct === null ? '#1d4ed8' : correct ? '#15803d' : '#b91c1c'
  let selected: ReactNode = null
  if (selection?.pick === 'point') {
    const p = placementOf(selection.view)
    if (p) {
      const [x, y] = viewToDrawing(p, selection.point)
      const r = Math.max(1.5, tolerance * 0.6)
      selected = (
        <g data-testid="marker">
          <circle cx={x} cy={y} r={r} {...stroke(marker, 0.6)} />
          <path
            d={`M${x - r * 1.6} ${y}H${x + r * 1.6}M${x} ${y - r * 1.6}V${y + r * 1.6}`}
            {...stroke(marker, 0.6)}
          />
        </g>
      )
    }
  } else if (selection?.pick === 'area') {
    const p = placementOf(selection.view)
    if (p) {
      const r = cellRect(p, selection.cell[0], selection.cell[1])
      selected = <rect {...r} {...stroke(marker, 0.6)} strokeDasharray="2 1" data-testid="marker" />
    }
  }
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {targets.map((target, i) => {
        const p = placementOf(target.view)
        if (!p) return null
        if (target.kind === 'view') {
          return (
            <rect
              key={i}
              x={p.origin[0] - 3}
              y={p.origin[1] - 3}
              width={p.size[0] + 6}
              height={p.size[1] + 6}
              rx={2}
              {...stroke(TARGET, 0.8)}
              fill={TARGET}
              fillOpacity={0.08}
              data-testid="target-highlight"
            />
          )
        }
        return (
          <g key={i} data-testid="target-highlight">
            {target.segments.map((s, j) => {
              const a = viewToDrawing(p, s.a)
              const b = viewToDrawing(p, s.b)
              const d = `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`
              return (
                <g key={j}>
                  <path d={d} {...stroke(HALO, 3.2)} strokeOpacity={0.45} strokeLinecap="round" />
                  <path
                    d={d}
                    {...stroke(TARGET, 0.5)}
                    {...(missing ? { strokeDasharray: MISSING_DASH } : {})}
                  />
                </g>
              )
            })}
          </g>
        )
      })}
      {selected}
    </svg>
  )
}
