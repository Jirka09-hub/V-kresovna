import { PILOT_MODULE } from '@vykresovna/content'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import {
  DeleteAccountForm,
  DisplayNameForm,
  LeaveOrgButton,
  PasswordForm,
} from '@/components/account/AccountForms'
import { CertificateDownload } from '@/components/certificate/CertificateDownload'
import { btnSecondary, panel } from '@/components/ui'
import { Link, redirect } from '@/i18n/navigation'
import { signOut, switchOrganization } from '@/lib/auth/actions'
import { activeMembership, getViewer, licenseActive } from '@/lib/auth/viewer'
import { formatCode, scorePercent } from '@/lib/certificate/format'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const h2 = 'mb-3 text-lg font-semibold'

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const viewer = await getViewer()
  if (!viewer)
    return redirect({ href: { pathname: '/prihlaseni', query: { next: '/ucet' } }, locale })
  const t = await getTranslations('account')
  const tr = await getTranslations('roles')
  const tn = await getTranslations('auth.join')
  const tm = await getTranslations('modules')
  const format = await getFormatter()
  const active = activeMembership(viewer)

  const supabase = await createClient()
  const mod = PILOT_MODULE
  const [certificates, progress] = await Promise.all([
    supabase
      .from('certificates')
      .select('holder_name, org_name, module_slug, score, issued_at, verification_code')
      .eq('user_id', viewer.userId)
      .order('issued_at', { ascending: false }),
    active
      ? supabase
          .from('lesson_progress')
          .select('lesson_slug, finished_runs, best_score')
          .eq('user_id', viewer.userId)
          .eq('org_id', active.orgId)
          .eq('module_slug', mod.slug)
      : Promise.resolve({ data: [] }),
  ])

  // souhrn postupu v aktivní organizaci: lekce (bez závěrečného testu) a závěrečný test
  const finalLesson = mod.lessons.find((l) => l.test)
  const lessons = mod.lessons.filter((l) => l.status === 'available' && !l.test)
  const rows = new Map((progress.data ?? []).map((r) => [r.lesson_slug, r]))
  const doneLessons = lessons.filter((l) => (rows.get(l.slug)?.finished_runs ?? 0) > 0).length
  const finalRow = finalLesson ? rows.get(finalLesson.slug) : undefined
  const finalBest = finalRow && (finalRow.finished_runs ?? 0) > 0 ? finalRow.best_score : null
  const moduleTitle = (slug: string) => (tm.has(`${slug}.title`) ? tm(`${slug}.title`) : slug)
  const dateOf = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeZone: 'Europe/Prague' })

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <section className={`${panel} space-y-5 p-6`} aria-labelledby="account-profile">
        <h2 id="account-profile" className="sr-only">
          {t('profile')}
        </h2>
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
        <DisplayNameForm initial={viewer.displayName} />
      </section>

      {active ? (
        <section
          className={`${panel} p-6`}
          aria-labelledby="account-progress-title"
          data-testid="account-progress"
        >
          <h2 id="account-progress-title" className={h2}>
            {t('progressTitle', { org: active.orgName })}
          </h2>
          <ul className="space-y-1 text-sm">
            <li>{t('progressLessons', { done: doneLessons, total: lessons.length })}</li>
            <li>
              {finalBest === null
                ? t('progressFinalNone')
                : t('progressFinal', { percent: scorePercent(finalBest ?? 0) })}
            </li>
          </ul>
          <Link
            href="/lekce"
            className="mt-3 inline-block text-sm font-medium text-accent underline"
          >
            {t('progressLink')}
          </Link>
        </section>
      ) : null}

      <section className={`${panel} p-6`} aria-labelledby="account-certs">
        <h2 id="account-certs" className={h2}>
          {t('certificates')}
        </h2>
        {(certificates.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-700">{t('noCertificates')}</p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="account-certificates">
            {(certificates.data ?? []).map((c) => (
              <li
                key={c.verification_code}
                className="flex flex-col gap-2 py-3"
                data-testid="account-certificate"
              >
                <p className="font-medium">{moduleTitle(c.module_slug)}</p>
                <p className="text-sm text-slate-600">
                  {t('certificateMeta', {
                    org: c.org_name ?? '–',
                    percent: scorePercent(c.score),
                    date: dateOf(c.issued_at),
                  })}
                </p>
                <p className="text-sm">
                  {t('certificateCode')}{' '}
                  <span className="font-mono">{formatCode(c.verification_code)}</span>
                </p>
                <div className="flex flex-wrap items-start gap-3">
                  <CertificateDownload
                    primary={false}
                    cert={{
                      holderName: c.holder_name,
                      orgName: c.org_name,
                      moduleSlug: c.module_slug,
                      score: c.score,
                      issuedAt: c.issued_at,
                      code: c.verification_code,
                    }}
                  />
                  <Link
                    href={`/overeni/${c.verification_code}`}
                    className="self-center text-sm font-medium text-accent underline"
                  >
                    {t('certificateVerify')}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${panel} p-6`} aria-labelledby="account-orgs-title">
        <h2 id="account-orgs-title" className={h2}>
          {t('organizations')}
        </h2>
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
              <li
                key={m.orgId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
                data-org={m.orgId}
              >
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
                <div className="flex flex-wrap items-start gap-2">
                  {m.orgId !== viewer.activeOrgId && (
                    <form action={switchOrganization}>
                      <input type="hidden" name="orgId" value={m.orgId} />
                      <button type="submit" className={btnSecondary}>
                        {t('switchTo')}
                      </button>
                    </form>
                  )}
                  <LeaveOrgButton orgId={m.orgId} orgName={m.orgName} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${panel} p-6`} aria-labelledby="account-password">
        <h2 id="account-password" className={h2}>
          {t('passwordTitle')}
        </h2>
        <PasswordForm login={viewer.username ?? viewer.email} />
      </section>

      <form action={signOut}>
        <button type="submit" className={btnSecondary} data-testid="sign-out">
          {t('signOut')}
        </button>
      </form>

      <section
        className="space-y-3 rounded-lg border border-red-200 bg-white p-6"
        aria-labelledby="account-delete"
      >
        <h2 id="account-delete" className="text-lg font-semibold text-red-800">
          {t('deleteTitle')}
        </h2>
        <p className="text-sm text-slate-700">{t('deleteText')}</p>
        <DeleteAccountForm />
      </section>
    </main>
  )
}
