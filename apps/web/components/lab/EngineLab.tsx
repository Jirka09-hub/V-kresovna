'use client'

import type { PartRenderData, PartSpec } from '@vykresovna/engine'
import { PartViewer, UNFOLD_STEPS, type PartViewerHandle } from '@vykresovna/viewer'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { renderPart } from '@/lib/engine/client'
import { isRelated } from '@/lib/engine/highlight'
import { DrawingPanel } from './DrawingPanel'
import { hasWebGL, WebGLBoundary } from './WebGLBoundary'

const UNFOLD_DURATION_MS = 7000

export function EngineLab({ parts }: { parts: readonly PartSpec[] }) {
  const t = useTranslations('lab')
  const tv = useTranslations('viewer')
  const [selected, setSelected] = useState(0)
  const [result, setResult] = useState<{
    id: string
    data?: PartRenderData
    error?: string
  } | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [xray, setXray] = useState(false)
  const [unfold, setUnfold] = useState<number | undefined>(undefined)
  const [playing, setPlaying] = useState(false)
  const viewer = useRef<PartViewerHandle>(null)
  const [webgl] = useState(() => hasWebGL())
  const spec = parts[selected]!

  useEffect(() => {
    let alive = true
    renderPart(spec, t('drawingTitle', { id: spec.id }))
      .then((d) => alive && setResult({ id: spec.id, data: d }))
      .catch((e: Error) => alive && setResult({ id: spec.id, error: e.message }))
    return () => {
      alive = false
    }
  }, [spec, t])
  const data = result?.id === spec.id ? (result.data ?? null) : null
  const error = result?.id === spec.id ? (result.error ?? null) : null

  // přehrávání animace rozložení
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const start = performance.now() - (unfold ?? 0) * UNFOLD_DURATION_MS
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / UNFOLD_DURATION_MS)
      setUnfold(p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start se počítá jen při spuštění
  }, [playing])

  const highlighted3d = useMemo(
    () =>
      data && hoverId ? data.edges.map((e) => e.id).filter((id) => isRelated(id, hoverId)) : [],
    [data, hoverId],
  )

  const cubeLabels = {
    right: tv('cube.right'),
    left: tv('cube.left'),
    top: tv('cube.top'),
    bottom: tv('cube.bottom'),
    front: tv('cube.front'),
    back: tv('cube.back'),
  }

  const stepIndex = UNFOLD_STEPS.findIndex((s) => (unfold ?? 0) < s - 1e-6)
  const goStep = (dir: 1 | -1) => {
    setPlaying(false)
    const cur = unfold ?? 0
    const next =
      dir === 1
        ? (UNFOLD_STEPS.find((s) => s > cur + 1e-6) ?? 1)
        : ([...UNFOLD_STEPS].reverse().find((s) => s < cur - 1e-6) ?? 0)
    setUnfold(next)
  }

  const button =
    'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40'

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t('partsLabel')} className="flex flex-wrap gap-2">
        {parts.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setSelected(i)
              setHoverId(null)
            }}
            aria-pressed={i === selected}
            className={`${button} ${i === selected ? 'border-accent bg-blue-50 text-accent' : ''}`}
          >
            {p.id}
          </button>
        ))}
      </nav>
      <p className="text-muted" data-testid="part-note">
        {spec.note}
      </p>

      {error ? (
        <p role="alert" className="text-red-700">
          {t('error', { message: error })}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3" aria-labelledby="lab-3d">
          <h2 id="lab-3d" className="text-lg font-semibold">
            {t('model')}
          </h2>
          <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
            {!webgl ? (
              <NoWebGL text={tv('noWebgl')} />
            ) : data ? (
              <WebGLBoundary fallback={<NoWebGL text={tv('noWebgl')} />}>
                <PartViewer
                  ref={viewer}
                  data={data}
                  cubeLabels={cubeLabels}
                  xray={xray}
                  {...(unfold !== undefined ? { unfoldProgress: unfold } : {})}
                  highlightedEdgeIds={highlighted3d}
                  onHoverEdge={setHoverId}
                  className="h-full w-full"
                  ariaLabel={t('modelLabel', { id: spec.id })}
                />
              </WebGLBoundary>
            ) : (
              <div className="flex h-full items-center justify-center text-muted">
                {t('loading')}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={button} onClick={() => viewer.current?.reset()}>
              {tv('reset')}
            </button>
            <button
              type="button"
              className={button}
              aria-pressed={xray}
              onClick={() => setXray((x) => !x)}
            >
              {tv('xray')}
            </button>
          </div>
          <fieldset className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <legend className="px-1 text-sm font-semibold">{tv('unfold.title')}</legend>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={button}
                onClick={() => goStep(-1)}
                disabled={!unfold}
              >
                {tv('unfold.back')}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  if ((unfold ?? 0) >= 1) setUnfold(0)
                  setPlaying((p) => !p)
                }}
              >
                {playing ? tv('unfold.pause') : tv('unfold.play')}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => goStep(1)}
                disabled={unfold === 1}
              >
                {tv('unfold.next')}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  setPlaying(false)
                  setUnfold(undefined)
                }}
                disabled={unfold === undefined}
              >
                {tv('unfold.close')}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round((unfold ?? 0) * 1000)}
              aria-label={tv('unfold.slider')}
              onChange={(e) => {
                setPlaying(false)
                setUnfold(Number(e.target.value) / 1000)
              }}
            />
            <p className="text-sm text-muted" aria-live="polite">
              {unfold === undefined
                ? tv('unfold.hint')
                : tv(`unfold.step${Math.max(1, stepIndex === -1 ? 4 : stepIndex)}`)}
            </p>
          </fieldset>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="lab-2d">
          <h2 id="lab-2d" className="text-lg font-semibold">
            {t('drawing')}
          </h2>
          <div className="aspect-[4/3] w-full rounded-lg border border-slate-200 bg-white p-2">
            {data ? (
              <DrawingPanel
                svg={data.svg}
                hoverId={hoverId}
                onHover={setHoverId}
                label={t('drawingTitle', { id: spec.id })}
              />
            ) : null}
          </div>
          <ul className="flex flex-wrap gap-4 text-sm text-muted">
            <li className="flex items-center gap-2">
              <svg width="32" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="32" y2="3" stroke="#111" strokeWidth="2" />
              </svg>
              {t('legend.visible')}
            </li>
            <li className="flex items-center gap-2">
              <svg width="32" height="6" aria-hidden="true">
                <line
                  x1="0"
                  y1="3"
                  x2="32"
                  y2="3"
                  stroke="#111"
                  strokeWidth="1"
                  strokeDasharray="6 2"
                />
              </svg>
              {t('legend.hidden')}
            </li>
            <li className="flex items-center gap-2">
              <svg width="32" height="6" aria-hidden="true">
                <line
                  x1="0"
                  y1="3"
                  x2="32"
                  y2="3"
                  stroke="#111"
                  strokeWidth="1"
                  strokeDasharray="10 2 1 2"
                />
              </svg>
              {t('legend.center')}
            </li>
          </ul>
          <p className="text-sm text-muted">{t('hoverHint')}</p>
        </section>
      </div>
    </div>
  )
}

function NoWebGL({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="flex h-full items-center justify-center p-6 text-center text-muted"
    >
      {text}
    </div>
  )
}
