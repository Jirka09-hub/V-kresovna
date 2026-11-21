'use client'

import { useTranslations } from 'next-intl'

type LineProps = { dash?: string; width: number; color?: string }
const VISIBLE: LineProps = { width: 2 }
const HIDDEN: LineProps = { width: 1, dash: '6 2' }
const CENTER: LineProps = { width: 1, dash: '10 2 1 2' }
const HIGHLIGHT: LineProps = { width: 2.5, color: '#1d4ed8' }

/** Legenda čar výkresu: čáry se liší vzorem, ne jen barvou. */
export function Legend({ highlight = false }: { highlight?: boolean }) {
  const t = useTranslations('exercises.legend')
  const line = (props: LineProps) => (
    <svg width="32" height="6" aria-hidden="true">
      <line
        x1="0"
        y1="3"
        x2="32"
        y2="3"
        stroke={props.color ?? '#111'}
        strokeWidth={props.width}
        strokeDasharray={props.dash}
      />
    </svg>
  )
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <li className="flex items-center gap-2">
        {line(VISIBLE)}
        {t('visible')}
      </li>
      <li className="flex items-center gap-2">
        {line(HIDDEN)}
        {t('hidden')}
      </li>
      <li className="flex items-center gap-2">
        {line(CENTER)}
        {t('center')}
      </li>
      {highlight ? (
        <li className="flex items-center gap-2">
          {line(HIGHLIGHT)}
          {t('highlight')}
        </li>
      ) : null}
    </ul>
  )
}
