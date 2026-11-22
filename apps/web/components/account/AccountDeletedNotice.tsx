'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

/** Potvrzení na úvodní stránce po smazání účtu (`/?ucet=smazan`). */
export function AccountDeletedNotice() {
  const t = useTranslations('account')
  const params = useSearchParams()
  if (params.get('ucet') !== 'smazan') return null
  return (
    <p
      role="status"
      className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-green-900"
      data-testid="account-deleted"
    >
      {t('deleted')}
    </p>
  )
}
