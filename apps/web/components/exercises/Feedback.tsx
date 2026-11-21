'use client'

import type { ErrorCode, TaskResult } from '@vykresovna/exercises'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, type ReactNode } from 'react'
import { btnPrimary } from '@/components/ui'
import { CheckIcon, CrossIcon } from './icons'

type Props = {
  result: TaskResult | null
  /** Doplňující řádek pod nadpisem (např. „Správně máte 2 z 3“). */
  detail?: string
  /** Správná odpověď nebo jiné vysvětlení, zobrazí se jen při chybě. */
  correctAnswer?: ReactNode
  onNext: () => void
  nextLabel: string
}

/** Unikátní kódy chyb v pořadí, jak přišly. */
export function uniqueCodes(result: TaskResult): ErrorCode[] {
  return [...new Set(result.errors.map((e) => e.code))]
}

/**
 * Zpětná vazba k úloze: správně / špatně (ikona + text, ne jen barva), vysvětlení chyb vlastními
 * slovy, při chybě správná odpověď a tlačítko na další úlohu. Oznamuje se přes aria-live.
 */
export function Feedback({ result, detail, correctAnswer, onNext, nextLabel }: Props) {
  const t = useTranslations('exercises')
  const next = useRef<HTMLButtonElement>(null)
  // po vyhodnocení přesunout fokus na „Další úloha“ (tlačítko Zkontrolovat zmizí)
  const answered = result !== null
  useEffect(() => {
    if (answered) next.current?.focus()
  }, [answered])
  return (
    <div data-testid="feedback-region">
      <p className="sr-only" role="status" aria-live="polite">
        {result
          ? [
              result.correct ? t('result.correct') : t('result.incorrect'),
              detail ?? '',
              ...(result.correct ? [] : uniqueCodes(result).map((c) => t(`errors.${c}`))),
            ].join(' ')
          : ''}
      </p>
      {result ? (
        <section
          data-testid="feedback"
          data-correct={String(result.correct)}
          className={`flex flex-col gap-3 rounded-lg border-2 p-4 ${
            result.correct ? 'border-green-700 bg-green-50' : 'border-red-700 bg-red-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className={result.correct ? 'text-green-700' : 'text-red-700'}>
              {result.correct ? (
                <CheckIcon className="h-7 w-7" />
              ) : (
                <CrossIcon className="h-7 w-7" />
              )}
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold">
                {result.correct ? t('result.correct') : t('result.incorrect')}
              </h3>
              <p className="text-sm">{detail ?? (result.correct ? t('result.correctText') : '')}</p>
            </div>
          </div>
          {!result.correct && result.errors.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-semibold">{t('result.errorsTitle')}</h4>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                {uniqueCodes(result).map((code) => (
                  <li key={code} data-error-code={code}>
                    {t(`errors.${code}`)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!result.correct && correctAnswer ? (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold">{t('result.showCorrect')}</h4>
              {correctAnswer}
            </div>
          ) : null}
          <div>
            <button
              ref={next}
              type="button"
              className={btnPrimary}
              onClick={onNext}
              data-testid="next"
            >
              {nextLabel}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
