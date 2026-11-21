/**
 * Typy obsahu: modul → lekce → úvodní obrazovky a plán úloh. Jen data, žádné texty: texty jsou
 * v aplikaci (`messages/*.json`) pod klíči odvozenými ze slugů a id.
 */
import type { AssignViewsTask, Difficulty, ExerciseKind } from '@vykresovna/exercises'

/** Popis součásti (typ z kontraktu úloh, aby obsah nezávisel přímo na enginu). */
export type PartSpec = AssignViewsTask['part']

/** Pojmy, které umí úvod lekce zvýraznit (texty: `lessons.terms.<term>`). */
export type FeatureTerm = 'throughHole' | 'blindHole' | 'slot' | 'step' | 'chamfer' | 'cutout'

export type IntroFeature = {
  /** Id prvku v popisu součásti. */
  readonly featureId: string
  readonly term: FeatureTerm
}

/** Živý 3D prvek úvodní obrazovky. */
export type IntroDemo =
  /** Animace rozložení průměten do roviny výkresu. */
  | { readonly kind: 'unfold' }
  /**
   * 3D model vedle výkresu, najetí na hranu zvýrazní tutéž hranu na druhé straně.
   * `xray`: rentgen zapnutý od začátku; `reveal`: model je nejdřív skrytý (nejdřív číst výkres);
   * `features`: tlačítka, která zvýrazní vybrané prvky.
   */
  | {
      readonly kind: 'linked'
      readonly xray?: boolean
      readonly reveal?: boolean
      readonly features?: readonly IntroFeature[]
    }

export type IntroScreen = {
  /** Id obrazovky v rámci lekce (texty: `lessons.items.<slug>.intro.<id>.title|text`). */
  readonly id: string
  readonly part: PartSpec
  readonly demo: IntroDemo
}

/** Položka plánu úloh: `count` úloh daného typu a obtížnosti. */
export type TaskPlanItem = {
  readonly kind: ExerciseKind
  readonly difficulty: Difficulty
  readonly count: number
}

export type LessonStatus = 'available' | 'coming-soon'

export type Lesson = {
  /** Slug v URL (`/lekce/<slug>`), zároveň klíč textů `lessons.items.<slug>`. */
  readonly slug: string
  readonly status: LessonStatus
  readonly intro: readonly IntroScreen[]
  readonly plan: readonly TaskPlanItem[]
}

export type Module = {
  /** Slug modulu (texty: `modules.<slug>`). */
  readonly slug: string
  readonly lessons: readonly Lesson[]
}

/** Pevně daná úloha (demo): stejný seed = stejná úloha. */
export type FixedTask = {
  readonly kind: ExerciseKind
  readonly seed: number
  readonly difficulty: Difficulty
}
