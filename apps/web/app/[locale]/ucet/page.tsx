import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { btnSecondary, panel } from '@/components/ui'
import { Link, redirect } from '@/i18n/navigation'
import { signOut, switchOrganization } from '@/lib/auth/actions'
import { getViewer, licenseActive } from '@/lib/auth/viewer'

export const dynamic = 'force-dynamic'

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const viewer = await getViewer()
  if (!viewer)
    return redirect({ href: { pathname: '/prihlaseni', query: { next: '/ucet' } }, locale })
  const t = await getTranslations('account')
  const tr = await getTranslations('roles')
  const tn = await getTranslations('auth.join')
  const format = await getFormatter()

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <section className={`${panel} p-6`}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-slate-600">{t('name')}</dt>
          <dd data-testid="account-name">{viewer.displayName}</dd>
          {viewer.username && (
            <>
              <dt className="text-slate-600">{t('login')}</dt>
              <dd className="font-mono">{viewer.username}</dd>
            </>
          )}
          {viewer.email && (
            <>
              <dt className="text-slate-600">{t('email')}</dt>
              <dd>{viewer.email}</dd>
            </>
          )}
        </dl>
      </section>

      <section className={`${panel} p-6`}>
        <h2 className="mb-3 text-lg font-semibold">{t('organizations')}</h2>
        {viewer.memberships.length === 0 ? (
          <p className="text-sm text-slate-700">
            {t('noOrg')}{' '}
            <Link href="/pripojit" className="font-medium text-accent underline">
              {tn('title')}
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="account-orgs">
            {viewer.memberships.map((m) => (
              <li key={m.orgId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    {m.orgName}{' '}
                    {m.orgId === viewer.activeOrgId && viewer.memberships.length > 1 && (
                      <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-accent">
                        {t('active')}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600">{tr(m.role)}</p>
                  {!licenseActive(m.licenseValidUntil) && (
                    <p className="text-sm text-amber-800">
                      {t('licenseExpired', {
                        date: format.dateTime(new Date(m.licenseValidUntil), {
                          dateStyle: 'medium',
                        }),
                      })}
                    </p>
                  )}
                </div>
                {m.orgId !== viewer.activeOrgId && (
                  <form action={switchOrganization}>
                    <input type="hidden" name="orgId" value={m.orgId} />
                    <button type="submit" className={btnSecondary}>
                      {t('switchTo')}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={signOut}>
        <button type="submit" className={btnSecondary} data-testid="sign-out">
          {t('signOut')}
        </button>
      </form>
    </main>
  )
}
