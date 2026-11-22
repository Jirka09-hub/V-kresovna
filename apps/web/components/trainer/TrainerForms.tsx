'use client'

import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import {
  ActionButton,
  Hidden,
  inputClass,
  LabeledField,
  ManageError,
  OneTimeLink,
} from '@/components/manage/ManageUi'
import { btnPrimary, btnSecondary } from '@/components/ui'
import type { ManageState } from '@/lib/manage/server'
import {
  addAssignment,
  addGroupMember,
  bulkCreateAccounts,
  createGroup,
  createGroupInvitation,
  removeAssignment,
  resetPassword,
  updateAssignmentDue,
  type BulkState,
  type InvitationState,
  type ResetState,
} from '@/lib/trainer/actions'

export function CreateGroupForm({ orgId }: { orgId: string }) {
  const t = useTranslations('trainer.dashboard')
  const [state, action, pending] = useActionState<ManageState, FormData>(createGroup, {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" data-testid="create-group">
      <Hidden fields={{ orgId }} />
      <LabeledField label={t('groupName')} hint={t('groupNameHint')} className="min-w-56 flex-1">
        {(p) => <input {...p} name="name" required maxLength={80} className={inputClass} />}
      </LabeledField>
      <button type="submit" className={`${btnPrimary} mb-5`} disabled={pending}>
        {t('createGroup')}
      </button>
      <div className="w-full">
        <ManageError state={state} />
      </div>
    </form>
  )
}

export type LessonOption = { readonly slug: string; readonly title: string }

export function AssignLessonForm({
  groupId,
  lessons,
}: {
  groupId: string
  lessons: readonly LessonOption[]
}) {
  const t = useTranslations('trainer.assignments')
  const [state, action, pending] = useActionState<ManageState, FormData>(addAssignment, {})
  if (lessons.length === 0) return <p className="text-sm text-slate-600">{t('allAssigned')}</p>
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" data-testid="assign-lesson">
      <Hidden fields={{ groupId }} />
      <LabeledField label={t('lesson')} className="min-w-56 flex-1">
        {(p) => (
          <select {...p} name="lessonSlug" required className={inputClass}>
            {lessons.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.title}
              </option>
            ))}
          </select>
        )}
      </LabeledField>
      <LabeledField label={t('dueOptional')}>
        {(p) => <input {...p} type="date" name="dueDate" className={inputClass} />}
      </LabeledField>
      <button type="submit" className={btnPrimary} disabled={pending}>
        {t('assign')}
      </button>
      <div className="w-full">
        <ManageError state={state} />
      </div>
    </form>
  )
}

export function AssignmentControls({
  groupId,
  assignmentId,
  dueDate,
  lessonTitle,
}: {
  groupId: string
  assignmentId: string
  dueDate: string
  lessonTitle: string
}) {
  const t = useTranslations('trainer.assignments')
  const [state, action, pending] = useActionState<ManageState, FormData>(updateAssignmentDue, {})
  return (
    <div className="flex flex-wrap items-start gap-2">
      <form action={action} className="flex flex-col gap-1">
        <Hidden fields={{ groupId, assignmentId }} />
        <div className="flex items-center gap-2">
          <input
            type="date"
            name="dueDate"
            defaultValue={dueDate}
            aria-label={t('dueFor', { lesson: lessonTitle })}
            className={`${inputClass} w-auto py-1 text-sm`}
          />
          <button type="submit" className={btnSecondary} disabled={pending}>
            {t('saveDue')}
          </button>
        </div>
        <ManageError state={state} />
      </form>
      <ActionButton
        action={removeAssignment}
        fields={{ groupId, assignmentId }}
        label={t('remove')}
        ariaLabel={t('removeLesson', { lesson: lessonTitle })}
        danger
      />
    </div>
  )
}

export type MemberOption = { readonly userId: string; readonly label: string }

export function AddMemberForm({
  groupId,
  candidates,
}: {
  groupId: string
  candidates: readonly MemberOption[]
}) {
  const t = useTranslations('trainer.members')
  const [state, action, pending] = useActionState<ManageState, FormData>(addGroupMember, {})
  if (candidates.length === 0) return <p className="text-sm text-slate-600">{t('noCandidates')}</p>
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Hidden fields={{ groupId }} />
      <LabeledField label={t('addExisting')} className="min-w-56 flex-1">
        {(p) => (
          <select {...p} name="userId" required className={inputClass}>
            {candidates.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </LabeledField>
      <button type="submit" className={btnSecondary} disabled={pending}>
        {t('add')}
      </button>
      <div className="w-full">
        <ManageError state={state} />
      </div>
    </form>
  )
}

export function GroupInvitationForm({ groupId }: { groupId: string }) {
  const t = useTranslations('trainer.members')
  const [state, action, pending] = useActionState<InvitationState, FormData>(
    createGroupInvitation,
    {},
  )
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <Hidden fields={{ groupId }} />
        <LabeledField
          label={t('inviteNote')}
          hint={t('inviteNoteHint')}
          className="min-w-56 flex-1"
        >
          {(p) => <input {...p} name="note" maxLength={120} className={inputClass} />}
        </LabeledField>
        <button type="submit" className={`${btnSecondary} mb-5`} disabled={pending}>
          {t('createInvite')}
        </button>
      </form>
      <ManageError state={state} />
      {state.link && <OneTimeLink label={t('inviteLink')} link={state.link} />}
    </div>
  )
}

export function ResetPasswordButton({ userId, name }: { userId: string; name: string }) {
  const t = useTranslations('trainer.members')
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {})
  return (
    <div className="flex flex-col items-start gap-1">
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm(t('resetConfirm', { name }))) e.preventDefault()
        }}
      >
        <Hidden fields={{ userId }} />
        <button
          type="submit"
          className={btnSecondary}
          disabled={pending}
          aria-label={t('resetFor', { name })}
        >
          {t('reset')}
        </button>
      </form>
      <ManageError state={state} />
      {state.password && (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          role="status"
          data-testid="new-password"
        >
          {t('newPassword', { login: state.login ?? '' })}{' '}
          <strong className="font-mono text-base" data-testid="new-password-value">
            {state.password}
          </strong>
          <br />
          <span className="text-xs">{t('passwordOnce')}</span>
        </p>
      )}
    </div>
  )
}

export function BulkAccountsForm({
  groupId,
  groupName,
  max,
  loginUrl,
}: {
  groupId: string
  groupName: string
  max: number
  loginUrl: string
}) {
  const t = useTranslations('trainer.bulk')
  const [state, action, pending] = useActionState<BulkState, FormData>(bulkCreateAccounts, {})
  const created = state.created ?? []
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3" data-testid="bulk-form">
        <Hidden fields={{ groupId }} />
        <LabeledField label={t('names')} hint={t('namesHint', { max })}>
          {(p) => (
            <textarea
              {...p}
              name="names"
              rows={6}
              required
              className={`${inputClass} font-sans`}
              spellCheck={false}
            />
          )}
        </LabeledField>
        <ManageError state={state} />
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? t('creating') : t('create')}
        </button>
      </form>

      {created.length > 0 && (
        <div className="vk-print-area space-y-3" data-testid="bulk-result">
          <div className="flex flex-wrap items-center justify-between gap-3" data-print-hide>
            <p className="text-sm font-medium text-emerald-900" role="status">
              {t('created', { count: created.length })}
            </p>
            <button type="button" className={btnSecondary} onClick={() => window.print()}>
              {t('print')}
            </button>
          </div>
          <p className="text-sm text-amber-900" data-print-hide>
            {t('passwordsOnce')}
          </p>
          <h3 className="hidden text-lg font-semibold print:block">
            {t('printTitle', { group: groupName })}
          </h3>
          <div className="relative overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  <th scope="col" className="py-2 pr-4">
                    {t('colName')}
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    {t('colLogin')}
                  </th>
                  <th scope="col" className="py-2">
                    {t('colPassword')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {created.map((c) => (
                  <tr key={c.login} className="border-b border-slate-200" data-testid="bulk-row">
                    <td className="py-2 pr-4">{c.name}</td>
                    <td className="py-2 pr-4 font-mono" data-testid="bulk-login">
                      {c.login}
                    </td>
                    <td className="py-2 font-mono" data-testid="bulk-password">
                      {c.password}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hidden text-sm print:block">{t('printHint', { url: loginUrl })}</p>
        </div>
      )}
    </div>
  )
}
