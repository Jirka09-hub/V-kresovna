import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AuthCard } from '@/components/auth/AuthForms'
import { JoinPanel, StatusMessage } from '@/components/auth/JoinPanel'
import { btnPrimary, btnSecondary, focusRing } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { formatJoinCode } from '@/lib/auth/login-id'
import { getViewer } from '@/lib/auth/viewer'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ kod?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('auth.join')
  const code = ((await searchParams).kod ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 16)

  if (!code) {
    return (
      <AuthCard title={t('title')}>
        <p className="text-sm text-slate-700">{t('intro')}</p>
        <form method="get" className="space-y-4">
          <div>
            <label htmlFor="kod" className="block text-sm font-medium">
              {t('code')}
            </label>
            <input
              id="kod"
              name="kod"
              required
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="kod-hint"
              className={`mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-lg tracking-widest uppercase ${focusRing}`}
            />
            <p id="kod-hint" className="mt-1 text-xs text-slate-600">
              {t('codeHint')}
            </p>
          </div>
          <button type="submit" className={btnPrimary}>
            {t('check')}
          </button>
        </form>
      </AuthCard>
    )
  }

  const supabase = await createClient()
  const [{ data }, viewer] = await Promise.all([
    supabase.rpc('join_code_preview', { p_code: code }),
    getViewer(),
  ])
  const preview = data?.[0]
  return (
    <AuthCard title={t('title')}>
      <p className="font-mono text-lg tracking-widest" data-testid="join-code">
        {formatJoinCode(code)}
      </p>
      {preview?.status === 'ok' ? (
        <>
          <p className="text-base">
            {preview.group_name
              ? t('targetGroup', { org: preview.org_name ?? '', group: preview.group_name })
              : t('target', { org: preview.org_name ?? '' })}
          </p>
          <JoinPanel
            kind="code"
            secret={code}
            viewer={viewer}
            returnTo={`/pripojit?kod=${code}`}
            joinLabel={t('joinNow')}
          />
        </>
      ) : (
        <StatusMessage status={preview?.status ?? 'invalid'} />
      )}
      <Link href="/pripojit" className={btnSecondary}>
        {t('otherCode')}
      </Link>
    </AuthCard>
  )
}
