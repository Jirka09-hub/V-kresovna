/**
 * Protokol mezi aplikací a Web Workerem enginu. Jen typy: klient je importuje bez kódu enginu,
 * aby se WASM nedostal do hlavního bundlu (D-016).
 */
import type { ViewName } from '@vykresovna/drafting-standards'
import type { PartRenderData, PartSpec } from '@vykresovna/engine'
import type {
  Answer,
  Difficulty,
  DrawingMutation,
  ExerciseKind,
  Task,
  TaskResult,
} from '@vykresovna/exercises'

/** SVG jednoho nebo více pohledů s rozměry výkresu v mm (kvůli stejnému měřítku vedle sebe). */
export type ViewsSvg = {
  readonly svg: string
  /** Šířka a výška výkresu v mm (včetně okraje). */
  readonly width: number
  readonly height: number
}

export type EngineCall =
  | { readonly type: 'render-part'; readonly spec: PartSpec; readonly svgTitle?: string }
  | {
      readonly type: 'generate-task'
      readonly kind: ExerciseKind
      readonly seed: number
      readonly difficulty: Difficulty
    }
  | {
      readonly type: 'render-views'
      readonly spec: PartSpec
      readonly views: readonly ViewName[]
      readonly mutation?: DrawingMutation
      readonly svgTitle?: string
    }
  /** Hodnocení odpovědi (kód `exercises` importuje engine, proto taky ve workeru). */
  | { readonly type: 'evaluate'; readonly task: Task; readonly answer: Answer }

/** Výsledek podle typu požadavku. */
export type EngineResult<C extends EngineCall> = C extends { type: 'render-part' }
  ? PartRenderData
  : C extends { type: 'generate-task' }
    ? Task
    : C extends { type: 'render-views' }
      ? ViewsSvg
      : C extends { type: 'evaluate' }
        ? TaskResult
        : never

export type EngineRequest = { readonly id: number; readonly call: EngineCall }

export type EngineResponse =
  | { readonly id: number; readonly result: unknown }
  | { readonly id: number; readonly error: string }
