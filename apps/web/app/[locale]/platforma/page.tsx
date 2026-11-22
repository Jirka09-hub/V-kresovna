import type { Metadata } from 'next'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { ManagePage, Notice, Section } from '@/components/manage/Notice'
import {
  AdminInvitationForm,
  CreateOrgForm,
  LicenseForm,
} from '@/components/platform/PlatformForms'
import { focusRing } from '@/components/ui'
import { redirect } from '@/i18n/navigation'
import { formatJoinCode } from '@/lib/auth/login-id'
import { getViewer, licenseActive } from '@/lib/auth/viewer'
import { createClient } from '@/lib/supabase/server'
import { APP_TIME_ZONE, pragueDate } from '@/lib/trainer/dates'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'platform' })
  return { title: t('title') }
}

/** Správa platformy: organizace a licence (jen správci platformy), D-028. */
export default async function PlatformPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const viewer = await getViewer()
  if (!viewer)
    return redirect({ href: { pathname: '/prihlaseni', query: { next: '/platforma' } }, locale })
  const t = await getTranslations('platform')
  if (!viewer.isPlatformAdmin) {
    return (
      <ManagePage title={t('title')}>
        <Notice testId="no-access">{t('noAccess')}</Notice>
      </ManagePage>
    )
  }
  const format = await getFormatter()
  const fmtDate = (d: string) =>
    format.dateTime(new Date(d), { dateStyle: 'medium', timeZone: APP_TIME_ZONE })
  const supabase = await createClient()
  const { data } = await supabase.rpc('platform_organizations')
  const orgs = data ?? []
  const nextYear = new Date()
  nextYear.setFullYear(nextYear.getFullYear() + 1)

  return (
    <ManagePage title={t('title')} lead={t('lead')}>
      <Section title={t('create.title')} id="nova-organizace">
        <CreateOrgForm defaultValidUntil={pragueDate(nextYear)} />
      </Section>

      <Section title={t('list.title', { count: orgs.length })} id="organizace">
        {orgs.length === 0 ? (
          <p className="text-sm text-slate-600">{t('list.none')}</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table
              className="w-full min-w-[48rem] border-collapse text-sm"
              data-testid="platform-orgs"
            >
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th scope="col" className="py-2 pr-4">
                    {t('list.colName')}
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    {t('list.colSeats')}
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    {t('list.colStaff')}
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    {t('list.colValid')}
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    {t('list.colCode')}
                  </th>
                  <th scope="col" className="py-2">
                    <span className="sr-only">{t('list.colActions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => {
                  const active = licenseActive(o.license_valid_until)
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-slate-100 align-top"
                      data-testid="platform-org-row"
                    >
                      <td className="py-2 pr-4">
                        <span className="block font-medium">{o.name}</span>
                        <span className="block text-xs text-slate-600">{t(`kinds.${o.kind}`)}</span>
                      </td>
                      <td className="py-2 pr-4">
                        {t('list.seatsValue', { used: o.participants, limit: o.seat_limit })}
                      </td>
                      <td className="py-2 pr-4">{o.staff}</td>
                      <td className={`py-2 pr-4 ${active ? '' : 'font-semibold text-red-800'}`}>
                        {fmtDate(o.license_valid_until)}
                        {!active && <span className="block text-xs">{t('list.expired')}</span>}
                      </td>
                      <td className="py-2 pr-4 font-mono">{formatJoinCode(o.join_code)}</td>
                      <td className="py-2">
                        <details className="rounded-md border border-slate-200 p-2">
                          <summary className={`cursor-pointer text-sm font-medium ${focusRing}`}>
                            {t('list.manage')}
                          </summary>
                          <div className="mt-3 space-y-4">
                            <LicenseForm
                              orgId={o.id}
                              seats={o.seat_limit}
                              validUntil={o.license_valid_until}
                              orgName={o.name}
                            />
                            <AdminInvitationForm orgId={o.id} />
                          </div>
                        </details>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </ManagePage>
  )
}
