'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useId, type ReactNode } from 'react'
import { btnPrimary, focusRing, panel } from '@/components/ui'
import { createAccountAndJoin, joinExisting, signIn, type FormState } from '@/lib/auth/actions'

const input = `mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base ${focusRing}`

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: (props: { id: string; 'aria-describedby'?: string }) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, ...(hint ? { 'aria-describedby': hintId } : {}) })}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-600">
          {hint}
        </p>
      )}
    </div>
  )
}

export function FormError({ code }: { code?: string }) {
  const t = useTranslations('auth.errors')
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

export function SignInForm({ next }: { next?: string }) {
  const t = useTranslations('auth.signIn')
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {})
  return (
    <form action={action} className="space-y-4" data-testid="sign-in-form">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={t('login')}>
        {(p) => (
          <input
            {...p}
            name="login"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={state.values?.login}
            className={input}
          />
        )}
      </Field>
      <Field label={t('password')}>
        {(p) => (
          <input
            {...p}
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={input}
          />
        )}
      </Field>
      <FormError code={state.error} />
      <button type="submit" className={btnPrimary} disabled={pending}>
        {t('submit')}
      </button>
    </form>
  )
}

type JoinKind = 'code' | 'invitation' | 'platform'

export function CreateAccountForm({ kind, secret }: { kind: JoinKind; secret: string }) {
  const t = useTranslations('auth.create')
  const [state, action, pending] = useActionState<FormState, FormData>(createAccountAndJoin, {})
  return (
    <form action={action} className="space-y-4" data-testid="create-account-form">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="secret" value={secret} />
      <Field label={t('displayName')} hint={t('displayNameHint')}>
        {(p) => (
          <input
            {...p}
            name="displayName"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            defaultValue={state.values?.displayName}
            className={input}
          />
        )}
      </Field>
      <Field label={t('login')} hint={t('loginHint')}>
        {(p) => (
          <input
            {...p}
            name="login"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={state.values?.login}
            className={input}
          />
        )}
      </Field>
      <Field label={t('password')} hint={t('passwordHint')}>
        {(p) => (
          <input
            {...p}
            name="password"
            type="password"
            required
            minLength={6}
            maxLength={72}
            autoComplete="new-password"
            className={input}
          />
        )}
      </Field>
      <Field label={t('password2')}>
        {(p) => (
          <input
            {...p}
            name="password2"
            type="password"
            required
            minLength={6}
            maxLength={72}
            autoComplete="new-password"
            className={input}
          />
        )}
      </Field>
      <FormError code={state.error} />
      <p className="text-xs text-slate-600">{t('privacy')}</p>
      <button type="submit" className={btnPrimary} disabled={pending}>
        {t('submit')}
      </button>
    </form>
  )
}

export function JoinExistingForm({
  kind,
  secret,
  label,
}: {
  kind: JoinKind
  secret: string
  label: string
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(joinExisting, {})
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="secret" value={secret} />
      <FormError code={state.error} />
      <button type="submit" className={btnPrimary} disabled={pending}>
        {label}
      </button>
    </form>
  )
}

/** Úzký sloupec pro formuláře přihlášení a připojení. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:px-0">
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      <div className={`${panel} space-y-5 p-6`}>{children}</div>
    </main>
  )
}
