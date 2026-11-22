import { PILOT_MODULE } from '@vykresovna/content'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { ActionButton, CopyField } from '@/components/manage/ManageUi'
import { ManagePage, Notice, Section } from '@/components/manage/Notice'
import { CsvExportButton } from '@/components/trainer/CsvExportButton'
import {
  AddMemberForm,
  AssignLessonForm,
  AssignmentControls,
  BulkAccountsForm,
  GroupInvitationForm,
  ResetPasswordButton,
} from '@/components/trainer/TrainerForms'
import { Link, redirect } from '@/i18n/navigation'
import { formatJoinCode } from '@/lib/auth/login-id'
import { getViewer, licenseActive } from '@/lib/auth/viewer'
import { appUrl, loadManagedGroup } from '@/lib/manage/server'
import { hasAdminKey } from '@/lib/supabase/admin'
import { regenerateGroupCode, removeGroupMember, setGroupArchived } from '@/lib/trainer/actions'
import { BULK_MAX } from '@/lib/trainer/constants'
import { APP_TIME_ZONE, isOverdue, pragueDate } from '@/lib/trainer/dates'
import { FINAL_LESSON_SLUG, loadGroupData, MISTAKES_DAYS } from '@/lib/trainer/group-data'
import { percent, type MatrixCell } from '@/lib/trainer/matrix'

export const dynamic = 'force-dynamic'

const EMPTY_CELL: MatrixCell = { status: 'none', bestScore: null }

type Params = Promise<{ locale: string; id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'trainer.group' })
  return { title: t('metaTitle') }
}

/** Detail skupiny: matice postupu, nejčastější chyby, přiřazené lekce, členové (D-028). */
export default async function GroupPage({ params }: { params: Params }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const viewer = await getViewer()
  if (!viewer)
    return redirect({
      href: { pathname: '/prihlaseni', query: { next: `/skolitel/skupina/${id}` } },
      locale,
    })
  const ctx = await loadManagedGroup(id)
  if (!ctx) notFound()
  const { group, supabase } = ctx
  const data = await loadGroupData(supabase, group)

  const t = await getTranslations('trainer.group')
  const ta = await getTranslations('trainer.assignments')
  const tm = await getTranslations('trainer.members')
  const tl = await getTranslations('lessons')
  const te = await getTranslations('exercises.errors')
  const tb = await getTranslations('trainer.bulk')
  const format = await getFormatter()
  const fmtDate = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      timeZone: APP_TIME_ZONE,
    })

  const membership = viewer.memberships.find((m) => m.orgId === group.orgId)
  const available = PILOT_MODULE.lessons.filter((l) => l.status === 'available')
  const lessonTitle = (slug: string) => tl(`items.${slug}.title`)
  const lessonNo = (slug: string) => available.findIndex((l) => l.slug === slug) + 1
  const assignmentBySlug = new Map(data.assignments.map((a) => [a.lessonSlug, a]))
  const assignedSorted = [...data.assignments].sort(
    (a, b) => lessonNo(a.lessonSlug) - lessonNo(b.lessonSlug),
  )
  const unassigned = available
    .filter((l) => !assignmentBySlug.has(l.slug))
    .map((l) => ({
      slug: l.slug,
      title: ta('lessonItem', { n: lessonNo(l.slug), title: lessonTitle(l.slug) }),
    }))
  const memberIds = new Set(data.members.map((m) => m.userId))
  const candidates = data.orgMembers
    .filter((m) => !memberIds.has(m.userId))
    .map((m) => ({
      userId: m.userId,
      label: m.username ? `${m.displayName} (${m.username})` : m.displayName,
    }))
  const joinLink = group.joinCode ? await appUrl(`/pripojit?kod=${group.joinCode}`) : null
  const adminKey = hasAdminKey()
  const finalAssignment = assignmentBySlug.get(FINAL_LESSON_SLUG)

  const cellView = (cell: MatrixCell, slug: string) => {
    const due = assignmentBySlug.get(slug)?.dueAt ?? null
    const late = cell.status !== 'done' && isOverdue(due)
    if (cell.status === 'done')
      return (
        <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-900">
          {t('cellDone', { score: percent(cell.bestScore ?? 0) })}
        </span>
      )
    if (cell.status === 'started')
      return (
        <span
          className={`inline-block rounded px-1.5 py-0.5 ${late ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}
        >
          {t('cellStarted')}
          {late && <span className="sr-only">{t('late')}</span>}
        </span>
      )
    return (
      <span className={late ? 'font-semibold text-red-800' : 'text-slate-400'}>
        <span aria-hidden="true">{late ? t('lateMark') : t('emptyMark')}</span>
        <span className="sr-only">{late ? `${t('cellNone')}, ${t('late')}` : t('cellNone')}</span>
      </span>
    )
  }

  return (
    <ManagePage title={group.name} lead={t('lead', { org: membership?.orgName ?? '' })}>
      <nav aria-label={t('sectionsNav')} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/skolitel" className="font-medium text-accent underline">
          {t('back')}
        </Link>
        <a href="#postup" className="text-accent underline">
          {t('progress')}
        </a>
        <a href="#chyby" className="text-accent underline">
          {t('mistakes')}
        </a>
        <a href="#lekce" className="text-accent underline">
          {ta('title')}
        </a>
        <a href="#clenove" className="text-accent underline">
          {tm('title')}
        </a>
        <a href="#ucty" className="text-accent underline">
          {tb('title')}
        </a>
      </nav>

      {group.archivedAt && (
        <Notice tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('archivedNotice')}</span>
            <ActionButton
              action={setGroupArchived}
              fields={{ groupId: group.id, archived: '0' }}
              label={t('unarchive')}
            />
          </div>
        </Notice>
      )}
      {membership && !licenseActive(membership.licenseValidUntil) && (
        <Notice tone="warning">{t('licenseExpired')}</Notice>
      )}

      <Section
        title={t('progress')}
        id="postup"
        aside={
          data.matrix.length > 0 && (
            <CsvExportButton
              matrix={data.matrix}
              lessonSlugs={data.lessonSlugs}
              lessonTitles={data.lessonSlugs.map((s) =>
                ta('lessonItem', { n: lessonNo(s), title: lessonTitle(s) }),
              )}
              groupName={group.name}
            />
          )
        }
      >
        {data.matrix.length === 0 ? (
          <p className="text-sm text-slate-600">{t('noParticipants')}</p>
        ) : (
          <>
            <div
              className="relative max-w-full overflow-x-auto rounded-md border border-slate-200"
              role="region"
              aria-label={t('matrixLabel')}
              tabIndex={0}
            >
              <table className="min-w-full border-collapse text-sm" data-testid="progress-matrix">
                <caption className="sr-only">{t('matrixCaption')}</caption>
                <thead>
                  <tr className="bg-slate-50 align-bottom">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 min-w-40 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left"
                    >
                      {t('colParticipant')}
                    </th>
                    {data.lessonSlugs.map((slug) => {
                      const a = assignmentBySlug.get(slug)
                      return (
                        <th
                          key={slug}
                          scope="col"
                          className={`min-w-28 border-b border-slate-200 px-2 py-2 text-left text-xs font-medium ${a ? 'bg-blue-50 text-blue-950' : ''}`}
                          data-assigned={a ? 'true' : undefined}
                        >
                          <span className="block font-semibold">
                            {t('lessonShort', { n: lessonNo(slug) })}
                          </span>
                          <span className="block font-normal">{lessonTitle(slug)}</span>
                          {a && (
                            <span className="mt-1 block font-semibold">
                              {a.dueAt
                                ? t('assignedDue', { date: fmtDate(a.dueAt) })
                                : t('assigned')}
                            </span>
                          )}
                        </th>
                      )
                    })}
                    <th
                      scope="col"
                      className={`min-w-32 border-b border-slate-200 px-2 py-2 text-left text-xs font-medium ${finalAssignment ? 'bg-blue-50 text-blue-950' : ''}`}
                    >
                      <span className="block font-semibold">{lessonTitle(FINAL_LESSON_SLUG)}</span>
                      {finalAssignment && (
                        <span className="mt-1 block font-semibold">
                          {finalAssignment.dueAt
                            ? t('assignedDue', { date: fmtDate(finalAssignment.dueAt) })
                            : t('assigned')}
                        </span>
                      )}
                    </th>
                    <th
                      scope="col"
                      className="min-w-32 border-b border-slate-200 px-2 py-2 text-left text-xs font-medium"
                    >
                      {t('colCertificate')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.matrix.map((row) => (
                    <tr
                      key={row.userId}
                      className="border-b border-slate-100"
                      data-testid="matrix-row"
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium"
                      >
                        <span className="block">{row.displayName}</span>
                        {row.username && (
                          <span className="block font-mono text-xs font-normal text-slate-500">
                            {row.username}
                          </span>
                        )}
                      </th>
                      {data.lessonSlugs.map((slug) => (
                        <td
                          key={slug}
                          className={`px-2 py-2 ${assignmentBySlug.has(slug) ? 'bg-blue-50/40' : ''}`}
                        >
                          {cellView(row.cells[slug] ?? EMPTY_CELL, slug)}
                        </td>
                      ))}
                      <td className={`px-2 py-2 ${finalAssignment ? 'bg-blue-50/40' : ''}`}>
                        {row.finalScore === null ? (
                          cellView(row.cells[FINAL_LESSON_SLUG] ?? EMPTY_CELL, FINAL_LESSON_SLUG)
                        ) : (
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 font-semibold ${row.finalPassed ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}
                          >
                            {t(row.finalPassed ? 'finalPassed' : 'finalFailed', {
                              score: percent(row.finalScore),
                            })}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">
                        {row.certificateCode ?? (
                          <span className="text-slate-400" aria-hidden="true">
                            {t('emptyMark')}
                          </span>
                        )}
                        {!row.certificateCode && (
                          <span className="sr-only">{t('noCertificate')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-600">{t('legend')}</p>
          </>
        )}
      </Section>

      <Section title={t('mistakes')} id="chyby">
        {data.mistakes.length === 0 ? (
          <p className="text-sm text-slate-600">{t('noMistakes', { days: MISTAKES_DAYS })}</p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              {t('mistakesLead', { days: MISTAKES_DAYS, count: data.mistakesAttempts })}
            </p>
            <ol className="space-y-3" data-testid="common-mistakes">
              {data.mistakes.map((m) => (
                <li key={m.code} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-7 min-w-10 items-center justify-center rounded-full bg-slate-100 px-2 text-sm font-semibold">
                    {t('mistakeCount', { count: m.count })}
                  </span>
                  <span className="text-sm">{te.has(m.code) ? te(m.code) : m.code}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </Section>

      <Section title={ta('title')} id="lekce">
        {assignedSorted.length === 0 ? (
          <p className="text-sm text-slate-600">{ta('none')}</p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="assignments">
            {assignedSorted.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
                data-lesson={a.lessonSlug}
              >
                <div>
                  <p className="font-medium">
                    {ta('lessonItem', {
                      n: lessonNo(a.lessonSlug),
                      title: lessonTitle(a.lessonSlug),
                    })}
                  </p>
                  <p
                    className={`text-sm ${isOverdue(a.dueAt) ? 'text-red-800' : 'text-slate-600'}`}
                  >
                    {a.dueAt
                      ? ta(isOverdue(a.dueAt) ? 'duePassed' : 'due', { date: fmtDate(a.dueAt) })
                      : ta('noDue')}
                  </p>
                </div>
                <AssignmentControls
                  groupId={group.id}
                  assignmentId={a.id}
                  dueDate={a.dueAt ? pragueDate(a.dueAt) : ''}
                  lessonTitle={lessonTitle(a.lessonSlug)}
                />
              </li>
            ))}
          </ul>
        )}
        <AssignLessonForm groupId={group.id} lessons={unassigned} />
      </Section>

      <Section title={tm('title')} id="clenove">
        {data.members.length === 0 ? (
          <p className="text-sm text-slate-600">{tm('none')}</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table
              className="w-full min-w-[40rem] border-collapse text-sm"
              data-testid="group-members"
            >
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th scope="col" className="py-2 pr-4">
                    {tm('colName')}
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    {tm('colLogin')}
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    {tm('colRole')}
                  </th>
                  <th scope="col" className="py-2">
                    <span className="sr-only">{tm('colActions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr
                    key={m.userId}
                    className="border-b border-slate-100 align-top"
                    data-testid="member-row"
                    data-user={m.userId}
                  >
                    <td className="py-2 pr-4 font-medium">{m.displayName}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {m.username ?? tm('emailAccount')}
                    </td>
                    <td className="py-2 pr-4">
                      {tm(m.groupRole === 'trainer' ? 'roleTrainer' : 'roleParticipant')}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap items-start gap-2">
                        {m.groupRole === 'participant' && adminKey && (
                          <ResetPasswordButton userId={m.userId} name={m.displayName} />
                        )}
                        {m.userId !== viewer.userId && (
                          <ActionButton
                            action={removeGroupMember}
                            fields={{ groupId: group.id, userId: m.userId }}
                            label={tm('remove')}
                            ariaLabel={tm('removeFor', { name: m.displayName })}
                            confirm={tm('removeConfirm', { name: m.displayName })}
                            danger
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AddMemberForm groupId={group.id} candidates={candidates} />

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h3 className="font-semibold">{tm('codeTitle')}</h3>
          <p className="text-sm text-slate-600">{tm('codeLead')}</p>
          {group.joinCode && (
            <p className="text-sm">
              {tm('code')}{' '}
              <strong className="font-mono text-lg tracking-wider" data-testid="group-code">
                {formatJoinCode(group.joinCode)}
              </strong>
            </p>
          )}
          {joinLink && (
            <CopyField label={tm('joinLink')} value={joinLink} testId="group-join-link" />
          )}
          <ActionButton
            action={regenerateGroupCode}
            fields={{ groupId: group.id }}
            label={tm('regenerate')}
            confirm={tm('regenerateConfirm')}
          />
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h3 className="font-semibold">{tm('inviteTitle')}</h3>
          <p className="text-sm text-slate-600">{tm('inviteLead')}</p>
          <GroupInvitationForm groupId={group.id} />
        </div>
      </Section>

      <Section title={tb('title')} id="ucty">
        <p className="text-sm text-slate-600">{tb('lead')}</p>
        {adminKey ? (
          <BulkAccountsForm
            groupId={group.id}
            groupName={group.name}
            max={BULK_MAX}
            loginUrl={await appUrl('/prihlaseni')}
          />
        ) : (
          <Notice tone="warning">{tb('noAdminKey')}</Notice>
        )}
      </Section>

      {!group.archivedAt && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <ActionButton
            action={setGroupArchived}
            fields={{ groupId: group.id, archived: '1' }}
            label={t('archive')}
            confirm={t('archiveConfirm')}
          />
          <span>{t('archiveHint')}</span>
        </div>
      )}
    </ManagePage>
  )
}
