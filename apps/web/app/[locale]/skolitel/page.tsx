import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ManagePage, Notice, Section } from '@/components/manage/Notice'
import { CreateGroupForm } from '@/components/trainer/TrainerForms'
import { focusRing } from '@/components/ui'
import { Link, redirect } from '@/i18n/navigation'
import { activeMembership, getViewer, licenseActive } from '@/lib/auth/viewer'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'trainer.dashboard' })
  return { title: t('title') }
}

type GroupCard = {
  id: string
  name: string
  archived: boolean
  participants: number
  assignments: number
}

/** Přehled školitele: skupiny v aktivní organizaci (D-028). */
export default async function TrainerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const viewer = await getViewer()
  if (!viewer)
    return redirect({ href: { pathname: '/prihlaseni', query: { next: '/skolitel' } }, locale })
  const t = await getTranslations('trainer.dashboard')
  const membership = activeMembership(viewer)

  if (!membership || membership.role === 'participant') {
    const elsewhere = viewer.memberships.some((m) => m.role !== 'participant')
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

  const supabase = await createClient()
  const { data } = await supabase
    .from('groups')
    .select('id, name, archived_at, created_at, group_members(user_id, role), assignments(id)')
    .eq('org_id', membership.orgId)
    .order('created_at', { ascending: false })
  const isAdmin = membership.role === 'org_admin'
  const groups: GroupCard[] = (data ?? [])
    .filter(
      (g) =>
        isAdmin || g.group_members.some((m) => m.user_id === viewer.userId && m.role === 'trainer'),
    )
    .map((g) => ({
      id: g.id,
      name: g.name,
      archived: !!g.archived_at,
      participants: g.group_members.filter((m) => m.role === 'participant').length,
      assignments: g.assignments.length,
    }))
  const active = groups.filter((g) => !g.archived)
  const archived = groups.filter((g) => g.archived)

  return (
    <ManagePage
      title={t('title')}
      lead={t(isAdmin ? 'leadAdmin' : 'lead', { org: membership.orgName })}
    >
      {!licenseActive(membership.licenseValidUntil) && (
        <Notice tone="warning">{t('licenseExpired')}</Notice>
      )}
      <Section title={t('groups')} id="skupiny">
        {active.length === 0 ? (
          <p className="text-sm text-slate-600">{t('noGroups')}</p>
        ) : (
          <GroupList groups={active} t={t} />
        )}
        {archived.length > 0 && (
          <details className="rounded-md border border-slate-200 p-3">
            <summary className={`cursor-pointer text-sm font-medium ${focusRing}`}>
              {t('archived', { count: archived.length })}
            </summary>
            <div className="mt-3">
              <GroupList groups={archived} t={t} />
            </div>
          </details>
        )}
      </Section>
      <Section title={t('newGroup')} id="nova-skupina">
        <CreateGroupForm orgId={membership.orgId} />
      </Section>
    </ManagePage>
  )
}

function GroupList({
  groups,
  t,
}: {
  groups: readonly GroupCard[]
  t: Awaited<ReturnType<typeof getTranslations<'trainer.dashboard'>>>
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="group-list">
      {groups.map((g) => (
        <li key={g.id}>
          <Link
            href={`/skolitel/skupina/${g.id}`}
            className={`flex h-full flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 hover:border-accent hover:shadow-sm ${focusRing}`}
          >
            <span className="text-lg font-semibold">{g.name}</span>
            <span className="text-sm text-muted">
              {t('cardMeta', { participants: g.participants, lessons: g.assignments })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
