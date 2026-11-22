import type { Metadata } from 'next'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { ActionButton, CopyField } from '@/components/manage/ManageUi'
import { ManagePage, Notice, Section } from '@/components/manage/Notice'
import {
  MemberRoleForm,
  OrgInvitationForm,
  RenameOrgForm,
} from '@/components/org-admin/OrgAdminForms'
import { Link, redirect } from '@/i18n/navigation'
import { formatJoinCode } from '@/lib/auth/login-id'
import { activeMembership, getViewer, licenseActive } from '@/lib/auth/viewer'
import { appUrl } from '@/lib/manage/server'
import { regenerateOrgCode, removeMember, revokeInvitation } from '@/lib/org-admin/actions'
import { createClient } from '@/lib/supabase/server'
import { APP_TIME_ZONE } from '@/lib/trainer/dates'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'orgAdmin' })
  return { title: t('title') }
}

/** Správa organizace (správce aktivní organizace), D-028. */
export default async function OrgAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const viewer = await getViewer()
  if (!viewer)
    return redirect({ href: { pathname: '/prihlaseni', query: { next: '/sprava' } }, locale })
  const t = await getTranslations('orgAdmin')
  const tr = await getTranslations('roles')
  const format = await getFormatter()
  const membership = activeMembership(viewer)

  if (membership?.role !== 'org_admin') {
    const elsewhere = viewer.memberships.some((m) => m.role === 'org_admin')
    return (
      <ManagePage title={t('title')}>
        <Notice testId="no-access">
          <p>{t('noAccess')}</p>
          {elsewhere && (
            <p className="mt-2">
              <Link href="/ucet" className="font-medium text-accent underline">
                {t('switchOrg')}
              </Link>
            </p>
          )}
        </Notice>
      </ManagePage>
    )
  }

  const orgId = membership.orgId
  const supabase = await createClient()
  const [orgRes, membersRes, invitesRes, groupsRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, kind, join_code, seat_limit, license_valid_until')
      .eq('id', orgId)
      .single(),
    supabase
      .from('memberships')
      .select('user_id, role, created_at, profiles(display_name, username)')
      .eq('org_id', orgId),
    supabase
      .from('invitations')
      .select('id, role, note, expires_at, groups(name)')
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('groups')
      .select('id, name')
      .eq('org_id', orgId)
      .is('archived_at', null)
      .order('name'),
  ])
  const org = orgRes.data
  if (!org) return null
  const members = (membersRes.data ?? [])
    .map((m) => ({
      userId: m.user_id,
      role: m.role,
      name: m.profiles?.display_name ?? '',
      username: m.profiles?.username ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  const used = members.filter((m) => m.role === 'participant').length
  const active = licenseActive(org.license_valid_until)
  const fmtDate = (d: string) =>
    format.dateTime(new Date(d), { dateStyle: 'medium', timeZone: APP_TIME_ZONE })
  const joinLink = await appUrl(`/pripojit?kod=${org.join_code}`)

  return (
    <ManagePage title={t('title')} lead={org.name}>
      <Section title={t('org.title')} id="organizace">
        <RenameOrgForm orgId={orgId} name={org.name} />
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]" data-testid="license">
          <dt className="text-slate-600">{t('org.kind')}</dt>
          <dd>{t(`org.kinds.${org.kind}`)}</dd>
          <dt className="text-slate-600">{t('org.seats')}</dt>
          <dd>{t('org.seatsValue', { used, limit: org.seat_limit })}</dd>
          <dt className="text-slate-600">{t('org.validUntil')}</dt>
          <dd>{fmtDate(org.license_valid_until)}</dd>
        </dl>
        {!active && (
          <Notice tone="warning">
            {t('org.expired', { date: fmtDate(org.license_valid_until) })}
          </Notice>
        )}
        {active && used >= org.seat_limit && <Notice tone="warning">{t('org.full')}</Notice>}
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h3 className="font-semibold">{t('org.codeTitle')}</h3>
          <p className="text-sm text-slate-600">{t('org.codeLead')}</p>
          <p className="text-sm">
            {t('org.code')}{' '}
            <strong className="font-mono text-lg tracking-wider" data-testid="org-code">
              {formatJoinCode(org.join_code)}
            </strong>
          </p>
          <CopyField label={t('org.joinLink')} value={joinLink} />
          <ActionButton
            action={regenerateOrgCode}
            fields={{ orgId }}
            label={t('org.regenerate')}
            confirm={t('org.regenerateConfirm')}
          />
        </div>
        <p className="text-sm">
          <Link href="/skolitel" className="font-medium text-accent underline">
            {t('groupsLink')}
          </Link>
        </p>
      </Section>

      <Section title={t('members.title')} id="clenove">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm" data-testid="org-members">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th scope="col" className="py-2 pr-4">
                  {t('members.colName')}
                </th>
                <th scope="col" className="py-2 pr-4">
                  {t('members.colLogin')}
                </th>
                <th scope="col" className="py-2 pr-4">
                  {t('members.colRole')}
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">{t('members.colActions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.userId}
                  className="border-b border-slate-100 align-top"
                  data-testid="org-member-row"
                  data-user={m.userId}
                >
                  <td className="py-2 pr-4 font-medium">
                    {m.name}
                    {m.userId === viewer.userId && (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {t('members.you')}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {m.username ?? t('members.emailAccount')}
                  </td>
                  <td className="py-2 pr-4">
                    <MemberRoleForm orgId={orgId} userId={m.userId} role={m.role} name={m.name} />
                  </td>
                  <td className="py-2">
                    {m.userId !== viewer.userId && (
                      <ActionButton
                        action={removeMember}
                        fields={{ orgId, userId: m.userId }}
                        label={t('members.remove')}
                        ariaLabel={t('members.removeFor', { name: m.name })}
                        confirm={t('members.removeConfirm', { name: m.name })}
                        danger
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-600">{t('members.hint')}</p>
      </Section>

      <Section title={t('invitations.title')} id="pozvanky">
        <p className="text-sm text-slate-600">{t('invitations.lead')}</p>
        <OrgInvitationForm orgId={orgId} groups={groupsRes.data ?? []} />
        <h3 className="pt-2 font-semibold">{t('invitations.pending')}</h3>
        {(invitesRes.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-600">{t('invitations.none')}</p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="pending-invitations">
            {(invitesRes.data ?? []).map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-medium">{inv.note || t('invitations.noNote')}</p>
                  <p className="text-slate-600">
                    {inv.groups?.name
                      ? t('invitations.metaGroup', {
                          role: tr(inv.role),
                          group: inv.groups.name,
                          date: fmtDate(inv.expires_at),
                        })
                      : t('invitations.meta', {
                          role: tr(inv.role),
                          date: fmtDate(inv.expires_at),
                        })}
                  </p>
                </div>
                <ActionButton
                  action={revokeInvitation}
                  fields={{ orgId, invitationId: inv.id }}
                  label={t('invitations.revoke')}
                  danger
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </ManagePage>
  )
}
