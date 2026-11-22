'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { RecorderState } from '@/lib/results/recorder'
import { useRecordingMode } from '@/lib/results/hooks'

const box = 'rounded-md border px-3 py-2 text-sm'

/**
 * Pruh nad lekcí: ukládají se výsledky? Nepřihlášenému nabídne přihlášení, po vypršení licence
 * vysvětlí, proč se nic neukládá. Přihlášenému s platnou licencí jen krátce řekne, kam se ukládá.
 */
export function ResultsBanner({ slug }: { slug: string }) {
  const t = useTranslations('results')
  const { mode, orgName } = useRecordingMode()
  if (mode === 'loading') return null
  if (mode === 'active') {
    return (
      <p className="text-sm text-muted" data-testid="results-banner" data-mode={mode}>
        {t('active', { org: orgName ?? '' })}
      </p>
    )
  }
  return (
    <p
      className={`${box} border-amber-300 bg-amber-50 text-amber-950`}
      data-testid="results-banner"
      data-mode={mode}
    >
      {mode === 'anonymous' ? (
        <>
          {t('signInPrompt')}{' '}
          <Link
            href={{ pathname: '/prihlaseni', query: { next: `/lekce/${slug}` } }}
            className="font-semibold text-accent underline"
          >
            {t('signInLink')}
          </Link>
        </>
      ) : mode === 'no-org' ? (
        <>
          {t('noOrg')}{' '}
          <Link href="/pripojit" className="font-semibold text-accent underline">
            {t('joinLink')}
          </Link>
        </>
      ) : (
        t('expired', { org: orgName ?? '' })
      )}
    </p>
  )
}

/** Nenápadné oznámení o stavu ukládání (chyba nikdy nezastaví cvičení). */
export function SaveNotice({ save }: { save: RecorderState }) {
  const t = useTranslations('results')
  return (
    <p
      role="status"
      aria-live="polite"
      className={
        save.status === 'error' ? `${box} border-red-300 bg-red-50 text-red-900` : 'sr-only'
      }
      data-testid="save-status"
      data-status={save.status}
    >
      {save.status === 'error' ? t('saveError') : save.status === 'finished' ? t('saved') : ''}
    </p>
  )
}
