'use client'

import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import {
  Hidden,
  inputClass,
  LabeledField,
  ManageError,
  OneTimeLink,
} from '@/components/manage/ManageUi'
import { btnPrimary, btnSecondary } from '@/components/ui'
import type { OrgRole } from '@/lib/auth/viewer'
import type { ManageState } from '@/lib/manage/server'
import {
  changeMemberRole,
  createOrgInvitation,
  renameOrganization,
  type OrgInvitationState,
} from '@/lib/org-admin/actions'

const ROLES: readonly OrgRole[] = ['participant', 'trainer', 'org_admin']

export function RenameOrgForm({ orgId, name }: { orgId: string; name: string }) {
  const t = useTranslations('orgAdmin.org')
  const [state, action, pending] = useActionState<ManageState, FormData>(renameOrganization, {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Hidden fields={{ orgId }} />
      <LabeledField label={t('name')} className="min-w-56 flex-1">
        {(p) => (
          <input
            {...p}
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={name}
            className={inputClass}
          />
        )}
      </LabeledField>
      <button type="submit" className={btnSecondary} disabled={pending}>
        {t('rename')}
      </button>
      <div className="w-full">
        <ManageError state={state} />
        {state.ok && (
          <p role="status" className="text-sm text-emerald-800">
            {t('saved')}
          </p>
        )}
      </div>
    </form>
  )
}

export function MemberRoleForm({
  orgId,
  userId,
  role,
  name,
}: {
  orgId: string
  userId: string
  role: OrgRole
  name: string
}) {
  const t = useTranslations('orgAdmin.members')
  const tr = useTranslations('roles')
  const [state, action, pending] = useActionState<ManageState, FormData>(changeMemberRole, {})
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <Hidden fields={{ orgId, userId }} />
      <div className="flex items-center gap-2">
        <select
          name="role"
          defaultValue={role}
          aria-label={t('roleFor', { name })}
          className={`${inputClass} w-auto min-w-44 py-1 text-sm`}
          data-testid="role-select"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {tr(r)}
            </option>
          ))}
        </select>
        <button type="submit" className={btnSecondary} disabled={pending}>
          {t('saveRole')}
        </button>
      </div>
      <ManageError state={state} />
    </form>
  )
}

export function OrgInvitationForm({
  orgId,
  groups,
}: {
  orgId: string
  groups: readonly { id: string; name: string }[]
}) {
  const t = useTranslations('orgAdmin.invitations')
  const tr = useTranslations('roles')
  const [state, action, pending] = useActionState<OrgInvitationState, FormData>(
    createOrgInvitation,
    {},
  )
  return (
    <div className="space-y-3">
      <form
        action={action}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="org-invitation-form"
      >
        <Hidden fields={{ orgId }} />
        <LabeledField label={t('role')}>
          {(p) => (
            <select {...p} name="role" defaultValue="participant" className={inputClass}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {tr(r)}
                </option>
              ))}
            </select>
          )}
        </LabeledField>
        <LabeledField label={t('group')}>
          {(p) => (
            <select {...p} name="groupId" defaultValue="" className={inputClass}>
              <option value="">{t('noGroup')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </LabeledField>
        <LabeledField label={t('note')} hint={t('noteHint')}>
          {(p) => <input {...p} name="note" maxLength={120} className={inputClass} />}
        </LabeledField>
        <div className="flex items-start sm:pt-6">
          <button type="submit" className={btnPrimary} disabled={pending}>
            {t('create')}
          </button>
        </div>
      </form>
      <ManageError state={state} />
      {state.link && <OneTimeLink label={t('link')} link={state.link} />}
    </div>
  )
}
