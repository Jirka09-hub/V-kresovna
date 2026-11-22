'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useId } from 'react'
import { btnPrimary, focusRing } from '@/components/ui'

/** Formulář s ověřovacím kódem (GET na /overeni, funguje i bez JavaScriptu). */
export function VerifyForm({ defaultValue }: { defaultValue?: string }) {
  const t = useTranslations('verify')
  const locale = useLocale()
  const id = useId()
  return (
    <form
      method="get"
      action={`/${locale}/overeni`}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      data-testid="verify-form"
    >
      <div className="flex-1">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {t('codeLabel')}
        </label>
        <input
          id={id}
          name="kod"
          required
          defaultValue={defaultValue}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t('codePlaceholder')}
          className={`mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-base tracking-wide uppercase ${focusRing}`}
        />
      </div>
      <button type="submit" className={btnPrimary}>
        {t('submit')}
      </button>
    </form>
  )
}
