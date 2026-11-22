'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useId, useRef, type ReactNode } from 'react'
import { inputClass } from '@/components/manage/ManageUi'
import { btnPrimary, focusRing } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { submitPilotRequest, type PilotState } from '@/lib/pilot/actions'
import { PILOT_LIMITS, type PilotField } from '@/lib/pilot/validate'

const SEGMENTS = ['company', 'school'] as const
const SEGMENT_FIELD: PilotField = 'segment'
const CONSENT_FIELD: PilotField = 'consent'
const CONSENT_INVALID = { 'aria-invalid': true, 'aria-describedby': 'pilot-consent-err' } as const

/** Pole formuláře s popiskem a chybou propojenou pro čtečky obrazovky. */
function Field({
  name,
  label,
  invalid,
  className = '',
  children,
}: {
  name: PilotField
  label: string
  invalid: boolean
  className?: string
  children: (p: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode
}) {
  const t = useTranslations('pilot.fields')
  const id = useId()
  const errId = `${id}-err`
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, ...(invalid ? { 'aria-invalid': true, 'aria-describedby': errId } : {}) })}
      {invalid && (
        <p id={errId} className="mt-1 text-sm text-red-800">
          {t(name)}
        </p>
      )}
    </div>
  )
}

/** Formulář „Chci pilot“ (D-030). Ukládá se přes serverovou akci, upozornění jde e-mailem. */
export function PilotForm() {
  const t = useTranslations('pilot')
  const tf = useTranslations('pilot.fields')
  const [state, action, pending] = useActionState<PilotState, FormData>(submitPilotRequest, {})
  const started = useRef<HTMLInputElement>(null)
  const summary = useRef<HTMLParagraphElement>(null)
  const done = useRef<HTMLParagraphElement>(null)
  const bad = new Set(state.fields ?? [])
  const v = state.values ?? {}
  const segBad = bad.has(SEGMENT_FIELD)
  const consentBad = bad.has(CONSENT_FIELD)

  // Čas otevření formuláře (past na roboty); po každém odeslání se nastaví znovu.
  useEffect(() => {
    if (started.current) started.current.value = String(Date.now())
  }, [state])
  useEffect(() => {
    if (state.ok) done.current?.focus()
    else if (state.error || state.fields?.length) summary.current?.focus()
  }, [state])

  if (state.ok) {
    return (
      <p
        ref={done}
        tabIndex={-1}
        role="status"
        className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-900"
        data-testid="pilot-success"
      >
        {t('success')}
      </p>
    )
  }

  const err = state.error ? t(`errors.${state.error}` as 'errors.SERVER') : null
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" data-testid="pilot-form" noValidate>
      {err || bad.size ? (
        <p
          ref={summary}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-2"
          data-testid="pilot-error"
        >
          {err ?? t('fieldErrors')}
        </p>
      ) : null}

      <fieldset className="sm:col-span-2" aria-describedby={segBad ? 'pilot-seg-err' : undefined}>
        <legend className="mb-1 text-sm font-medium text-ink">{t('segment')}</legend>
        <div className="flex flex-wrap gap-3">
          {SEGMENTS.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 has-[:checked]:border-accent has-[:checked]:bg-blue-50"
            >
              <input
                type="radio"
                name="segment"
                value={s}
                defaultChecked={s === (v.segment ?? 'company')}
                className={focusRing}
              />
              {t(`segments.${s}`)}
            </label>
          ))}
        </div>
        {segBad && (
          <p id="pilot-seg-err" className="mt-1 text-sm text-red-800">
            {tf('segment')}
          </p>
        )}
      </fieldset>

      <Field name="name" label={t('name')} invalid={bad.has('name')}>
        {(p) => (
          <input
            {...p}
            name="name"
            defaultValue={v.name}
            autoComplete="name"
            required
            maxLength={PILOT_LIMITS.name[1]}
            className={inputClass}
          />
        )}
      </Field>
      <Field name="organization" label={t('organization')} invalid={bad.has('organization')}>
        {(p) => (
          <input
            {...p}
            name="organization"
            defaultValue={v.organization}
            autoComplete="organization"
            required
            maxLength={PILOT_LIMITS.organization[1]}
            className={inputClass}
          />
        )}
      </Field>
      <Field name="email" label={t('email')} invalid={bad.has('email')}>
        {(p) => (
          <input
            {...p}
            name="email"
            defaultValue={v.email}
            type="email"
            autoComplete="email"
            required
            maxLength={PILOT_LIMITS.email}
            className={inputClass}
          />
        )}
      </Field>
      <Field name="phone" label={t('phone')} invalid={bad.has('phone')}>
        {(p) => (
          <input
            {...p}
            name="phone"
            defaultValue={v.phone}
            type="tel"
            autoComplete="tel"
            maxLength={30}
            className={inputClass}
          />
        )}
      </Field>
      <Field
        name="headcount"
        label={t('headcount')}
        invalid={bad.has('headcount')}
        className="sm:col-span-2"
      >
        {(p) => (
          <input
            {...p}
            name="headcount"
            defaultValue={v.headcount}
            inputMode="numeric"
            maxLength={7}
            className={`${inputClass} sm:max-w-48`}
          />
        )}
      </Field>
      <Field
        name="message"
        label={t('message')}
        invalid={bad.has('message')}
        className="sm:col-span-2"
      >
        {(p) => (
          <textarea
            {...p}
            name="message"
            defaultValue={v.message}
            rows={4}
            maxLength={PILOT_LIMITS.message}
            className={inputClass}
          />
        )}
      </Field>

      {/* Past na roboty: člověk pole nevidí ani na něj nedojde tabulátorem. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          {t('honeypot')}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input ref={started} type="hidden" name="startedAt" defaultValue="" />

      <div className="sm:col-span-2">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="consent"
            required
            defaultChecked={v.consent === 'on'}
            className={`mt-1 ${focusRing}`}
            {...(consentBad ? CONSENT_INVALID : {})}
          />
          <span>
            {t('consent')}{' '}
            <Link href="/zasady" className={`text-accent underline ${focusRing}`}>
              {t('consentLink')}
            </Link>
          </span>
        </label>
        {consentBad && (
          <p id="pilot-consent-err" className="mt-1 text-sm text-red-800">
            {tf('consent')}
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        <button type="submit" className={btnPrimary} disabled={pending} data-testid="pilot-submit">
          {pending ? t('sending') : t('submit')}
        </button>
      </div>
    </form>
  )
}

/** Odkaz na formulář, který zároveň předvybere firmu, nebo školu. */
export function PilotCta({
  segment,
  className,
  children,
}: {
  segment: 'company' | 'school'
  className: string
  children: ReactNode
}) {
  return (
    <a
      href="#pilot"
      className={className}
      data-testid={`pilot-cta-${segment}`}
      onClick={() => {
        const radio = document.querySelector<HTMLInputElement>(
          `#pilot input[name="segment"][value="${segment}"]`,
        )
        if (radio) radio.checked = true
      }}
    >
      {children}
    </a>
  )
}
