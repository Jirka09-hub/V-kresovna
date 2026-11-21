/**
 * Smlouva (kontrakt) mezi generátorem úloh a UI. Typy jsou stabilní: UI s nimi počítá a ukládá se jen
 * `seed`, `difficulty`, `engineVersion`, odpověď a výsledek (D-006), takže úloha jde kdykoli znovu
 * vygenerovat ze seedu.
 */
import type { GridPosition, ViewName } from '@vykresovna/drafting-standards'
import type { PartSpec } from '@vykresovna/engine'

/** Obtížnost 1–5 (1 = kvádr s jedním výřezem, 5 = více prvků a distraktory lišící se jedinou hranou). */
export type Difficulty = 1 | 2 | 3 | 4 | 5
export const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4, 5]

/** Typy cvičení. Fáze 2: první tři; fáze 3 přidá 'find-error', 'section', 'dimension'. */
export const EXERCISE_KINDS = ['assign-views', 'missing-view', 'drawing-to-model'] as const
export type ExerciseKind = (typeof EXERCISE_KINDS)[number]

/**
 * Kódy chyb. Každý kód má v UI vysvětlení vlastními slovy (`messages/*.json`, klíč `exercises.errors.<KÓD>`).
 */
export const ERROR_CODES = [
  // rozmístění pohledů
  'LAYOUT_THIRD_ANGLE', // celé rozmístění podle amerického promítání
  'TOP_SIDE_SWAPPED', // půdorys a bokorys prohozené
  'VIEW_MISPLACED', // pohled na jiném místě (jiná chyba než dvě výše)
  'VIEW_MISSING', // karta nepoložená
  // čtení výkresu (proč je zvolená možnost špatně)
  'HIDDEN_AS_VISIBLE', // skrytá hrana nakreslená plnou čarou
  'VISIBLE_AS_HIDDEN', // viditelná hrana nakreslená čárkovaně
  'MISSING_EDGE', // ve výkresu chybí hrana
  'EXTRA_EDGE', // ve výkresu je hrana navíc
  'MIRRORED', // součást je zrcadlově obrácená
  'FEATURE_SHIFTED', // prvek je posunutý
  'FEATURE_MISSING', // prvek chybí
  'FEATURE_EXTRA', // prvek je navíc
  'FEATURE_RESIZED', // prvek má jiný rozměr
  'THROUGH_VS_BLIND', // průchozí díra místo slepé nebo naopak
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export type TaskMeta = {
  readonly kind: ExerciseKind
  readonly seed: number
  readonly difficulty: Difficulty
  /** Verze enginu, se kterou byla úloha vygenerovaná (ENGINE_VERSION). */
  readonly engineVersion: string
}

/** Mutace výkresu (ne tělesa): mění jen čáry pohledu. Hrany se vybírají podle id logických hran. */
export type DrawingMutation =
  | {
      readonly kind: 'hidden-as-visible'
      readonly view: ViewName
      readonly edgeIds: readonly string[]
    }
  | {
      readonly kind: 'visible-as-hidden'
      readonly view: ViewName
      readonly edgeIds: readonly string[]
    }
  | { readonly kind: 'remove-edge'; readonly view: ViewName; readonly edgeIds: readonly string[] }

/** Možnost ve výběru 1 ze 4. Správná má `errorCode: null`. */
export type ChoiceOption = {
  readonly id: string
  readonly part: PartSpec
  /** Volitelná mutace výkresu (u úlohy „chybějící pohled“). */
  readonly drawingMutation?: DrawingMutation
  /** Proč je možnost špatně (null = správná odpověď). */
  readonly errorCode: ErrorCode | null
  /** Prvek, kterého se chyba týká (pro zvýraznění ve 3D/2D). */
  readonly featureId?: string
  /** Pohled, ve kterém je chyba vidět (u „chybějícího pohledu“ chybějící pohled). */
  readonly view?: ViewName
}

/** Cvičení 1: nárys je pevně uprostřed, uživatel rozmístí karty s ostatními pohledy na volná místa. */
export type AssignViewsTask = TaskMeta & {
  readonly kind: 'assign-views'
  readonly part: PartSpec
  /** Karty v zamíchaném pořadí. `id` je neutrální (např. „k1“), `view` slouží UI k vykreslení. */
  readonly cards: readonly { readonly id: string; readonly view: ViewName }[]
  /** Volná místa v mřížce kolem nárysu ([sloupec, řádek], nárys = [0, 0], řádek +1 = nahoře). */
  readonly slots: readonly GridPosition[]
}

/** Cvičení 2: dva (nebo více) pohledy jsou dané, chybějící se vybírá ze 4 možností. */
export type MissingViewTask = TaskMeta & {
  readonly kind: 'missing-view'
  readonly part: PartSpec
  readonly givenViews: readonly ViewName[]
  readonly missingView: ViewName
  /** 4 možnosti v zamíchaném pořadí; ukazuje se z nich jen `missingView`. */
  readonly options: readonly ChoiceOption[]
}

/** Cvičení 3: výkres (nárys, půdorys, bokorys) je daný, vybírá se 1 ze 4 3D modelů. */
export type DrawingToModelTask = TaskMeta & {
  readonly kind: 'drawing-to-model'
  readonly part: PartSpec
  readonly options: readonly ChoiceOption[]
}

export type Task = AssignViewsTask | MissingViewTask | DrawingToModelTask

export type AssignViewsAnswer = {
  readonly kind: 'assign-views'
  /** id karty → místo v mřížce (null = nepoložená). */
  readonly placement: Readonly<Record<string, GridPosition | null>>
}
export type ChoiceAnswer = {
  readonly kind: 'missing-view' | 'drawing-to-model'
  readonly optionId: string
}
export type Answer = AssignViewsAnswer | ChoiceAnswer

export type TaskError = {
  readonly code: ErrorCode
  readonly featureId?: string
  readonly view?: ViewName
  readonly cardId?: string
}

export type TaskResult = {
  readonly correct: boolean
  /** 0–1 (u rozmístění pohledů poměr správně položených karet). */
  readonly score: number
  readonly errors: readonly TaskError[]
}
