'use client'

import type { ViewsSvg } from '@/lib/engine/protocol'
import { DrawingSvg } from './DrawingSvg'

/** Velikost buňky v mm: všechny pohledy v mřížce se kreslí ve stejném měřítku. */
export type Cell = { readonly width: number; readonly height: number }

/** Buňka, do které se vejde každý z výkresů (největší šířka a výška). */
export function cellFor(drawings: readonly ViewsSvg[]): Cell {
  return {
    width: Math.max(1, ...drawings.map((d) => d.width)),
    height: Math.max(1, ...drawings.map((d) => d.height)),
  }
}

type Props = {
  drawing: ViewsSvg
  cell: Cell
  label: string
  highlightIds?: ReadonlySet<string> | null
  className?: string
}

/**
 * Pohled vycentrovaný v buňce pevného poměru stran. Šířka se počítá jako podíl šířky buňky,
 * takže pohledy v sousedních buňkách mají stejné měřítko a zůstávají zarovnané (promítací vazby).
 */
export function ScaledView({ drawing, cell, label, highlightIds, className = '' }: Props) {
  return (
    <div
      className={`flex w-full items-center justify-center ${className}`}
      style={{ aspectRatio: `${cell.width} / ${cell.height}` }}
    >
      <DrawingSvg
        svg={drawing.svg}
        label={label}
        highlightIds={highlightIds ?? null}
        style={{ width: `${(drawing.width / cell.width) * 100}%` }}
      />
    </div>
  )
}
