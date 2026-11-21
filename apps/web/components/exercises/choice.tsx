'use client'

import type { ChoiceOption, TaskResult } from '@vykresovna/exercises'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { focusRing } from '@/components/ui'
import { CheckIcon, CrossIcon } from './icons'

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export const letterOf = (i: number) => OPTION_LETTERS[i] ?? String(i + 1)

export type ChoiceState = { chosenId: string; result: TaskResult } | null

/** Stav možnosti po odpovědi: správná / zvolená špatná / ostatní. */
export function optionStatus(option: ChoiceOption, state: ChoiceState) {
  if (!state) return null
  if (option.errorCode === null) return 'correct' as const
  if (option.id === state.chosenId) return 'wrong' as const
  return 'other' as const
}

/** Karta možnosti ve výběru 1 ze 4: obsah (výkres nebo 3D) a tlačítko s písmenem. */
export function OptionCard({
  index,
  label,
  status,
  chosen,
  disabled,
  onChoose,
  optionId,
  children,
  buttonBelow = false,
}: {
  index: number
  label: string
  status: ReturnType<typeof optionStatus>
  chosen: boolean
  disabled: boolean
  onChoose: () => void
  optionId: string
  children: ReactNode
  /** Obsah není součástí tlačítka (např. 3D model, který se otáčí tažením). */
  buttonBelow?: boolean
}) {
  const t = useTranslations('exercises')
  const border =
    status === 'correct'
      ? 'border-green-700'
      : status === 'wrong'
        ? 'border-red-700'
        : 'border-slate-300'
  const badge = (
    <span className="flex items-center gap-1.5 text-sm font-semibold">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs text-white">
        {letterOf(index)}
      </span>
      {status === 'correct' ? (
        <span className="flex items-center gap-1 text-green-800">
          <CheckIcon className="h-4 w-4" />
          {t('correctOption')}
          {chosen ? ` (${t('chosen')})` : ''}
        </span>
      ) : null}
      {status === 'wrong' ? (
        <span className="flex items-center gap-1 text-red-800">
          <CrossIcon className="h-4 w-4" />
          {t('chosen')}
        </span>
      ) : null}
    </span>
  )
  const fullLabel = [
    label,
    status === 'correct' ? t('correctOption') : null,
    chosen ? t('chosen') : null,
  ]
    .filter(Boolean)
    .join(', ')
  const common = {
    'data-testid': 'option',
    'data-option-id': optionId,
    'data-status': status ?? undefined,
  }
  if (buttonBelow) {
    return (
      <div {...common} className={`flex flex-col overflow-hidden rounded-lg border-2 bg-white ${border}`}>
        {children}
        <button
          type="button"
          onClick={onChoose}
          disabled={disabled}
          aria-label={fullLabel}
          className={`flex w-full items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-left enabled:hover:bg-slate-50 disabled:cursor-default ${focusRing}`}
          data-testid="option-button"
        >
          {badge}
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      {...common}
      onClick={onChoose}
      disabled={disabled}
      aria-label={fullLabel}
      className={`flex flex-col gap-1 rounded-lg border-2 bg-white p-2 text-left enabled:hover:border-slate-500 disabled:cursor-default ${border} ${focusRing}`}
    >
      {badge}
      {children}
    </button>
  )
}
