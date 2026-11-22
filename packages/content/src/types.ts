/**
 * Typy obsahu: modul → lekce → úvodní obrazovky a plán úloh. Jen data, žádné texty: texty jsou
 * v aplikaci (`messages/*.json`) pod klíči odvozenými ze slugů a id.
 */
import type {
  AssignViewsTask,
  Difficulty,
  DrawingMutation,
  ErrorCode,
  ExerciseKind,
} from '@vykresovna/exercises'

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
  /**
   * 3D model a výkres s jednou chybou (`mutation`). Tlačítko chybu ukáže a přepínač ukáže
   * správný výkres.
   */
  | { readonly kind: 'error-example'; readonly mutation: DrawingMutation }
  /**
   * Živý řez: 3D model s posuvnou rovinou řezu kolmou na `axis` (výchozí poloha `at`) a vedle
   * výkres s řezem A–A, který se po posunu roviny přepočítá.
   */
  | { readonly kind: 'section'; readonly axis: 'x' | 'y' | 'z'; readonly at: number }
  /**
   * Zakótovaný výkres vedle 3D modelu: najetí na kótu zvýrazní kótovaný prvek ve 3D, tlačítka
   * zvýrazní prvek a jeho kóty.
   */
  | { readonly kind: 'dimensions'; readonly features?: readonly IntroFeature[] }

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

/**
 * Úlohy na konci lekce vybírané adaptivně podle chyb uživatele (`pickNextTask`, D-023):
 * `count` úloh z typů `kinds` v rozsahu obtížnosti. Výchozí obtížnost = obtížnost poslední
 * pevné úlohy plánu.
 */
export type AdaptiveSlots = {
  readonly count: number
  readonly kinds: readonly ExerciseKind[]
  readonly minDifficulty: Difficulty
  readonly maxDifficulty: Difficulty
}

export type LessonStatus = 'available' | 'coming-soon'

/**
 * Závěrečný test: pevný plán úloh (typ a obtížnost), seedy se odvodí z jednoho seedu testu
 * (`finalTestTasks`). Během testu se nezobrazuje zpětná vazba, výsledek až na konci.
 */
export type FinalTestSpec = {
  readonly plan: readonly Pick<FixedTask, 'kind' | 'difficulty'>[]
  /** Podíl správných odpovědí potřebný ke splnění (0–1). */
  readonly passThreshold: number
}

export type Lesson = {
  /** Slug v URL (`/lekce/<slug>`), zároveň klíč textů `lessons.items.<slug>`. */
  readonly slug: string
  readonly status: LessonStatus
  readonly intro: readonly IntroScreen[]
  readonly plan: readonly TaskPlanItem[]
  /** Adaptivní úlohy po pevném plánu (volitelné). */
  readonly adaptive?: AdaptiveSlots
  /** Lekce je závěrečný test (místo plánu úloh a adaptivních úloh). */
  readonly test?: FinalTestSpec
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
  /** Upřednostněný druh chyby (vstup generátoru, ukládá se se seedem). */
  readonly focus?: ErrorCode
}
