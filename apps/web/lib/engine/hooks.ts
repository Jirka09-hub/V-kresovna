'use client'

import type { ViewName } from '@vykresovna/drafting-standards'
import type { PartRenderData, PartSpec } from '@vykresovna/engine'
import type {
  ChoiceOption,
  Difficulty,
  DrawingMutation,
  ErrorCode,
  ExerciseKind,
  Task,
} from '@vykresovna/exercises'
import { useEffect, useState } from 'react'
import { generateTask, renderOption, renderPart, renderViews } from './client'
import type { ViewsSvg } from './protocol'

export type AsyncState<T> = { data: T | null; error: string | null; loading: boolean }

/**
 * Výsledek asynchronní funkce podle klíče. Když se klíč změní, starý výsledek se zahodí.
 * `key === null` = zatím nic nepočítat.
 */
export function useAsync<T>(key: string | null, factory: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<{ key: string; data?: T; error?: string } | null>(null)
  useEffect(() => {
    if (key === null) return
    let alive = true
    factory()
      .then((data) => alive && setState({ key, data }))
      .catch(
        (e: unknown) =>
          alive && setState({ key, error: e instanceof Error ? e.message : String(e) }),
      )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- factory se mění s klíčem
  }, [key])
  const current = key !== null && state?.key === key ? state : null
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: key !== null && current === null,
  }
}

/** Úloha ze seedu (generuje se ve workeru). */
export function useTask(
  kind: ExerciseKind,
  seed: number,
  difficulty: Difficulty,
  focus?: ErrorCode,
) {
  return useAsync<Task>(`${kind}:${seed}:${difficulty}:${focus ?? ''}`, () =>
    generateTask(kind, seed, difficulty, focus),
  )
}

/** 3D data a výkres několika součástí (pořadí odpovídá vstupu). */
export function useRenderParts(parts: readonly PartSpec[] | null) {
  return useAsync<PartRenderData[]>(parts ? JSON.stringify(parts) : null, () =>
    Promise.all((parts ?? []).map((p) => renderPart(p))),
  )
}

export type ViewsRequest =
  | {
      readonly part: PartSpec
      readonly views: readonly ViewName[]
      readonly mutation?: DrawingMutation
    }
  /** Možnost úlohy (výkres s mutací podle generátoru). */
  | { readonly option: ChoiceOption; readonly views: readonly ViewName[] }

/** SVG pohledů pro několik požadavků najednou (pořadí odpovídá vstupu). */
export function useViewsSvgs(requests: readonly ViewsRequest[] | null) {
  return useAsync<ViewsSvg[]>(requests ? JSON.stringify(requests) : null, () =>
    Promise.all(
      (requests ?? []).map((r) =>
        'option' in r
          ? renderOption(r.option, r.views)
          : renderViews(r.part, r.views, r.mutation ? { mutation: r.mutation } : {}),
      ),
    ),
  )
}
