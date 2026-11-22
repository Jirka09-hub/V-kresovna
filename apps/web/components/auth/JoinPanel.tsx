import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Viewer } from '@/lib/auth/viewer'
import { CreateAccountForm, JoinExistingForm } from './AuthForms'

/** Po ověřeném kódu/pozvánce: přihlášený se připojí jedním tlačítkem, nový si založí účet. */
export async function JoinPanel({
  kind,
  secret,
  viewer,
  returnTo,
  joinLabel,
}: {
  kind: 'code' | 'invitation' | 'platform'
  secret: string
  viewer: Viewer | null
  /** cesta této stránky (pro návrat po přihlášení) */
  returnTo: string
  joinLabel: string
}) {
  const t = await getTranslations('auth')
  if (viewer) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-700">{t('join.asUser', { name: viewer.displayName })}</p>
        <JoinExistingForm kind={kind} secret={secret} label={joinLabel} />
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-700">
        {t('create.haveAccount')}{' '}
        <Link
          href={{ pathname: '/prihlaseni', query: { next: returnTo } }}
          className="font-medium text-accent underline"
        >
          {t('create.signInFirst')}
        </Link>
      </p>
      <div className="border-t border-slate-200 pt-4">
        <h2 className="mb-3 text-lg font-semibold">{t('create.title')}</h2>
        <CreateAccountForm kind={kind} secret={secret} />
      </div>
    </div>
  )
}

export async function StatusMessage({ status }: { status: string }) {
  const t = await getTranslations('auth.status')
  return (
    <p
      role="alert"
      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      {t.has(status) ? t(status) : t('invalid')}
    </p>
  )
}
