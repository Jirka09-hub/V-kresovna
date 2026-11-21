/**
 * Smlouva (kontrakt) mezi generátorem úloh a UI. Typy jsou stabilní: UI s nimi počítá a ukládá se jen
 * `seed`, `difficulty`, `engineVersion`, odpověď a výsledek (D-006), takže úloha jde kdykoli znovu
 * vygenerovat ze seedu.
 */
import type { GridPosition, ViewName } from '@vykresovna/drafting-standards'
import type { PartSpec, Vec2 } from '@vykresovna/engine'

/** Obtížnost 1–5 (1 = kvádr s jedním výřezem, 5 = více prvků a distraktory lišící se jedinou hranou). */
export type Difficulty = 1 | 2 | 3 | 4 | 5
export const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4, 5]

/**
 * Typy cvičení. Fáze 2: první tři; fáze 3 přidává 'find-error' (D-023), pak 'section', 'dimension'.
 * Nové typy se přidávají na konec (pořadí vstupuje do seedu úlohy).
 */
export const EXERCISE_KINDS = [
  'assign-views',
  'missing-view',
  'drawing-to-model',
  'find-error',
] as const
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
  // hledání chyby ve výkresu
  'MISSED_ERROR', // uživatel ukázal na místo, kde chyba není
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export type TaskMeta = {
  readonly kind: ExerciseKind
  readonly seed: number
  readonly difficulty: Difficulty
  /** Verze enginu, se kterou byla úloha vygenerovaná (ENGINE_VERSION). */
  readonly engineVersion: string
  /**
   * Upřednostněný druh chyby (adaptivita, D-023). Je součástí vstupu generátoru: ukládá se spolu se
   * seedem. Zatím ho používá jen „najdi chybu“, ostatní typy ho ignorují.
   */
  readonly focus?: ErrorCode
}

/** Úsek čáry v souřadnicích pohledu (mm; u doprava, v nahoru), stejných jako `ViewSegment`. */
export type LineSegment2 = { readonly a: Vec2; readonly b: Vec2 }

/**
 * Mutace výkresu (ne tělesa): mění jen čáry pohledu. Hrany se vybírají podle id logických hran.
 * `onLine` (volitelně) omezí změnu na úseky ležící na této přímce: např. jen jeden ze dvou obrysů
 * díry, které mají stejné id `sil:cyl:<díra>`.
 */
export type DrawingMutation =
  | {
      readonly kind: 'hidden-as-visible'
      readonly view: ViewName
      readonly edgeIds: readonly string[]
      readonly onLine?: LineSegment2
    }
  | {
      readonly kind: 'visible-as-hidden'
      readonly view: ViewName
      readonly edgeIds: readonly string[]
      readonly onLine?: LineSegment2
    }
  | {
      readonly kind: 'remove-edge'
      readonly view: ViewName
      readonly edgeIds: readonly string[]
      readonly onLine?: LineSegment2
    }
  /** Čára navíc (např. hrana prvku zrcadlená na druhou stranu pohledu). `edgeIds` = id přidaných čar. */
  | {
      readonly kind: 'add-edge'
      readonly view: ViewName
      readonly edgeIds: readonly string[]
      readonly segments: readonly (LineSegment2 & { readonly visibility: 'visible' | 'hidden' })[]
    }

/** Chyba rozmístění celého výkresu (ne jednoho pohledu). */
export type LayoutMutation =
  /** Pohledy rozmístěné podle amerického promítání (jen jako chyba k nalezení). */
  | { readonly kind: 'third-angle-layout' }
  /** Půdorys a bokorys prohozené. */
  | { readonly kind: 'swap-top-left' }

/** Chyba ve výkresu pro cvičení „najdi chybu“: jedna mutace pohledu, nebo rozmístění. */
export type FindErrorMutation = DrawingMutation | LayoutMutation

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

/**
 * Místo, kde je chyba: čáry v pohledu (u chybějící hrany místo, kde by měla být), nebo celý pohled
 * (u chyby rozmístění).
 */
export type FindErrorTarget =
  | {
      readonly kind: 'lines'
      readonly view: ViewName
      readonly segments: readonly LineSegment2[]
      /** Id čar ve výkresu (pro zvýraznění ve 2D a 3D). */
      readonly edgeIds: readonly string[]
    }
  | { readonly kind: 'view'; readonly view: ViewName }

/**
 * Cvičení 4: výkres (nárys, půdorys, bokorys) má právě jednu záměrnou chybu, uživatel na ni ukáže
 * (klik do výkresu, oblast z klávesnice, nebo tlačítko „rozmístění pohledů je špatně“).
 */
export type FindErrorTask = TaskMeta & {
  readonly kind: 'find-error'
  readonly part: PartSpec
  readonly views: readonly ViewName[]
  readonly mutation: FindErrorMutation
  /** Kód chyby, kterou výkres obsahuje. */
  readonly errorCode: ErrorCode
  /** Prvek, kterého se chyba týká (pro zvýraznění ve 3D). */
  readonly featureId?: string
  /** Místa, která se počítají jako správná odpověď. */
  readonly targets: readonly FindErrorTarget[]
  /** Je správnou odpovědí i tlačítko „rozmístění pohledů je špatně“? */
  readonly layoutError: boolean
  /** Jak daleko od čáry (mm ve výkresu) se klik ještě počítá. */
  readonly toleranceMm: number
}

export type Task = AssignViewsTask | MissingViewTask | DrawingToModelTask | FindErrorTask

export type AssignViewsAnswer = {
  readonly kind: 'assign-views'
  /** id karty → místo v mřížce (null = nepoložená). */
  readonly placement: Readonly<Record<string, GridPosition | null>>
}
export type ChoiceAnswer = {
  readonly kind: 'missing-view' | 'drawing-to-model'
  readonly optionId: string
}
/** Obdélník v souřadnicích pohledu (mm). */
export type Area2 = { readonly min: Vec2; readonly max: Vec2 }

/**
 * Odpověď na „najdi chybu“: bod v pohledu (klik myší nebo prstem), oblast pohledu (výběr
 * z klávesnice), nebo „rozmístění pohledů je špatně“.
 */
export type FindErrorAnswer =
  | {
      readonly kind: 'find-error'
      readonly pick: 'point'
      readonly view: ViewName
      readonly point: Vec2
    }
  | {
      readonly kind: 'find-error'
      readonly pick: 'area'
      readonly view: ViewName
      readonly area: Area2
    }
  | { readonly kind: 'find-error'; readonly pick: 'layout' }

export type Answer = AssignViewsAnswer | ChoiceAnswer | FindErrorAnswer

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
