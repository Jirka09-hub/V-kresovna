/**
 * Cvičení 4 „Najdi chybu ve výkresu“ (D-023). Výkres správné součásti dostane právě jednu záměrnou
 * chybu (mutace výkresu, ne tělesa):
 *
 * - skrytá hrana nakreslená plnou čarou / viditelná čárkovaně,
 * - chybějící hrana, čára navíc (hrana prvku zrcadlená na druhou stranu pohledu),
 * - pohledy rozmístěné po americku, prohozený půdorys a bokorys.
 *
 * Chyba musí být vidět: otisk chybného výkresu (včetně rozmístění pohledů) se musí lišit od správného.
 * Úloha nese i místa, která se počítají jako správná odpověď, a toleranci kliknutí.
 */
import {
  FIRST_ANGLE_LAYOUT,
  STANDARD_VIEWS,
  THIRD_ANGLE_DEMO_ONLY,
  type GridPosition,
  type ViewName,
} from '@vykresovna/drafting-standards'
import {
  buildPart,
  createDrawing,
  DRAWING_MARGIN_MM,
  extractEdges,
  VIEW_GAP_MM,
  viewFingerprint,
  type Drawing,
  type DrawingView,
  type PartSpec,
  type Vec2,
  type ViewSegment,
} from '@vykresovna/engine'
import type { ManifoldToplevel } from 'manifold-3d'
import { applyDrawingMutation, edgeFeatureLookup } from './drawing-mutations'
import {
  collinear,
  collinearOverlap,
  coveredBy,
  pointSegmentDistance,
  segmentIntersectsArea,
  segmentLength,
} from './geometry2d'
import { MIN_FEATURE_MM } from './layout'
import type { Rng } from './rng'
import type {
  Difficulty,
  DrawingMutation,
  ErrorCode,
  FindErrorAnswer,
  FindErrorMutation,
  FindErrorTarget,
  FindErrorTask,
  LineSegment2,
  TaskError,
  TaskResult,
} from './types'

/** Druhy chyb ve výkresu, které generátor umí. */
export const FIND_ERROR_FAMILIES = [
  'remove-edge',
  'add-edge',
  'hidden-as-visible',
  'visible-as-hidden',
  'third-angle-layout',
  'swap-top-left',
] as const
export type FindErrorFamily = (typeof FIND_ERROR_FAMILIES)[number]

/** Kód chyby podle druhu chyby ve výkresu. */
export const FIND_ERROR_CODE: Readonly<Record<FindErrorFamily, ErrorCode>> = {
  'remove-edge': 'MISSING_EDGE',
  'add-edge': 'EXTRA_EDGE',
  'hidden-as-visible': 'HIDDEN_AS_VISIBLE',
  'visible-as-hidden': 'VISIBLE_AS_HIDDEN',
  'third-angle-layout': 'LAYOUT_THIRD_ANGLE',
  'swap-top-left': 'TOP_SIDE_SWAPPED',
}

/** Druh chyby, který odpovídá kódu (pro upřednostnění podle adaptivity). */
export function findErrorFamilyFor(code: ErrorCode): FindErrorFamily | undefined {
  return FIND_ERROR_FAMILIES.find((f) => FIND_ERROR_CODE[f] === code)
}

/**
 * Váhy druhů chyb podle obtížnosti. 1 = hrubé chyby (chybí hrana výřezu, špatné rozmístění),
 * 5 = jemné (jediná skrytá čára díry nakreslená plnou čarou).
 */
const FAMILY_WEIGHTS: Readonly<Record<Difficulty, Readonly<Record<FindErrorFamily, number>>>> = {
  1: {
    'remove-edge': 3,
    'add-edge': 0,
    'hidden-as-visible': 0,
    'visible-as-hidden': 0,
    'third-angle-layout': 1,
    'swap-top-left': 1,
  },
  2: {
    'remove-edge': 2,
    'add-edge': 1.5,
    'hidden-as-visible': 0.5,
    'visible-as-hidden': 1,
    'third-angle-layout': 0.5,
    'swap-top-left': 0.8,
  },
  3: {
    'remove-edge': 1,
    'add-edge': 1.5,
    'hidden-as-visible': 2,
    'visible-as-hidden': 2,
    'third-angle-layout': 0.2,
    'swap-top-left': 0.4,
  },
  4: {
    'remove-edge': 1,
    'add-edge': 1,
    'hidden-as-visible': 3,
    'visible-as-hidden': 2,
    'third-angle-layout': 0,
    'swap-top-left': 0.2,
  },
  5: {
    'remove-edge': 0.8,
    'add-edge': 1,
    'hidden-as-visible': 4,
    'visible-as-hidden': 1.5,
    'third-angle-layout': 0,
    'swap-top-left': 0,
  },
}

/**
 * Tolerance kliknutí (mm ve výkresu) podle obtížnosti. Nejde o normu, jen o parametr úlohy:
 * výkres se na obrazovce kreslí zhruba 4–6 px na mm, 3–6 mm je tedy 15–35 px.
 */
export const FIND_ERROR_TOLERANCE_MM: Readonly<Record<Difficulty, number>> = {
  1: 6,
  2: 5,
  3: 4,
  4: 4,
  5: 3,
}

/** Čára navíc nesmí ležet blíž než tohle k jiné rovnoběžné čáře (jinak by s ní splývala). */
const EXTRA_EDGE_MIN_GAP_MM = 2

// ---------------------------------------------------------------------------------------------
// Rozmístění pohledů

export type ViewPositions = Readonly<Record<ViewName, GridPosition>>

/** Rozmístění pohledů v mřížce, jak ho uživatel uvidí (u chyb rozmístění jiné než evropské). */
export function findErrorPositions(mutation: FindErrorMutation): ViewPositions {
  if (mutation.kind === 'third-angle-layout') return THIRD_ANGLE_DEMO_ONLY
  if (mutation.kind === 'swap-top-left') {
    return { ...FIRST_ANGLE_LAYOUT, top: FIRST_ANGLE_LAYOUT.left, left: FIRST_ANGLE_LAYOUT.top }
  }
  return FIRST_ANGLE_LAYOUT
}

/**
 * Rozmístí pohledy výkresu do mřížky podle `positions`: stejný postup jako `createDrawing`
 * v enginu (sloupce a řádky podle největšího pohledu, mezera VIEW_GAP_MM, okraj DRAWING_MARGIN_MM).
 */
export function placeViews(
  drawing: Drawing,
  positions: ViewPositions,
  layout: Drawing['layout'] = drawing.layout,
): Drawing {
  const colWidth = new Map<number, number>()
  const rowHeight = new Map<number, number>()
  for (const v of drawing.views) {
    const [c, r] = positions[v.view]
    colWidth.set(c, Math.max(colWidth.get(c) ?? 0, v.size[0]))
    rowHeight.set(r, Math.max(rowHeight.get(r) ?? 0, v.size[1]))
  }
  const colX = new Map<number, number>()
  let x = DRAWING_MARGIN_MM
  for (const c of [...colWidth.keys()].sort((a, b) => a - b)) {
    colX.set(c, x)
    x += colWidth.get(c)! + VIEW_GAP_MM
  }
  const rowY = new Map<number, number>()
  let y = DRAWING_MARGIN_MM
  for (const r of [...rowHeight.keys()].sort((a, b) => b - a)) {
    rowY.set(r, y)
    y += rowHeight.get(r)! + VIEW_GAP_MM
  }
  return {
    ...drawing,
    layout,
    views: drawing.views.map((v) => ({
      ...v,
      origin: [colX.get(positions[v.view][0])!, rowY.get(positions[v.view][1])!] as Vec2,
    })),
    width: x - VIEW_GAP_MM + DRAWING_MARGIN_MM,
    height: y - VIEW_GAP_MM + DRAWING_MARGIN_MM,
  }
}

/** Použije chybu „najdi chybu“ na správný výkres. Čistá funkce. */
export function applyFindErrorMutation(drawing: Drawing, mutation: FindErrorMutation): Drawing {
  switch (mutation.kind) {
    case 'third-angle-layout':
      return placeViews(drawing, findErrorPositions(mutation), 'third-angle-demo')
    case 'swap-top-left':
      return placeViews(drawing, findErrorPositions(mutation))
    default:
      return applyDrawingMutation(drawing, mutation)
  }
}

/**
 * Otisk výkresu včetně rozmístění: pro každý pohled jeho pořadí sloupce a řádku na výkrese a otisk
 * (`viewFingerprint`). Prohozené pohledy nebo jiné rozmístění tak dají jiný otisk, i když jsou
 * jednotlivé pohledy stejné.
 */
export function placedDrawingFingerprint(drawing: Drawing): string {
  const xs = [...new Set(drawing.views.map((v) => v.origin[0]))].sort((a, b) => a - b)
  const ys = [...new Set(drawing.views.map((v) => v.origin[1]))].sort((a, b) => a - b)
  return drawing.views
    .map((v) => `${xs.indexOf(v.origin[0])},${ys.indexOf(v.origin[1])}:${viewFingerprint(v)}`)
    .sort()
    .join('|')
}

/** Poloha pohledu na výkrese: převod mezi souřadnicemi pohledu (u, v) a výkresu (x, y dolů). */
export type ViewPlacement = {
  readonly view: ViewName
  /** Levý horní roh pohledu na výkrese (mm). */
  readonly origin: Vec2
  readonly size: Vec2
  /** Levý dolní roh průmětu v souřadnicích pohledu. */
  readonly min: Vec2
}

export function viewPlacements(drawing: Drawing): ViewPlacement[] {
  return drawing.views.map((v) => ({
    view: v.view,
    origin: v.origin,
    size: v.size,
    min: v.projection.bounds.min,
  }))
}

/** Výkres úlohy tak, jak ho uživatel uvidí (s chybou), nebo správný (`correct: true`). */
export function buildFindErrorDrawing(
  wasm: ManifoldToplevel,
  task: FindErrorTask,
  opts: { readonly correct?: boolean } = {},
): Drawing {
  const mesh = buildPart(wasm, task.part)
  const drawing = createDrawing(task.part, mesh, { views: task.views })
  return opts.correct ? drawing : applyFindErrorMutation(drawing, task.mutation)
}

// ---------------------------------------------------------------------------------------------
// Kandidáti na chybu

export type FindErrorCandidate = {
  readonly family: FindErrorFamily
  readonly mutation: FindErrorMutation
  readonly targets: readonly FindErrorTarget[]
  readonly featureId?: string
  /** Délka čar, kterých se chyba týká (mm), u rozmístění 0. */
  readonly size: number
  /** Chyba uvnitř pohledu (ne na vnějším obrysu). */
  readonly interior: boolean
  /** Chyba na díře (obrys válce, kuželové dno, kružnice). */
  readonly hole: boolean
  /** Chyba jediné čáry z několika se stejným id (např. jeden obrys díry). */
  readonly single: boolean
}

const plain = (s: LineSegment2): LineSegment2 => ({ a: s.a, b: s.b })
const total = (segs: readonly LineSegment2[]) => segs.reduce((n, s) => n + segmentLength(s), 0)

function onOutline(s: LineSegment2, view: DrawingView): boolean {
  const { min, max } = view.projection.bounds
  const eps = 1e-6
  const sameU = Math.abs(s.a[0] - s.b[0]) < eps
  const sameV = Math.abs(s.a[1] - s.b[1]) < eps
  return (
    (sameU && (Math.abs(s.a[0] - min[0]) < eps || Math.abs(s.a[0] - max[0]) < eps)) ||
    (sameV && (Math.abs(s.a[1] - min[1]) < eps || Math.abs(s.a[1] - max[1]) < eps))
  )
}

type EdgeUnit = {
  readonly id: string
  readonly onLine?: LineSegment2
  readonly pieces: readonly ViewSegment[]
  /** Všechny úseky leží na jedné přímce (rovná hrana, ne kružnice). */
  readonly straight: boolean
}

/**
 * Jednotky pro mutaci: každá hrana (id) celá, a když leží na 2–4 přímkách (např. dva obrysy
 * díry se stejným id), i každá přímka zvlášť.
 */
function edgeUnits(view: DrawingView): EdgeUnit[] {
  const ids = [...new Set(view.projection.segments.flatMap((s) => s.edgeIds))].sort()
  const units: EdgeUnit[] = []
  for (const id of ids) {
    const pieces = view.projection.segments.filter((s) => s.edgeIds.includes(id))
    const groups: { line: LineSegment2; pieces: ViewSegment[] }[] = []
    for (const p of pieces) {
      const g = groups.find((x) => collinear(p, x.line))
      if (g) g.pieces.push(p)
      else groups.push({ line: plain(p), pieces: [p] })
    }
    units.push({ id, pieces, straight: groups.length === 1 })
    if (groups.length >= 2 && groups.length <= 4) {
      for (const g of groups) units.push({ id, onLine: g.line, pieces: g.pieces, straight: true })
    }
  }
  return units
}

/** Kandidáti na chybu v jednom pohledu (hrany: odebrat, prohodit viditelnost, zrcadlit navíc). */
function viewCandidates(
  view: DrawingView,
  featureOf: (edgeId: string) => string | undefined,
): FindErrorCandidate[] {
  const out: FindErrorCandidate[] = []
  const segs = view.projection.segments
  const name = view.view
  const extraId = `extra:${name}`
  for (const unit of edgeUnits(view)) {
    const inUnit = new Set(unit.pieces)
    const others = segs.filter((s) => !inUnit.has(s))
    const otherVisible = others.filter((s) => s.visibility === 'visible')
    const featureId = featureOf(unit.id)
    const hole = /(^|\|)(sil:)?(cyl|cone):/.test(unit.id)
    const base = {
      ...(featureId ? { featureId } : {}),
      hole,
      single: unit.onLine !== undefined,
    }
    const push = (
      family: Exclude<FindErrorFamily, 'add-edge' | 'third-angle-layout' | 'swap-top-left'>,
      changed: readonly ViewSegment[],
    ) => {
      if (changed.length === 0) return
      const size = total(changed)
      if (size < MIN_FEATURE_MM) return
      const mutation: DrawingMutation = {
        kind: family,
        view: name,
        edgeIds: [unit.id],
        ...(unit.onLine ? { onLine: unit.onLine } : {}),
      }
      out.push({
        ...base,
        family,
        mutation,
        targets: [{ kind: 'lines', view: name, segments: changed.map(plain), edgeIds: [unit.id] }],
        size,
        interior: changed.some((s) => !onOutline(s, view)),
      })
    }
    // chybějící hrana: jen když na jejím místě nezůstane jiná čára (jinak by z plné čáry byla
    // čárkovaná a chyba by vypadala jako záměna viditelnosti)
    if (unit.pieces.every((p) => others.every((o) => collinearOverlap(p, o) < 0.5))) {
      push('remove-edge', unit.pieces)
    }
    push(
      'hidden-as-visible',
      unit.pieces.filter((p) => p.visibility === 'hidden' && !coveredBy(p, otherVisible)),
    )
    push(
      'visible-as-hidden',
      unit.pieces.filter((p) => p.visibility === 'visible' && !coveredBy(p, otherVisible)),
    )

    // čára navíc: rovná hrana prvku zrcadlená na druhou stranu pohledu (jako by prvek byl i tam)
    if (unit.straight && !unit.onLine && featureId) {
      const { min, max } = view.projection.bounds
      for (const axis of [0, 1] as const) {
        const mirror = (p: Vec2): Vec2 =>
          axis === 0 ? [min[0] + max[0] - p[0], p[1]] : [p[0], min[1] + max[1] - p[1]]
        const mirrored = unit.pieces.map((p) => ({
          a: mirror(p.a),
          b: mirror(p.b),
          visibility: p.visibility,
        }))
        if (!extraEdgeOk(mirrored, view)) continue
        const mutation: DrawingMutation = {
          kind: 'add-edge',
          view: name,
          edgeIds: [extraId],
          segments: mirrored,
        }
        out.push({
          family: 'add-edge',
          mutation,
          targets: [
            { kind: 'lines', view: name, segments: mirrored.map(plain), edgeIds: [extraId] },
          ],
          size: total(mirrored),
          interior: true,
          hole,
          single: false,
        })
      }
    }
  }
  return out
}

/** Čára navíc se nesmí krýt s žádnou čárou ani osou a nesmí s rovnoběžnou čárou splývat. */
function extraEdgeOk(extra: readonly LineSegment2[], view: DrawingView): boolean {
  if (total(extra) < MIN_FEATURE_MM) return false
  const lines: LineSegment2[] = [...view.projection.segments, ...view.centerLines]
  for (const e of extra) {
    const len = segmentLength(e)
    const dir: Vec2 = [(e.b[0] - e.a[0]) / len, (e.b[1] - e.a[1]) / len]
    for (const s of lines) {
      if (collinearOverlap(e, s) > 0.5) return false
      const sl = segmentLength(s)
      if (sl < 1e-9) continue
      const parallel = Math.abs(dir[0] * (s.b[1] - s.a[1]) - dir[1] * (s.b[0] - s.a[0])) / sl < 1e-6
      if (!parallel) continue
      // vzdálenost rovnoběžek a překryv průmětů
      const gap = Math.abs((s.a[0] - e.a[0]) * dir[1] - (s.a[1] - e.a[1]) * dir[0])
      if (gap < 1e-3 || gap >= EXTRA_EDGE_MIN_GAP_MM) continue
      const t = (p: Vec2) => (p[0] - e.a[0]) * dir[0] + (p[1] - e.a[1]) * dir[1]
      const lo = Math.min(t(s.a), t(s.b))
      const hi = Math.max(t(s.a), t(s.b))
      if (Math.min(hi, len) - Math.max(lo, 0) > 0) return false
    }
  }
  return true
}

/** Všichni kandidáti pro výkres (rozmístění + každý pohled). */
export function findErrorCandidates(
  drawing: Drawing,
  featureOf: (edgeId: string) => string | undefined,
): FindErrorCandidate[] {
  const layout = (family: 'third-angle-layout' | 'swap-top-left'): FindErrorCandidate => ({
    family,
    mutation: { kind: family },
    // špatně leží půdorys i bokorys (nárys je pořád uprostřed)
    targets: [
      { kind: 'view', view: 'top' },
      { kind: 'view', view: 'left' },
    ],
    size: 0,
    interior: false,
    hole: false,
    single: false,
  })
  return [
    layout('third-angle-layout'),
    layout('swap-top-left'),
    ...drawing.views.flatMap((v) => viewCandidates(v, featureOf)),
  ]
}

/** Pořadí kandidátů podle obtížnosti: lehké = dlouhé čáry uvnitř pohledu, těžké = jedna čára díry. */
function rankCandidates(
  rng: Rng,
  list: readonly FindErrorCandidate[],
  difficulty: Difficulty,
): FindErrorCandidate[] {
  const score = (c: FindErrorCandidate) => {
    const size = Math.max(c.size, 1)
    switch (difficulty) {
      case 1:
      case 2:
        return size * (c.interior ? 3 : 1) * (c.hole ? 0.5 : 1)
      case 3:
        return rng.next()
      case 4:
        // středně dlouhé čáry (kolem 15 mm), díry a hrany uvnitř pohledu
        return ((c.hole ? 2 : 1) * (c.interior ? 1.5 : 1)) / (1 + Math.abs(Math.log(size / 15)))
      case 5:
        return ((c.hole ? 4 : 1) * (c.single ? 2 : 1)) / Math.sqrt(size)
    }
  }
  const scored = rng
    .shuffle(list)
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
  // náhodně z několika nejlepších, pak ostatní
  const top = rng.shuffle(scored.slice(0, 3))
  return [...top, ...scored.slice(3)]
}

type FindErrorBuilt = Omit<FindErrorTask, 'seed' | 'difficulty' | 'engineVersion' | 'focus'>

/**
 * Úloha „najdi chybu“ pro danou součást, nebo null, když se nepodaří najít viditelnou chybu.
 * `focus`: upřednostněný druh chyby (adaptivita).
 */
export function buildFindErrorTask(
  wasm: ManifoldToplevel,
  rng: Rng,
  part: PartSpec,
  difficulty: Difficulty,
  focus?: ErrorCode,
): FindErrorBuilt | null {
  const views = STANDARD_VIEWS
  const mesh = buildPart(wasm, part)
  const edges = extractEdges(mesh)
  const drawing = createDrawing(part, mesh, { views, edges })
  const correctFp = placedDrawingFingerprint(drawing)
  const candidates = findErrorCandidates(drawing, edgeFeatureLookup(mesh, edges))
  const focusFamily = focus ? findErrorFamilyFor(focus) : undefined

  const weightOf = (f: FindErrorFamily) => FAMILY_WEIGHTS[difficulty][f]
  const families = new Set(
    FIND_ERROR_FAMILIES.filter(
      (f) => (weightOf(f) > 0 || f === focusFamily) && candidates.some((c) => c.family === f),
    ),
  )
  while (families.size > 0) {
    // upřednostněný druh chyby (adaptivita) se zkusí první, i když ho obtížnost jinak nemá
    const family =
      focusFamily && families.has(focusFamily)
        ? focusFamily
        : rng.weighted([...families].map((f) => [f, weightOf(f)] as const))
    families.delete(family)
    const ranked = rankCandidates(
      rng,
      candidates.filter((c) => c.family === family),
      difficulty,
    )
    for (const c of ranked) {
      const mutated = applyFindErrorMutation(drawing, c.mutation)
      if (placedDrawingFingerprint(mutated) === correctFp) continue
      return {
        kind: 'find-error',
        part,
        views,
        mutation: c.mutation,
        errorCode: FIND_ERROR_CODE[c.family],
        ...(c.featureId ? { featureId: c.featureId } : {}),
        targets: c.targets,
        layoutError: c.family === 'third-angle-layout' || c.family === 'swap-top-left',
        toleranceMm: FIND_ERROR_TOLERANCE_MM[difficulty],
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------------------------
// Hodnocení

/** Trefila odpověď místo chyby? */
export function findErrorHit(task: FindErrorTask, answer: FindErrorAnswer): boolean {
  if (answer.pick === 'layout') return task.layoutError
  return task.targets.some((t) => {
    if (t.view !== answer.view) return false
    if (t.kind === 'view') return true
    if (answer.pick === 'point') {
      return t.segments.some((s) => pointSegmentDistance(answer.point, s) <= task.toleranceMm)
    }
    return t.segments.some((s) => segmentIntersectsArea(s, answer.area))
  })
}

/**
 * Vyhodnotí „najdi chybu“. Při minutí vrací kód chyby, která ve výkresu opravdu je (s pohledem
 * a prvkem), a MISSED_ERROR s pohledem, kam uživatel ukázal.
 */
export function evaluateFindError(task: FindErrorTask, answer: FindErrorAnswer): TaskResult {
  if (findErrorHit(task, answer)) return { correct: true, score: 1, errors: [] }
  const where = task.targets[0]
  const actual: TaskError = {
    code: task.errorCode,
    ...(task.featureId ? { featureId: task.featureId } : {}),
    ...(where ? { view: where.view } : {}),
  }
  const missed: TaskError = {
    code: 'MISSED_ERROR',
    ...(answer.pick === 'layout' ? {} : { view: answer.view }),
  }
  return { correct: false, score: 0, errors: [actual, missed] }
}
