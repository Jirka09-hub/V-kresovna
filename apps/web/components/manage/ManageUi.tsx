'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { btnSecondary, focusRing } from '@/components/ui'
import type { ManageState } from '@/lib/manage/server'

/** Sdílené prvky stránek správy (školitel, správce organizace, platforma), D-028. */

export const inputClass = `block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base ${focusRing}`
export const btnDanger = `inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`

export type Action<S extends ManageState> = (prev: S, fd: FormData) => Promise<S>

/** Chybová hláška: nejdřív `manage.errors`, pak `auth.errors`, jinak obecná. */
export function ManageError({ state }: { state: ManageState }) {
  const tm = useTranslations('manage.errors')
  const ta = useTranslations('auth.errors')
  if (!state.error) return null
  const code = state.error
  const text = tm.has(code)
    ? tm(code, { detail: state.detail ?? '' })
    : ta.has(code)
      ? ta(code)
      : ta('UNKNOWN')
  return (
    <p
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {text}
    </p>
  )
}

/** Popisek + pole (id a nápověda propojené pro čtečky). */
export function LabeledField({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  className?: string
  children: (props: { id: string; 'aria-describedby'?: string }) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
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

/** Hodnota k předání (odkaz, kód) s tlačítkem Kopírovat. */
export function CopyField({
  label,
  value,
  testId,
}: {
  label: string
  value: string
  testId?: string
}) {
  const t = useTranslations('manage')
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <LabeledField label={label}>
      {(p) => (
        <div className="flex gap-2">
          <input
            {...p}
            readOnly
            value={value}
            onFocus={(e) => e.currentTarget.select()}
            className={`${inputClass} min-w-0 font-mono text-sm`}
            data-testid={testId}
          />
          <button type="button" onClick={copy} className={`${btnSecondary} shrink-0`}>
            {copied ? t('copied') : t('copy')}
          </button>
          <span className="sr-only" aria-live="polite">
            {copied ? t('copied') : ''}
          </span>
        </div>
      )}
    </LabeledField>
  )
}

/** Jednorázově zobrazený odkaz (pozvánka): po odchodu ze stránky ho už nikdo neuvidí. */
export function OneTimeLink({ label, link }: { label: string; link: string }) {
  const t = useTranslations('manage')
  return (
    <div
      className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3"
      data-testid="one-time-link"
    >
      <CopyField label={label} value={link} testId="one-time-link-value" />
      <p className="text-xs text-emerald-900">{t('linkOnce')}</p>
    </div>
  )
}

/**
 * Malý formulář s jedním tlačítkem (odebrat, archivovat, nový kód…). Skrytá pole předá akci;
 * `confirm` se před odesláním zeptá.
 */
export function ActionButton({
  action,
  fields,
  label,
  confirm,
  danger,
  testId,
  ariaLabel,
}: {
  action: Action<ManageState>
  fields: Record<string, string>
  label: string
  confirm?: string
  danger?: boolean
  testId?: string
  ariaLabel?: string
}) {
  const [state, formAction, pending] = useActionState<ManageState, FormData>(action, {})
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault()
      }}
      className="inline-flex flex-col items-start gap-1"
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className={danger ? btnDanger : btnSecondary}
        data-testid={testId}
        aria-label={ariaLabel}
      >
        {label}
      </button>
      <ManageError state={state} />
    </form>
  )
}

export function Hidden({ fields }: { fields: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  )
}
