/**
 * Generátor úloh (cvičení 1–4; „najdi chybu“ je v find-error.ts). Úloha je deterministická ze (seed, obtížnost, typ). Každý distraktor
 * se ověří otiskem výkresu: musí se viditelně lišit od správné odpovědi i od ostatních distraktorů.
 * Když se pro součást nedaří najít dost distraktorů, vezme se další součást ze stejného proudu
 * náhodných čísel.
 */
import { STANDARD_VIEWS, type GridPosition, type ViewName } from '@vykresovna/drafting-standards'
import {
  buildPart,
  createDrawing,
  ENGINE_VERSION,
  extractEdges,
  viewFingerprint,
  type Drawing,
  type DrawingView,
  type EdgeModel,
  type PartSpec,
  type SolidMesh,
} from '@vykresovna/engine'
import type { ManifoldToplevel } from 'manifold-3d'
import {
  applyDrawingMutation,
  applyToView,
  DRAWING_MUTATION_ERROR,
  drawingMutationCandidates,
  edgeFeatureLookup,
} from './drawing-mutations'
import { buildFindErrorTask } from './find-error'
import { generatePart, generatePartWith } from './generator'
import { partMutations, type PartMutation } from './part-mutations'
import { createRng, deriveSeed, type Rng } from './rng'
import {
  EXERCISE_KINDS,
  type AssignViewsTask,
  type ChoiceOption,
  type Difficulty,
  type DrawingMutation,
  type DrawingToModelTask,
  type ErrorCode,
  type ExerciseKind,
  type MissingViewTask,
  type Task,
} from './types'

/** Volná místa kolem nárysu v mřížce ([sloupec, řádek], řádek +1 = nahoře). */
export const SLOTS_AROUND_FRONT: readonly GridPosition[] = [
  [0, 1],
  [-1, 0],
  [1, 0],
  [0, -1],
]

/** Karty pohledů ve cvičení „přiřaď pohledy“ podle obtížnosti. */
export function assignViewCards(difficulty: Difficulty): readonly ViewName[] {
  if (difficulty <= 2) return ['top', 'left']
  if (difficulty <= 4) return ['top', 'left', 'right']
  return ['top', 'left', 'right', 'bottom']
}

/** Kolik součástí se nejvýš zkusí, než generátor úlohy vzdá (v testech se nesmí stát). */
const MAX_PARTS = 12
/** Kolik distraktorů (sestavení tělesa) se nejvýš zkusí pro jednu součást. */
const MAX_RENDERS_PER_PART = 14

type Rendered = {
  readonly mesh: SolidMesh
  readonly edges: EdgeModel
  readonly drawing: Drawing
  view(name: ViewName): DrawingView
  fp(name: ViewName): string
}

/** Sestavení a výkresy součástí s mezipamětí podle popisu (id součásti se ignoruje). */
class Renderer {
  private readonly cache = new Map<string, Rendered>()
  constructor(
    private readonly wasm: ManifoldToplevel,
    private readonly views: readonly ViewName[],
  ) {}

  render(spec: PartSpec): Rendered {
    const key = JSON.stringify([spec.base, spec.features])
    const hit = this.cache.get(key)
    if (hit) return hit
    const mesh = buildPart(this.wasm, spec)
    const edges = extractEdges(mesh)
    const drawing = createDrawing(spec, mesh, { views: this.views, edges })
    const fps = new Map<ViewName, string>()
    const view = (name: ViewName) => {
      const v = drawing.views.find((x) => x.view === name)
      if (!v) throw new Error(`pohled ${name} není ve výkresu`)
      return v
    }
    const rendered: Rendered = {
      mesh,
      edges,
      drawing,
      view,
      fp: (name) => {
        let f = fps.get(name)
        if (f === undefined) {
          f = viewFingerprint(view(name))
          fps.set(name, f)
        }
        return f
      },
    }
    this.cache.set(key, rendered)
    return rendered
  }
}

/**
 * Proudy kandidátů po kategoriích. Kandidát se vyhodnocuje (staví) až ve chvíli, kdy je potřeba;
 * kandidát jiné kategorie se odloží do zásobníku své kategorie.
 */
class CandidateStreams<C extends string, T> {
  private readonly buffers = new Map<C, T[]>()
  constructor(
    private readonly producers: readonly {
      readonly cats: readonly C[]
      /** null = vyčerpáno, undefined = kandidát zamítnut, jinak kandidát a jeho kategorie */
      readonly next: () => { cat: C; item: T } | null | undefined
      /** Levný producent (bez stavění tělesa) smí vyrábět i při výběru „pestrých“ kandidátů. */
      readonly cheap?: boolean
    }[],
  ) {}

  /** Vezme první vyhovující kandidát kategorie; nevyhovující zůstávají v zásobníku pro další výběr. */
  take(cat: C, accept: (item: T) => boolean, onlyCheap = false): T | null {
    const buf = this.buffer(cat)
    const idx = buf.findIndex(accept)
    if (idx >= 0) return buf.splice(idx, 1)[0]!
    for (const p of this.producers) {
      if (!p.cats.includes(cat) || (onlyCheap && !p.cheap)) continue
      for (;;) {
        const r = p.next()
        if (r === null) break
        if (r === undefined) continue
        if (r.cat === cat && accept(r.item)) return r.item
        this.buffer(r.cat).push(r.item)
      }
    }
    return null
  }

  private buffer(cat: C): T[] {
    let buf = this.buffers.get(cat)
    if (!buf) {
      buf = []
      this.buffers.set(cat, buf)
    }
    return buf
  }
}

/**
 * Vybere distraktory pro sloty (každý slot = pořadí preferovaných kategorií). Otisk musí být jiný než
 * u správné odpovědi i u ostatních distraktorů. Přednost má už vyhodnocený (nebo levný) kandidát
 * s dosud nepoužitým kódem chyby (pestřejší možnosti); když žádný není, stačí odlišný otisk.
 */
function selectDistinct<C extends string, T extends { fp: string; option: { errorCode: unknown } }>(
  streams: CandidateStreams<C, T>,
  slots: readonly (readonly C[])[],
  correctFp: string,
): T[] | null {
  const used = new Set<string>([correctFp])
  const usedCodes = new Set<unknown>()
  const picked: T[] = []
  for (const prefs of slots) {
    let found: T | null = null
    for (const cat of prefs) {
      for (const strict of [true, false]) {
        found = streams.take(
          cat,
          (item) => !used.has(item.fp) && (!strict || !usedCodes.has(item.option.errorCode)),
          strict,
        )
        if (found) break
      }
      if (found) break
    }
    if (!found) return null
    used.add(found.fp)
    usedCodes.add(found.option.errorCode)
    picked.push(found)
  }
  return picked
}

type Distractor = {
  readonly fp: string
  readonly option: Omit<ChoiceOption, 'id'>
}

/** Producent kandidátů z mutací tělesa (s limitem počtu sestavení). */
function partProducer<C extends string>(
  mutations: readonly PartMutation[],
  budget: { renders: number },
  classify: (m: PartMutation) => { cat: C; item: Distractor } | undefined,
) {
  let i = 0
  return () => {
    if (i >= mutations.length || budget.renders <= 0) return null
    const m = mutations[i++]!
    budget.renders--
    return classify(m)
  }
}

function finishOptions(
  rng: Rng,
  part: PartSpec,
  options: Omit<ChoiceOption, 'id'>[],
): ChoiceOption[] {
  return rng.shuffle(options).map((o, i) => {
    const id = `m${i + 1}`
    // neutrální id součásti, aby z něj nešlo poznat správnou odpověď
    return { ...o, id, part: { ...o.part, id: `${part.id}/${id}` } }
  })
}

type Built<T extends Task> = Omit<T, 'seed' | 'difficulty' | 'engineVersion'>

function assignViews(
  r: Renderer,
  rng: Rng,
  part: PartSpec,
  difficulty: Difficulty,
): Built<AssignViewsTask> | null {
  const views = assignViewCards(difficulty)
  const rendered = r.render(part)
  // dva stejně vypadající pohledy (ani karta shodná s nárysem) by uživatel nemohl rozlišit
  const fps = ['front' as const, ...views].map((v) => rendered.fp(v))
  if (new Set(fps).size !== fps.length) return null
  return {
    kind: 'assign-views',
    part,
    cards: rng.shuffle(views).map((view, i) => ({ id: `k${i + 1}`, view })),
    slots: SLOTS_AROUND_FRONT,
  }
}

type MissingCat = 'gross' | 'subtle' | 'near' | 'drawing'

const MISSING_SLOTS: Readonly<Record<Difficulty, readonly (readonly MissingCat[])[]>> = {
  1: [
    ['gross', 'subtle', 'near', 'drawing'],
    ['gross', 'subtle', 'near', 'drawing'],
    ['gross', 'subtle', 'near', 'drawing'],
  ],
  2: [
    ['gross', 'subtle', 'near', 'drawing'],
    ['gross', 'subtle', 'near', 'drawing'],
    ['subtle', 'gross', 'near', 'drawing'],
  ],
  3: [
    ['gross', 'subtle', 'near', 'drawing'],
    ['subtle', 'near', 'gross', 'drawing'],
    ['drawing', 'near', 'subtle', 'gross'],
  ],
  4: [
    ['drawing', 'near', 'subtle', 'gross'],
    ['near', 'subtle', 'drawing', 'gross'],
    ['subtle', 'near', 'drawing', 'gross'],
  ],
  5: [
    ['drawing', 'near', 'subtle', 'gross'],
    ['drawing', 'near', 'subtle', 'gross'],
    ['near', 'drawing', 'subtle', 'gross'],
  ],
}

function missingView(
  r: Renderer,
  rng: Rng,
  part: PartSpec,
  difficulty: Difficulty,
): Built<MissingViewTask> | null {
  const missing: ViewName = rng.chance(0.5) ? 'left' : 'top'
  const given: ViewName[] = missing === 'left' ? ['front', 'top'] : ['front', 'left']
  const correct = r.render(part)
  const correctFp = correct.fp(missing)
  const budget = { renders: MAX_RENDERS_PER_PART }
  const mutations = partMutations(rng, part, difficulty)

  const classify = (m: PartMutation) => {
    const rendered = r.render(m.part)
    const fp = rendered.fp(missing)
    if (fp === correctFp) return undefined
    const sameGiven = given.filter((v) => rendered.fp(v) === correct.fp(v)).length
    // stejné dané pohledy = jiná, ale stejně správná odpověď → zahodit
    if (sameGiven === given.length) return undefined
    const cat: MissingCat = m.gross ? 'gross' : sameGiven > 0 ? 'near' : 'subtle'
    const option: Omit<ChoiceOption, 'id'> = {
      part: m.part,
      errorCode: m.errorCode,
      ...(m.featureId ? { featureId: m.featureId } : {}),
      view: missing,
    }
    return { cat, item: { fp, option } }
  }

  const featureOf = edgeFeatureLookup(correct.mesh, correct.edges)
  const missingDrawingView = correct.view(missing)
  const drawingCandidates = rng.shuffle(drawingMutationCandidates(missingDrawingView, featureOf))
  // hrany uvnitř pohledu mají přednost před vnějším obrysem
  drawingCandidates.sort((a, b) => Number(b.interior) - Number(a.interior))
  let di = 0
  const drawingProducer = () => {
    if (di >= drawingCandidates.length) return null
    const c = drawingCandidates[di++]!
    const fp = viewFingerprint(applyToView(missingDrawingView, c.mutation))
    const mutation: DrawingMutation = c.mutation
    const option: Omit<ChoiceOption, 'id'> = {
      part,
      drawingMutation: mutation,
      errorCode: DRAWING_MUTATION_ERROR[mutation.kind],
      ...(c.featureId ? { featureId: c.featureId } : {}),
      view: missing,
    }
    return { cat: 'drawing' as const, item: { fp, option } }
  }

  const streams = new CandidateStreams<MissingCat, Distractor>([
    {
      cats: ['gross'],
      next: partProducer(
        mutations.filter((m) => m.gross),
        budget,
        classify,
      ),
    },
    {
      cats: ['subtle', 'near'],
      next: partProducer(
        mutations.filter((m) => !m.gross),
        budget,
        classify,
      ),
    },
    { cats: ['drawing'], next: drawingProducer, cheap: true },
  ])
  const picked = selectDistinct(streams, MISSING_SLOTS[difficulty], correctFp)
  if (!picked) return null
  const options = finishOptions(rng, part, [
    { part, errorCode: null },
    ...picked.map((p) => p.option),
  ])
  return { kind: 'missing-view', part, givenViews: given, missingView: missing, options }
}

type ModelCat = 'gross' | 'subtle'

const MODEL_SLOTS: Readonly<Record<Difficulty, readonly (readonly ModelCat[])[]>> = {
  1: [
    ['gross', 'subtle'],
    ['gross', 'subtle'],
    ['gross', 'subtle'],
  ],
  2: [
    ['gross', 'subtle'],
    ['gross', 'subtle'],
    ['gross', 'subtle'],
  ],
  3: [
    ['gross', 'subtle'],
    ['gross', 'subtle'],
    ['subtle', 'gross'],
  ],
  4: [
    ['gross', 'subtle'],
    ['subtle', 'gross'],
    ['subtle', 'gross'],
  ],
  5: [
    ['subtle', 'gross'],
    ['subtle', 'gross'],
    ['subtle', 'gross'],
  ],
}

function drawingToModel(
  r: Renderer,
  rng: Rng,
  part: PartSpec,
  difficulty: Difficulty,
): Built<DrawingToModelTask> | null {
  const correct = r.render(part)
  const combined = (x: Rendered) => STANDARD_VIEWS.map((v) => x.fp(v)).join('|')
  const correctFp = combined(correct)
  const budget = { renders: MAX_RENDERS_PER_PART }
  const mutations = partMutations(rng, part, difficulty)
  const classify = (m: PartMutation) => {
    const rendered = r.render(m.part)
    const fp = combined(rendered)
    if (fp === correctFp) return undefined
    const view = STANDARD_VIEWS.find((v) => rendered.fp(v) !== correct.fp(v))
    const option: Omit<ChoiceOption, 'id'> = {
      part: m.part,
      errorCode: m.errorCode,
      ...(m.featureId ? { featureId: m.featureId } : {}),
      ...(view ? { view } : {}),
    }
    return { cat: (m.gross ? 'gross' : 'subtle') as ModelCat, item: { fp, option } }
  }
  const streams = new CandidateStreams<ModelCat, Distractor>([
    {
      cats: ['gross'],
      next: partProducer(
        mutations.filter((m) => m.gross),
        budget,
        classify,
      ),
    },
    {
      cats: ['subtle'],
      next: partProducer(
        mutations.filter((m) => !m.gross),
        budget,
        classify,
      ),
    },
  ])
  const picked = selectDistinct(streams, MODEL_SLOTS[difficulty], correctFp)
  if (!picked) return null
  const options = finishOptions(rng, part, [
    { part, errorCode: null },
    ...picked.map((p) => p.option),
  ])
  return { kind: 'drawing-to-model', part, options }
}

/** Volitelné vstupy generátoru (ukládají se spolu se seedem). */
export type GenerateTaskOptions = {
  /** Upřednostněný druh chyby (adaptivita); zatím ho používá jen „najdi chybu“. */
  readonly focus?: ErrorCode
}

/**
 * Úloha daného typu ze seedu. Deterministická: stejné vstupy dají stejnou (deep-equal) úlohu.
 * Součást úlohy je obvykle `generatePart(seed, difficulty)`; když pro ni nejde úlohu sestavit
 * (např. dva stejné pohledy), použije se další součást s id `gen-<obtížnost>-<seed>-<n>`.
 */
export function generateTask(
  wasm: ManifoldToplevel,
  kind: ExerciseKind,
  seed: number,
  difficulty: Difficulty,
  options: GenerateTaskOptions = {},
): Task {
  const rng = createRng(deriveSeed(seed, difficulty, EXERCISE_KINDS.indexOf(kind) + 1, 0x7a5c))
  const views: readonly ViewName[] =
    kind === 'assign-views' ? ['front', ...assignViewCards(difficulty)] : STANDARD_VIEWS
  const renderer = new Renderer(wasm, views)
  const meta = {
    seed,
    difficulty,
    engineVersion: ENGINE_VERSION,
    ...(options.focus ? { focus: options.focus } : {}),
  }
  for (let attempt = 0; attempt < MAX_PARTS; attempt++) {
    const part =
      attempt === 0
        ? generatePart(seed, difficulty)
        : generatePartWith(rng, difficulty, `gen-${difficulty}-${seed}-${attempt}`)
    switch (kind) {
      case 'assign-views': {
        const t = assignViews(renderer, rng, part, difficulty)
        if (t) return { ...meta, ...t }
        break
      }
      case 'missing-view': {
        const t = missingView(renderer, rng, part, difficulty)
        if (t) return { ...meta, ...t }
        break
      }
      case 'drawing-to-model': {
        const t = drawingToModel(renderer, rng, part, difficulty)
        if (t) return { ...meta, ...t }
        break
      }
      case 'find-error': {
        const t = buildFindErrorTask(wasm, rng, part, difficulty, options.focus)
        if (t) return { ...meta, ...t }
        break
      }
    }
  }
  throw new Error(`úlohu ${kind} (seed ${seed}, obtížnost ${difficulty}) se nepodařilo sestavit`)
}

/**
 * Výkres možnosti tak, jak ho má uživatel vidět (součást možnosti + případná mutace výkresu).
 * Pomocník pro UI a testy; `views` určuje, které pohledy se vykreslí.
 */
export function buildOptionDrawing(
  wasm: ManifoldToplevel,
  option: ChoiceOption,
  views: readonly ViewName[] = STANDARD_VIEWS,
): Drawing {
  const mesh = buildPart(wasm, option.part)
  const drawing = createDrawing(option.part, mesh, { views })
  return option.drawingMutation ? applyDrawingMutation(drawing, option.drawingMutation) : drawing
}
