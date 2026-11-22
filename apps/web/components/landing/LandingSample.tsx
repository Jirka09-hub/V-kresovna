'use client'

import { LANDING_FEATURES, LANDING_PART } from '@vykresovna/content'
import type { PartRenderData } from '@vykresovna/engine'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { btnPrimary, panel } from '@/components/ui'
import { deserializeRenderData, sampleUrl, type SerializedRenderData } from '@/lib/landing/sample'

/** 3D část (three.js) se stáhne až ve chvíli, kdy ji uživatel uvidí. */
const LinkedView = dynamic(
  () => import('@/components/lessons/LinkedDemo').then((m) => m.LinkedView),
  { ssr: false },
)

type Status = 'idle' | 'loading' | 'ready' | 'error'

/** Šetří uživatel data? Pak ukázku nespouštíme sami, jen na tlačítko. */
function saveData(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } }
  return nav.connection?.saveData === true
}

/**
 * Živá ukázka na úvodní stránce (D-031): předpočítaná data součásti, žádný výpočet v prohlížeči.
 * Načte se, až se sekce přiblíží k obrazovce (nebo na tlačítko, když uživatel šetří data).
 */
export function LandingSample() {
  const t = useTranslations('home.sample')
  const box = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [data, setData] = useState<PartRenderData | null>(null)

  const load = useCallback(() => {
    setStatus('loading')
    fetch(sampleUrl(LANDING_PART.id))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<SerializedRenderData>
      })
      .then((json) => {
        setData(deserializeRenderData(json))
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el || saveData() || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          load()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [load])

  return (
    <div ref={box} data-testid="landing-sample" data-status={status}>
      {status === 'ready' ? (
        <LinkedView data={data} features={LANDING_FEATURES} />
      ) : (
        <div
          className={`flex aspect-[8/3] min-h-56 flex-col items-center justify-center gap-3 p-6 text-center ${panel} bg-slate-50`}
        >
          {status === 'loading' ? (
            <p role="status" className="text-sm text-muted">
              {t('loading')}
            </p>
          ) : status === 'error' ? (
            <p role="alert" className="text-sm text-red-800">
              {t('error')}
            </p>
          ) : (
            <>
              <button type="button" className={btnPrimary} onClick={load}>
                {t('start')}
              </button>
              <p className="text-sm text-muted">{t('startHint')}</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
