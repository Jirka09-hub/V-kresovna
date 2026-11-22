'use client'

import type { Vec3 } from '@vykresovna/drafting-standards'
import { useTranslations } from 'next-intl'

export type SectionAxis = 'x' | 'y' | 'z'

/** Stav řezu v laboratoři: zapnutý, osa a poloha roviny (null = střed součásti). */
export type LabSection = { on: boolean; axis: SectionAxis; at: number | null }

const AXES: readonly SectionAxis[] = ['y', 'x', 'z']
const AXIS_INDEX: Record<SectionAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }

/** Krok polohy roviny řezu (mm). */
export const SECTION_STEP_MM = 0.5

/** Poloha roviny: zadaná, jinak střed součásti; vždy uvnitř součásti a na krok 0,5 mm. */
export function sectionPosition(
  section: LabSection,
  bbox: { min: Vec3; max: Vec3 },
): { at: number; min: number; max: number } {
  const i = AXIS_INDEX[section.axis]
  const min = bbox.min[i] + SECTION_STEP_MM
  const max = bbox.max[i] - SECTION_STEP_MM
  const mid = Math.round((bbox.min[i] + bbox.max[i]) / 2 / SECTION_STEP_MM) * SECTION_STEP_MM
  const at = Math.min(max, Math.max(min, section.at ?? mid))
  return { at, min, max }
}

type Props = {
  section: LabSection
  bbox: { min: Vec3; max: Vec3 } | null
  onChange: (section: LabSection) => void
  buttonClass: string
}

/** Ovládání řezu: zapnutí, rovina řezu a posuvník polohy (ovladatelný i klávesnicí). */
export function SectionControls({ section, bbox, onChange, buttonClass }: Props) {
  const t = useTranslations('lab.section')
  const pos = bbox ? sectionPosition(section, bbox) : null
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <legend className="px-1 text-sm font-semibold">{t('title')}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${buttonClass} ${section.on ? 'border-accent bg-blue-50 text-accent' : ''}`}
          aria-pressed={section.on}
          onClick={() => onChange({ ...section, on: !section.on })}
        >
          {t('toggle')}
        </button>
        <div role="radiogroup" aria-label={t('axis')} className="flex flex-wrap gap-2">
          {AXES.map((axis) => (
            <button
              key={axis}
              type="button"
              role="radio"
              aria-checked={section.axis === axis}
              disabled={!section.on}
              className={`${buttonClass} ${section.axis === axis ? 'border-accent bg-blue-50 text-accent' : ''}`}
              onClick={() => onChange({ on: true, axis, at: null })}
            >
              {t(`axis_${axis}`)}
            </button>
          ))}
        </div>
      </div>
      {pos ? (
        <label className="flex flex-col gap-1 text-sm">
          <span>{t('position', { axis: section.axis.toUpperCase(), value: pos.at })}</span>
          <input
            type="range"
            min={pos.min}
            max={pos.max}
            step={SECTION_STEP_MM}
            value={pos.at}
            disabled={!section.on}
            aria-label={t('slider')}
            data-testid="section-slider"
            onChange={(e) => onChange({ ...section, at: Number(e.target.value) })}
          />
        </label>
      ) : null}
      <p className="text-sm text-muted">{t('hint')}</p>
    </fieldset>
  )
}
