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
import type { ManageState } from '@/lib/manage/server'
import {
  createAdminInvitation,
  createOrganization,
  updateLicense,
  type AdminInvitationState,
  type CreateOrgState,
} from '@/lib/platform/actions'

export function CreateOrgForm({ defaultValidUntil }: { defaultValidUntil: string }) {
  const t = useTranslations('platform.create')
  const [state, action, pending] = useActionState<CreateOrgState, FormData>(createOrganization, {})
  return (
    <div className="space-y-4">
      <form
        action={action}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        data-testid="create-org"
      >
        <LabeledField label={t('name')} className="lg:col-span-2">
          {(p) => (
            <input
              {...p}
              name="name"
              required
              minLength={2}
              maxLength={120}
              className={inputClass}
            />
          )}
        </LabeledField>
        <LabeledField label={t('kind')}>
          {(p) => (
            <select {...p} name="kind" defaultValue="company" className={inputClass}>
              <option value="company">{t('company')}</option>
              <option value="school">{t('school')}</option>
            </select>
          )}
        </LabeledField>
        <LabeledField label={t('seats')}>
          {(p) => (
            <input
              {...p}
              name="seats"
              type="number"
              min={0}
              max={100000}
              defaultValue={30}
              required
              className={inputClass}
            />
          )}
        </LabeledField>
        <LabeledField label={t('validUntil')}>
          {(p) => (
            <input
              {...p}
              name="validUntil"
              type="date"
              defaultValue={defaultValidUntil}
              required
              className={inputClass}
            />
          )}
        </LabeledField>
        <div className="sm:col-span-2 lg:col-span-5">
          <button type="submit" className={btnPrimary} disabled={pending}>
            {t('submit')}
          </button>
        </div>
      </form>
      <ManageError state={state} />
      {state.orgId && (
        <div
          className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4"
          role="status"
        >
          <p className="text-sm font-medium text-emerald-900">
            {t('created', { name: state.orgName ?? '' })}
          </p>
          <AdminInvitationForm orgId={state.orgId} key={state.orgId} />
        </div>
      )}
    </div>
  )
}

export function AdminInvitationForm({ orgId }: { orgId: string }) {
  const t = useTranslations('platform.invite')
  const [state, action, pending] = useActionState<AdminInvitationState, FormData>(
    createAdminInvitation,
    {},
  )
  return (
    <div className="space-y-2">
      <form action={action}>
        <Hidden fields={{ orgId }} />
        <button type="submit" className={btnSecondary} disabled={pending}>
          {t('create')}
        </button>
      </form>
      <ManageError state={state} />
      {state.link && <OneTimeLink label={t('link')} link={state.link} />}
    </div>
  )
}

export function LicenseForm({
  orgId,
  seats,
  validUntil,
  orgName,
}: {
  orgId: string
  seats: number
  validUntil: string
  orgName: string
}) {
  const t = useTranslations('platform.license')
  const [state, action, pending] = useActionState<ManageState, FormData>(updateLicense, {})
  return (
    <form action={action} className="space-y-2">
      <Hidden fields={{ orgId }} />
      <div className="flex flex-wrap items-end gap-2">
        <LabeledField label={t('seats')}>
          {(p) => (
            <input
              {...p}
              name="seats"
              type="number"
              min={0}
              max={100000}
              defaultValue={seats}
              required
              className={`${inputClass} w-28`}
              aria-label={t('seatsFor', { org: orgName })}
            />
          )}
        </LabeledField>
        <LabeledField label={t('validUntil')}>
          {(p) => (
            <input
              {...p}
              name="validUntil"
              type="date"
              defaultValue={validUntil}
              required
              className={inputClass}
              aria-label={t('validUntilFor', { org: orgName })}
            />
          )}
        </LabeledField>
        <button type="submit" className={btnSecondary} disabled={pending}>
          {t('save')}
        </button>
      </div>
      <ManageError state={state} />
      {state.ok && (
        <p role="status" className="text-sm text-emerald-800">
          {t('saved')}
        </p>
      )}
    </form>
  )
}
