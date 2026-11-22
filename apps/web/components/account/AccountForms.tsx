'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useState } from 'react'
import { Field } from '@/components/auth/AuthForms'
import { useViewer } from '@/components/auth/ViewerContext'
import { btnPrimary, btnSecondary, focusRing } from '@/components/ui'
import {
  changePassword,
  deleteAccount,
  leaveOrganization,
  updateDisplayName,
  type AccountFormState,
} from '@/lib/account/actions'
import { DELETE_CONFIRMATION } from '@/lib/account/constants'

const input = `mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base ${focusRing}`
const btnDanger = `inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`

function AccountError({ code }: { code?: string }) {
  const t = useTranslations('account.errors')
  if (!code) return null
  return (
    <p
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {t.has(code) ? t(code) : t('UNKNOWN')}
    </p>
  )
}

function Success({ text }: { text: string }) {
  return (
    <p role="status" className="text-sm font-medium text-green-800">
      {text}
    </p>
  )
}

/** Po úspěšné akci načíst znovu údaje přihlášeného v hlavičce (jméno, organizace). */
function useReloadViewerOnSuccess(state: AccountFormState) {
  const { reload } = useViewer()
  useEffect(() => {
    if (state.ok) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jen při změně výsledku akce
  }, [state])
}

export function DisplayNameForm({ initial }: { initial: string }) {
  const t = useTranslations('account')
  const [state, action, pending] = useActionState<AccountFormState, FormData>(updateDisplayName, {})
  useReloadViewerOnSuccess(state)
  return (
    <form action={action} className="space-y-3" data-testid="name-form">
      <Field label={t('nameLabel')} hint={t('nameHint')}>
        {(p) => (
          <input
            {...p}
            name="displayName"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            defaultValue={state.values?.displayName ?? initial}
            className={input}
          />
        )}
      </Field>
      <AccountError code={state.error} />
      {state.ok ? <Success text={t('nameSaved')} /> : null}
      <button type="submit" className={btnPrimary} disabled={pending}>
        {t('nameSubmit')}
      </button>
    </form>
  )
}

export function PasswordForm({ login }: { login: string | null }) {
  const t = useTranslations('account')
  const [state, action, pending] = useActionState<AccountFormState, FormData>(changePassword, {})
  return (
    // klíč: po úspěchu prázdná pole
    <form
      key={state.ok ? 'ok' : 'form'}
      action={action}
      className="space-y-3"
      data-testid="password-form"
    >
      {/* skryté přihlašovací jméno pomůže správcům hesel uložit nové heslo ke správnému účtu */}
      {login ? (
        <input type="text" name="username" value={login} autoComplete="username" hidden readOnly />
      ) : null}
      <Field label={t('currentPassword')}>
        {(p) => (
          <input
            {...p}
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className={input}
          />
        )}
      </Field>
      <Field label={t('newPassword')} hint={t('newPasswordHint')}>
        {(p) => (
          <input
            {...p}
            name="newPassword"
            type="password"
            required
            minLength={6}
            maxLength={72}
            autoComplete="new-password"
            className={input}
          />
        )}
      </Field>
      <Field label={t('newPassword2')}>
        {(p) => (
          <input
            {...p}
            name="newPassword2"
            type="password"
            required
            autoComplete="new-password"
            className={input}
          />
        )}
      </Field>
      <AccountError code={state.error} />
      {state.ok ? <Success text={t('passwordSaved')} /> : null}
      <button type="submit" className={btnPrimary} disabled={pending}>
        {t('passwordSubmit')}
      </button>
    </form>
  )
}

/** Odchod z organizace s potvrzením (výsledky v organizaci zůstávají jejímu správci). */
export function LeaveOrgButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const t = useTranslations('account')
  const [confirming, setConfirming] = useState(false)
  const [state, action, pending] = useActionState<AccountFormState, FormData>(leaveOrganization, {})
  useReloadViewerOnSuccess(state)
  if (!confirming) {
    return (
      <button
        type="button"
        className={btnSecondary}
        onClick={() => setConfirming(true)}
        data-testid="leave-org"
      >
        {t('leave')}
      </button>
    )
  }
  return (
    <form action={action} className="flex w-full flex-col gap-2 sm:w-auto" data-testid="leave-form">
      <input type="hidden" name="orgId" value={orgId} />
      <p className="max-w-sm text-sm">{t('leaveConfirm', { org: orgName })}</p>
      <AccountError code={state.error} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnDanger} disabled={pending} data-testid="leave-confirm">
          {t('leaveYes')}
        </button>
        <button type="button" className={btnSecondary} onClick={() => setConfirming(false)}>
          {t('leaveNo')}
        </button>
      </div>
    </form>
  )
}

/** Smazání účtu: uživatel musí opsat potvrzovací slovo. */
export function DeleteAccountForm() {
  const t = useTranslations('account')
  const [typed, setTyped] = useState('')
  const [state, action, pending] = useActionState<AccountFormState, FormData>(deleteAccount, {})
  return (
    <form action={action} className="space-y-3" data-testid="delete-form">
      <Field label={t('deleteLabel', { word: DELETE_CONFIRMATION })}>
        {(p) => (
          <input
            {...p}
            name="confirm"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className={input}
          />
        )}
      </Field>
      <AccountError code={state.error} />
      <button
        type="submit"
        className={btnDanger}
        disabled={pending || typed.trim() !== DELETE_CONFIRMATION}
        data-testid="delete-submit"
      >
        {t('deleteSubmit')}
      </button>
    </form>
  )
}
