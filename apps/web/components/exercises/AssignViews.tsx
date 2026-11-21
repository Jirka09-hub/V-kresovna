'use client'

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  FIRST_ANGLE_LAYOUT,
  type GridPosition,
  type ViewName,
} from '@vykresovna/drafting-standards'
import type { AssignViewsTask, TaskResult } from '@vykresovna/exercises'
import { useTranslations } from 'next-intl'
import { useMemo, useState, type CSSProperties } from 'react'
import { cellFor, ScaledView, type Cell } from '@/components/drawing/ScaledView'
import { Model3D } from '@/components/three/Model3D'
import { btnPrimary, btnSecondary, focusRing, panel } from '@/components/ui'
import { evaluateAnswer } from '@/lib/engine/client'
import { useRenderParts, useViewsSvgs } from '@/lib/engine/hooks'
import type { ViewsSvg } from '@/lib/engine/protocol'
import { Feedback } from './Feedback'
import {
  gridArea,
  gridBounds,
  gridMaxWidth,
  gridSize,
  positionKey,
  positionTerm,
  samePosition,
  type GridBounds,
} from './grid'
import { CheckIcon, CrossIcon } from './icons'

type Placement = Record<string, GridPosition | null>
type Card = AssignViewsTask['cards'][number]

const TRAY = 'tray'
const slotId = (p: GridPosition) => `slot:${positionKey(p)}`
const FRONT: GridPosition = [0, 0]
/** Kolik výšky okna smí zabrat mřížka pohledů (zbytek je pro karty a ovládání). */
const GRID_HEIGHT_VH = 44

export type ExerciseProps<T> = {
  task: T
  onResult: (result: TaskResult) => void
  onNext: () => void
  nextLabel: string
}

/** Cvičení 1: přiřaď pohledy na místa kolem nárysu (evropské promítání). */
export function AssignViews({ task, onResult, onNext, nextLabel }: ExerciseProps<AssignViewsTask>) {
  const t = useTranslations('exercises')
  const ta = useTranslations('exercises.assign')
  const td = useTranslations('drafting.view')
  const tc = useTranslations('common')

  const [placement, setPlacement] = useState<Placement>(() =>
    Object.fromEntries(task.cards.map((c) => [c.id, null])),
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [result, setResult] = useState<TaskResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const requests = useMemo(
    () => [
      { part: task.part, views: ['front'] as const },
      ...task.cards.map((c) => ({ part: task.part, views: [c.view] })),
    ],
    [task],
  )
  const svgs = useViewsSvgs(requests)
  const model = useRenderParts(useMemo(() => [task.part], [task.part]))

  const drawings = useMemo(() => {
    if (!svgs.data) return null
    const [front, ...cards] = svgs.data
    const byCard = new Map(task.cards.map((c, i) => [c.id, cards[i]!]))
    return { front: front!, byCard, cell: cellFor(svgs.data) }
  }, [svgs.data, task.cards])

  const bounds = useMemo(() => gridBounds([FRONT, ...task.slots]), [task.slots])
  const size = gridSize(bounds)
  const cardNumber = (id: string) => task.cards.findIndex((c) => c.id === id) + 1
  const occupant = (p: GridPosition) =>
    task.cards.find((c) => samePosition(placement[c.id], p)) ?? null
  const answered = result !== null
  const allPlaced = task.cards.every((c) => placement[c.id])
  const isCorrect = (c: Card) => samePosition(placement[c.id], FIRST_ANGLE_LAYOUT[c.view])
  const posText = (p: GridPosition) =>
    ta(`position.${positionTerm(p)}`, { col: p[0], row: p[1] })

  /** Položí kartu na místo (nebo zpět mezi karty). Obsazené místo: karty se prohodí. */
  const place = (cardId: string, target: GridPosition | null) => {
    if (answered) return
    setPlacement((prev) => {
      const next = { ...prev }
      const from = prev[cardId] ?? null
      if (target) {
        const other = task.cards.find(
          (c) => c.id !== cardId && samePosition(prev[c.id], target),
        )
        if (other) next[other.id] = from
      }
      next[cardId] = target
      return next
    })
    setSelected(null)
    setAnnouncement(
      target
        ? ta('placed', { n: cardNumber(cardId), position: posText(target) })
        : ta('returned', { n: cardNumber(cardId) }),
    )
  }

  /** Klávesnice i klepnutí: první volba vybere kartu, druhá ji položí na místo jiné karty. */
  const pressCard = (cardId: string) => {
    if (answered) return
    if (selected && selected !== cardId) {
      const target = placement[cardId] ?? null
      if (target) return place(selected, target)
    }
    const next = selected === cardId ? null : cardId
    setSelected(next)
    setAnnouncement(next ? ta('selected', { n: cardNumber(next) }) : '')
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const over = e.over?.id
    if (!over) return
    const cardId = String(e.active.id)
    if (over === TRAY) return place(cardId, null)
    const pos = task.slots.find((s) => slotId(s) === over)
    if (pos) place(cardId, pos)
  }

  const check = async () => {
    setChecking(true)
    try {
      const r = await evaluateAnswer(task, { kind: 'assign-views', placement })
      setResult(r)
      onResult(r)
    } finally {
      setChecking(false)
    }
  }

  const okCount = task.cards.filter(isCorrect).length
  const trayCards = task.cards.filter((c) => !placement[c.id])
  const cellAspect = drawings ? drawings.cell.width / drawings.cell.height : 1.5
  const columns: CSSProperties = { gridTemplateColumns: `repeat(${size.cols}, minmax(0, 1fr))` }

  const renderCard = (card: Card, inTray: boolean) => (
    <CardButton
      key={card.id}
      card={card}
      n={cardNumber(card.id)}
      drawing={drawings?.byCard.get(card.id) ?? null}
      cell={drawings?.cell ?? null}
      selected={selected === card.id}
      disabled={answered}
      status={answered ? (isCorrect(card) ? 'ok' : 'wrong') : null}
      viewLabel={td(card.view)}
      inTray={inTray}
      onPress={() => pressCard(card.id)}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="flex flex-col gap-2" aria-labelledby="assign-model">
          <h3 id="assign-model" className="text-sm font-semibold text-muted">
            {ta('model')}
          </h3>
          <Model3D
            data={model.data?.[0] ?? null}
            ariaLabel={ta('modelLabel')}
            className="aspect-[4/3] w-full"
          />
          <p className="text-xs text-muted">{ta('keyboardHint')}</p>
        </section>

        <DndContext
          sensors={sensors}
          onDragStart={(e) => {
            setDragging(String(e.active.id))
            setSelected(null)
          }}
          onDragCancel={() => setDragging(null)}
          onDragEnd={onDragEnd}
          accessibility={{
            screenReaderInstructions: { draggable: ta('keyboardHint') },
            announcements: {
              onDragStart: ({ active }) => ta('selected', { n: cardNumber(String(active.id)) }),
              onDragOver: () => undefined,
              onDragEnd: () => undefined,
              onDragCancel: () => undefined,
            },
          }}
        >
          <section
            className="flex w-full flex-col gap-3 justify-self-center"
            style={{ maxWidth: gridMaxWidth(size.cols, size.rows, cellAspect, GRID_HEIGHT_VH) }}
            aria-labelledby="assign-grid"
          >
            <h3 id="assign-grid" className="text-sm font-semibold text-muted">
              {ta('grid')}
            </h3>
            {svgs.error ? (
              <p role="alert" className="text-red-700">
                {tc('error', { message: svgs.error })}
              </p>
            ) : null}
            <div
              role="group"
              aria-label={ta('gridLabel')}
              className={`grid gap-2 p-2 ${panel}`}
              style={columns}
              data-testid="view-grid"
            >
              <div
                style={gridArea(bounds, FRONT)}
                className="relative flex flex-col rounded-md border border-slate-300 bg-white"
              >
                <span className="absolute top-1 left-1.5 text-xs font-semibold text-muted">
                  {ta('front')} ({ta('fixed')})
                </span>
                {drawings ? (
                  <ScaledView drawing={drawings.front} cell={drawings.cell} label={td('front')} />
                ) : (
                  <div style={{ aspectRatio: cellAspect }} />
                )}
              </div>
              {task.slots.map((pos) => (
                <Slot
                  key={positionKey(pos)}
                  pos={pos}
                  bounds={bounds}
                  aspect={cellAspect}
                  label={posText(pos)}
                  occupant={occupant(pos)}
                  canPlace={!answered && selected !== null}
                  disabled={answered}
                  onPlace={() => selected && place(selected, pos)}
                  renderCard={(c) => renderCard(c, false)}
                />
              ))}
            </div>

            <Tray
              label={ta('tray')}
              empty={trayCards.length === 0}
              emptyText={ta('trayEmpty')}
              style={columns}
              returnButton={
                !answered && selected && placement[selected] ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => place(selected, null)}
                  >
                    {ta('returnToTray')}
                  </button>
                ) : null
              }
            >
              {trayCards.map((c) => renderCard(c, true))}
            </Tray>
          </section>
          <DragOverlay>
            {dragging && drawings ? (
              <div className="rounded-md border-2 border-accent bg-white shadow-lg">
                <ScaledView
                  drawing={drawings.byCard.get(dragging)!}
                  cell={drawings.cell}
                  label={ta('card', { n: cardNumber(dragging) })}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {!answered ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={btnPrimary}
            disabled={!allPlaced || checking}
            onClick={check}
            data-testid="check"
          >
            {checking ? t('checking') : t('check')}
          </button>
          {!allPlaced ? <span className="text-sm text-muted">{ta('placeAll')}</span> : null}
        </div>
      ) : null}

      <Feedback
        result={result}
        detail={
          result && !result.correct
            ? t('result.partial', { ok: okCount, total: task.cards.length })
            : undefined
        }
        correctAnswer={
          drawings ? (
            <SolutionGrid
              cards={task.cards}
              front={drawings.front}
              byCard={drawings.byCard}
              cell={drawings.cell}
              viewLabel={(v) => td(v)}
              label={ta('correctLayout')}
            />
          ) : null
        }
        onNext={onNext}
        nextLabel={nextLabel}
      />
    </div>
  )
}

function CardButton({
  card,
  n,
  drawing,
  cell,
  selected,
  disabled,
  status,
  viewLabel,
  inTray,
  onPress,
}: {
  card: Card
  n: number
  drawing: ViewsSvg | null
  cell: Cell | null
  selected: boolean
  disabled: boolean
  status: 'ok' | 'wrong' | null
  viewLabel: string
  inTray: boolean
  onPress: () => void
}) {
  const ta = useTranslations('exercises.assign')
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: card.id, disabled })
  const label = status
    ? `${ta('cardResult', { n, view: viewLabel })}, ${status === 'ok' ? ta('correctCard') : ta('wrongCard')}`
    : selected
      ? ta('cardSelected', { n })
      : ta('cardLabel', { n })
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      onClick={onPress}
      aria-pressed={status ? undefined : selected}
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-testid="card"
      data-card-id={card.id}
      data-view={card.view}
      data-in-tray={inTray || undefined}
      className={`relative flex w-full touch-none flex-col rounded-md border-2 bg-white text-left ${focusRing} ${
        selected
          ? 'border-accent ring-2 ring-accent ring-offset-1'
          : status === 'ok'
            ? 'border-green-700'
            : status === 'wrong'
              ? 'border-red-700'
              : 'border-slate-300 hover:border-slate-500'
      } ${isDragging ? 'opacity-30' : ''} ${disabled ? 'cursor-default' : 'cursor-grab'}`}
    >
      <span className="absolute top-1 left-1.5 z-10 flex items-center gap-1 text-xs font-semibold text-muted">
        {status === 'ok' ? <CheckIcon className="h-4 w-4 text-green-700" /> : null}
        {status === 'wrong' ? <CrossIcon className="h-4 w-4 text-red-700" /> : null}
        {status ? viewLabel : ta('card', { n })}
      </span>
      {drawing && cell ? (
        <ScaledView drawing={drawing} cell={cell} label={ta('card', { n })} />
      ) : (
        <div className="w-full" style={{ aspectRatio: 1.5 }} />
      )}
      {status === 'wrong' ? (
        <span className="absolute right-1.5 bottom-1 text-xs font-semibold text-red-800">
          {ta('wrongCard')}
        </span>
      ) : null}
    </button>
  )
}

function Slot({
  pos,
  bounds,
  aspect,
  label,
  occupant,
  canPlace,
  disabled,
  onPlace,
  renderCard,
}: {
  pos: GridPosition
  bounds: GridBounds
  aspect: number
  label: string
  occupant: Card | null
  canPlace: boolean
  disabled: boolean
  onPlace: () => void
  renderCard: (c: Card) => React.ReactNode
}) {
  const ta = useTranslations('exercises.assign')
  const { setNodeRef, isOver } = useDroppable({ id: slotId(pos), disabled })
  return (
    <div
      ref={setNodeRef}
      style={gridArea(bounds, pos)}
      data-testid="slot"
      data-slot={positionKey(pos)}
      className={`rounded-md ${isOver ? 'bg-blue-50 ring-2 ring-accent' : ''}`}
    >
      {occupant ? (
        renderCard(occupant)
      ) : (
        <button
          type="button"
          onClick={onPlace}
          disabled={disabled}
          aria-label={ta('slot', { position: label })}
          data-slot-button={positionKey(pos)}
          className={`flex w-full items-center justify-center rounded-md border-2 border-dashed p-1 text-center text-xs text-muted ${focusRing} ${
            canPlace ? 'border-accent bg-blue-50/60 text-accent' : 'border-slate-300'
          }`}
          style={{ aspectRatio: aspect }}
        >
          {label}
        </button>
      )}
    </div>
  )
}

function Tray({
  label,
  empty,
  emptyText,
  style,
  returnButton,
  children,
}: {
  label: string
  empty: boolean
  emptyText: string
  style: CSSProperties
  returnButton: React.ReactNode
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY })
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={label}
      data-testid="tray"
      className={`flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-100 p-2 ${isOver ? 'ring-2 ring-accent' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted">{label}</span>
        {returnButton}
      </div>
      {empty ? (
        <p className="flex items-center justify-center text-xs text-muted" style={{ minHeight: 40 }}>
          {emptyText}
        </p>
      ) : (
        <div className="grid gap-2" style={style}>
          {children}
        </div>
      )}
    </div>
  )
}

/** Malá mřížka se správným rozmístěním a názvy pohledů (zobrazí se při chybě). */
function SolutionGrid({
  cards,
  front,
  byCard,
  cell,
  viewLabel,
  label,
}: {
  cards: readonly Card[]
  front: ViewsSvg
  byCard: Map<string, ViewsSvg>
  cell: Cell
  viewLabel: (v: ViewName) => string
  label: string
}) {
  const items: { view: ViewName; drawing: ViewsSvg }[] = [
    { view: 'front', drawing: front },
    ...cards.map((c) => ({ view: c.view, drawing: byCard.get(c.id)! })),
  ]
  const bounds = gridBounds(items.map((i) => FIRST_ANGLE_LAYOUT[i.view]))
  const size = gridSize(bounds)
  return (
    <div
      role="group"
      aria-label={label}
      data-testid="solution"
      className={`grid max-w-md gap-1 p-1 ${panel}`}
      style={{ gridTemplateColumns: `repeat(${size.cols}, minmax(0, 1fr))` }}
    >
      {items.map((i) => (
        <div key={i.view} style={gridArea(bounds, FIRST_ANGLE_LAYOUT[i.view])} className="relative">
          <span className="absolute top-0.5 left-1 text-[11px] font-semibold text-muted">
            {viewLabel(i.view)}
          </span>
          <ScaledView drawing={i.drawing} cell={cell} label={viewLabel(i.view)} />
        </div>
      ))}
    </div>
  )
}
