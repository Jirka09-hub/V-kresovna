'use client'

import type { PartSpec } from '@vykresovna/engine'
import { UNFOLD_STEPS } from '@vykresovna/viewer'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Model3D } from '@/components/three/Model3D'
import { btnPrimary, btnSecondary } from '@/components/ui'
import { useRenderParts } from '@/lib/engine/hooks'

const DURATION_MS = 7000

/** Živá ukázka: animace rozložení průměten do roviny výkresu (evropské promítání), jde krokovat. */
export function UnfoldDemo({ part, label }: { part: PartSpec; label: string }) {
  const t = useTranslations('unfold')
  const tv = useTranslations('viewer')
  const parts = useRenderParts(useMemo(() => [part], [part]))
  const [progress, setProgressState] = useState(0)
  const [playing, setPlaying] = useState(false)
  const progressRef = useRef(0)
  const setProgress = (p: number) => {
    progressRef.current = p
    setProgressState(p)
  }

  useEffect(() => {
    if (!playing) return
    // bez animací (prefers-reduced-motion): rovnou na další krok
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = requestAnimationFrame(() => {
        const p = progressRef.current >= 1 ? 0 : progressRef.current
        progressRef.current = UNFOLD_STEPS.find((s) => s > p + 1e-6) ?? 1
        setProgressState(progressRef.current)
        setPlaying(false)
      })
      return () => cancelAnimationFrame(id)
    }
    let raf = 0
    let start: number | null = null
    const from = progressRef.current >= 1 ? 0 : progressRef.current
    const tick = (now: number) => {
      start ??= now
      const p = Math.min(1, from + (now - start) / DURATION_MS)
      progressRef.current = p
      setProgressState(p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const stepIndex = UNFOLD_STEPS.findIndex((s) => progress < s - 1e-6)
  const step = Math.max(1, stepIndex === -1 ? 4 : stepIndex)
  const go = (dir: 1 | -1) => {
    setPlaying(false)
    const cur = progressRef.current
    setProgress(
      dir === 1
        ? (UNFOLD_STEPS.find((s) => s > cur + 1e-6) ?? 1)
        : ([...UNFOLD_STEPS].reverse().find((s) => s < cur - 1e-6) ?? 0),
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Model3D
        data={parts.data?.[0] ?? null}
        ariaLabel={label}
        unfoldProgress={progress}
        className="aspect-[16/10] w-full"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => setPlaying((p) => !p)}
          data-testid="unfold-play"
        >
          {playing ? t('pause') : progress >= 1 ? t('replay') : t('play')}
        </button>
        <button type="button" className={btnSecondary} onClick={() => go(-1)} disabled={!progress}>
          {t('back')}
        </button>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => go(1)}
          disabled={progress >= 1}
        >
          {t('next')}
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          aria-label={t('slider')}
          className="min-w-32 flex-1 accent-accent"
          onChange={(e) => {
            setPlaying(false)
            setProgress(Number(e.target.value) / 1000)
          }}
        />
      </div>
      <p className="min-h-12 text-sm text-muted" aria-live="polite">
        {progress === 0 && !playing ? tv('unfold.hint') : tv(`unfold.step${step}`)}
      </p>
    </div>
  )
}
