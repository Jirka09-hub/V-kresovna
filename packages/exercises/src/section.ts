/**
 * Cvičení 5 „Řez“ (D-024): vyber správný řez A–A (1 ze 4), nebo umísti rovinu řezu ve 3D.
 *
 * Roviny řezu se volí jako v praxi: osou díry (díra je pak v řezu vidět celá) nebo napříč drážkou.
 * Distraktory: šrafy přes díru, chybějící šrafy, jiná rovina, skryté hrany v řezu, pohled z druhé
 * strany a řez jinak upravené součásti. Každý se ověří otiskem pohledu v řezu (včetně ploch řezu
 * a šraf), takže se viditelně liší od správné odpovědi i od ostatních možností.
 */
import { drillPointHeight, STANDARD_VIEWS, type ViewName } from '@vykresovna/drafting-standards'
import {
  AXIS_INDEX,
  buildPart,
  createDrawing,
  cutPlaneOf,
  cutSolidWithCap,
  DEFAULT_SECTION_VIEW,
  DRAWING_MARGIN_MM,
  extractEdges,
  fitSectionAnnotations,
  otherAxes,
  partBounds,
  projectView,
  viewFingerprint,
  viewFromOf,
  type Axis,
  type Drawing,
  type DrawingView,
  type EdgeModel,
  type PartSpec,
  type SectionSpec,
  type SolidMesh,
} from '@vykresovna/engine'
import type { ManifoldToplevel } from 'manifold-3d'
import { CandidateStreams, selectDistinct } from './candidates'
import { addRandomFeature, type FeatureRecipe } from './generator'
import { featureRegion } from './layout'
import { partMutations } from './part-mutations'
import type { Rng } from './rng'
import type {
  Difficulty,
  ErrorCode,
  PlaneInterval,
  SectionAnswer,
  SectionChooseTask,
  SectionOption,
  SectionPlaceTask,
  SectionRender,
  SectionTask,
  TaskResult,
} from './types'

/** Písmeno řezu ve cvičení. */
export const SECTION_LABEL = 'A'

/** Pohled z opačné strany (řez viděný z druhé strany je zrcadlový). */
export const OPPOSITE_VIEW: Readonly<Record<ViewName, ViewName>> = {
  front: 'rear',
  rear: 'front',
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
}

/** Pohled se stopou roviny řezu podle osy (rovina v něm leží „na hraně“). */
export const CUTTING_PLANE_VIEW: Readonly<Record<Axis, ViewName>> = {
  x: 'front',
  y: 'top',
  z: 'front',
}

/** Krok posuvníku roviny řezu (mm). */
export const SECTION_PLACE_STEP_MM = 0.5

/**
 * Tolerance polohy roviny podle obtížnosti (mm). Skutečná tolerance je navíc nejvýš 60 % vzdálenosti
 * k nejbližšímu místu, kde se řez mění (hrana díry, stěna drážky), aby se řez v toleranci neměnil
 * podstatně. Nejsou to normy, jen nastavení cvičení.
 */
export const SECTION_PLACE_TOLERANCE_MM: Readonly<Record<Difficulty, number>> = {
  1: 3,
  2: 2.5,
  3: 2,
  4: 1.5,
  5: 1,
}

/**
 * Nejmenší přípustná tolerance (mm): rovina, u které by se řez měnil už o necelé dva kroky
 * posuvníku, se pro „umísti rovinu“ nepoužije (trefit ji ve 3D by bylo spíš štěstí).
 */
export const SECTION_PLACE_MIN_TOLERANCE_MM = 1

/** Pravděpodobnost varianty „umísti rovinu“ (jinak „vyber řez“). */
const PLACE_CHANCE = 0.4

// ---------------------------------------------------------------------------------------------
// Součást s něčím, co má smysl řezat

/** Plán prvků součásti pro řez podle obtížnosti (vždy aspoň jedna díra). */
function sectionPlan(rng: Rng, difficulty: Difficulty): FeatureRecipe[] {
  const other = () => rng.pick(['slot', 'step', 'corner', 'pocket'] as const)
  switch (difficulty) {
    case 1:
      return rng.chance(0.5) ? ['throughHole'] : ['throughHole', 'corner']
    case 2:
      return ['throughHole', rng.pick(['slot', 'corner', 'step'] as const)]
    case 3:
      return ['blindHole', other(), ...(rng.chance(0.5) ? (['throughHole'] as const) : [])]
    case 4:
      return ['blindHole', 'anyHole', other()]
    case 5:
      return [
        'blindHole',
        'anyHole',
        'anyHole',
        other(),
        ...(rng.chance(0.4) ? (['chamfer'] as const) : []),
      ]
  }
}

/** Součást pro cvičení „řez“: kvádr s dírami (a podle obtížnosti dalšími prvky). */
export function generateSectionPart(rng: Rng, difficulty: Difficulty, id: string): PartSpec | null {
  for (let restart = 0; restart < 40; restart++) {
    const recipes = sectionPlan(rng, difficulty)
    const base: [number, number, number] =
      difficulty <= 2
        ? [5 * rng.int(12, 18), 5 * rng.int(8, 12), 5 * rng.int(6, 9)]
        : [5 * rng.int(12, 20), 5 * rng.int(8, 14), 5 * rng.int(6, 11)]
    let spec: PartSpec | null = { id, base: { kind: 'block', size: base }, features: [] }
    for (const recipe of recipes) {
      spec = addRandomFeature(rng, spec, recipe, {
        big: difficulty === 1,
        snap: difficulty === 5 ? 0.3 : 0,
      })
      if (!spec) break
    }
    if (spec) return spec
  }
  return null
}

/** Rovina řezu, kterou má smysl zvolit: osou díry, nebo napříč drážkou. */
export type PlaneCandidate = {
  readonly axis: Axis
  readonly at: number
  readonly featureId: string
  readonly weight: number
}

const AXIS_WEIGHT: Readonly<Record<Axis, number>> = { y: 3, x: 2, z: 1 }

/** Roviny řezu podle prvků součásti (jako v praxi: osou díry, napříč drážkou). */
export function planeCandidates(spec: PartSpec): PlaneCandidate[] {
  const out: PlaneCandidate[] = []
  const size = spec.base.size
  for (const f of spec.features) {
    if (f.kind === 'hole') {
      const [a, b] = otherAxes(f.axis)
      out.push({ axis: a, at: f.at[0], featureId: f.id, weight: AXIS_WEIGHT[a] })
      out.push({ axis: b, at: f.at[1], featureId: f.id, weight: AXIS_WEIGHT[b] })
    } else if (f.kind === 'slot') {
      // drážka prochází celou součástí ve směru `along`: řez napříč uprostřed délky
      const along = (['x', 'y', 'z'] as const).find((axis) => {
        const i = AXIS_INDEX[axis]
        return f.box.min[i]! <= 0 && f.box.max[i]! >= size[i]!
      })
      if (along) {
        const at = Math.round(size[AXIS_INDEX[along]]! / 2)
        out.push({ axis: along, at, featureId: f.id, weight: 0.5 * AXIS_WEIGHT[along] })
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Kreslení řezu

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)]

/** Jeden pohled výkresu jako samostatný výkres (s místem pro popisy řezu). */
export function isolateView(drawing: Drawing, name: ViewName): Drawing {
  const v = drawing.views.find((x) => x.view === name)
  if (!v) throw new Error(`pohled ${name} není ve výkresu`)
  const m = DRAWING_MARGIN_MM
  return fitSectionAnnotations(
    {
      ...drawing,
      views: [{ ...v, origin: [m, m] }],
      width: v.size[0] + 2 * m,
      height: v.size[1] + 2 * m,
    },
    m,
  )
}

/** Skryté hrany zbytku součásti za rovinou řezu (pro distraktor „skryté hrany v řezu“). */
function hiddenSegmentsBehind(mesh: SolidMesh, r: SectionRender) {
  const cut = cutSolidWithCap(mesh, cutPlaneOf(r.section, r.view), `section:${r.section.label}`)
  return projectView(cut.solid, extractEdges(cut.solid), r.view).segments.filter(
    (s) => s.visibility === 'hidden',
  )
}

function applySectionMutation(drawing: Drawing, mesh: SolidMesh, r: SectionRender): Drawing {
  if (!r.mutation) return drawing
  const views = drawing.views.map((v): DrawingView => {
    if (v.view !== r.view || !v.section) return v
    if (r.mutation === 'no-hatching') return { ...v, section: { ...v.section, hatching: [] } }
    return {
      ...v,
      projection: {
        ...v.projection,
        segments: [...v.projection.segments, ...hiddenSegmentsBehind(mesh, r)],
      },
    }
  })
  return { ...drawing, views }
}

/** Celý výkres s řezem (včetně pohledu nahrazeného řezem a pohledu se stopou). */
export function sectionDrawing(mesh: SolidMesh, r: SectionRender, edges?: EdgeModel): Drawing {
  const views = unique([r.view, ...(r.cuttingPlaneView ? [r.cuttingPlaneView] : []), ...r.show])
  const drawing = createDrawing(r.part, mesh, {
    views,
    ...(edges ? { edges } : {}),
    section: { spec: r.section, view: r.view, cuttingPlaneView: r.cuttingPlaneView },
  })
  return applySectionMutation(drawing, mesh, r)
}

/** Pohledy `r.show` jako samostatné výkresy (pro mřížku pohledů a karty možností v UI). */
export function sectionViews(mesh: SolidMesh, r: SectionRender, edges?: EdgeModel): Drawing[] {
  const drawing = sectionDrawing(mesh, r, edges)
  return r.show.map((v) => isolateView(drawing, v))
}

/** Totéž ze součásti (postaví těleso): pomocník pro worker a testy. */
export function buildSectionViews(wasm: ManifoldToplevel, r: SectionRender): Drawing[] {
  return sectionViews(buildPart(wasm, r.part), r)
}

/** Jak vykreslit možnost úlohy (jen pohled v řezu, bez stopy). */
export function optionRender(option: SectionOption): SectionRender {
  return {
    part: option.part,
    section: option.section,
    view: option.view,
    cuttingPlaneView: null,
    show: [option.view],
    ...(option.mutation ? { mutation: option.mutation } : {}),
  }
}

/** Jak vykreslit dané pohledy úlohy 5a (stopa A–A v pohledu `cuttingPlaneView`). */
export function givenRender(task: SectionChooseTask): SectionRender {
  return {
    part: task.part,
    section: task.section,
    view: task.view,
    cuttingPlaneView: task.cuttingPlaneView,
    show: task.givenViews,
  }
}

/** Jak vykreslit správný řez úlohy (bez stopy): zadání 5b a zpětná vazba. */
export function targetRender(task: SectionTask): SectionRender {
  return {
    part: task.part,
    section: task.section,
    view: task.view,
    cuttingPlaneView: null,
    show: [task.view],
  }
}

// ---------------------------------------------------------------------------------------------
// Generátor

/** Sestavení součástí s mezipamětí (id součásti se ignoruje). */
class MeshCache {
  private readonly cache = new Map<string, { mesh: SolidMesh; edges: EdgeModel }>()
  constructor(private readonly wasm: ManifoldToplevel) {}
  get(spec: PartSpec) {
    const key = JSON.stringify([spec.base, spec.features])
    let hit = this.cache.get(key)
    if (!hit) {
      const mesh = buildPart(this.wasm, spec)
      hit = { mesh, edges: extractEdges(mesh) }
      this.cache.set(key, hit)
    }
    return hit
  }
}

/**
 * Otisk pohledu v řezu tak, jak ho uživatel uvidí, a otisk bez os (null = řez nejde nakreslit).
 * Distraktor se musí lišit i bez os: rozdíl jen v délce osy by byl nefér.
 */
function sectionFps(meshes: MeshCache, r: SectionRender): { fp: string; lines: string } | null {
  const { mesh, edges } = meshes.get(r.part)
  try {
    const drawing = sectionDrawing(mesh, { ...r, cuttingPlaneView: null, show: [r.view] }, edges)
    const v = drawing.views.find((x) => x.view === r.view)!
    return { fp: viewFingerprint(v), lines: viewFingerprint({ ...v, centerLines: [] }) }
  } catch {
    return null
  }
}

const sectionFp = (meshes: MeshCache, r: SectionRender) => sectionFps(meshes, r)?.fp ?? null

const sectionSpec = (axis: Axis, at: number, viewFrom?: 'min' | 'max'): SectionSpec => ({
  axis,
  at,
  label: SECTION_LABEL,
  ...(viewFrom ? { viewFrom } : {}),
})

/**
 * Místa na ose řezu, kde se řez mění skokem (stěny prvků), a úseky, kde se mění plynule (díra
 * napříč, kuželové dno, zkosení napříč). Mezi dvěma místy mimo plynulé úseky vypadá řez všude stejně.
 */
export function sectionEvents(
  spec: PartSpec,
  axis: Axis,
): { cuts: number[]; continuous: PlaneInterval[] } {
  const i = AXIS_INDEX[axis]
  const size = spec.base.size
  const bounds = partBounds(spec)
  const cuts = [bounds.min[i]!, bounds.max[i]!]
  const continuous: PlaneInterval[] = []
  for (const f of spec.features) {
    const region = featureRegion(f, size)
    const lo = region.min[i]!
    const hi = region.max[i]!
    if (f.kind === 'rib') {
      cuts.push(f.box.min[i]!, f.box.max[i]!)
      continue
    }
    cuts.push(lo, hi)
    if (f.kind === 'hole') {
      if (f.axis !== axis) continuous.push({ min: lo, max: hi })
      else if (f.depth !== undefined) {
        // kuželové dno: průměr se mění plynule
        const tip = drillPointHeight(f.diameter)
        const bottom = f.from === 'max' ? size[i]! - f.depth : f.depth
        const tipEnd = f.from === 'max' ? bottom - tip : bottom + tip
        cuts.push(bottom, tipEnd)
        continuous.push({ min: Math.min(bottom, tipEnd), max: Math.max(bottom, tipEnd) })
      }
    } else if (f.kind === 'chamfer' && f.along !== axis) {
      const touches = lo > bounds.min[i]! + 1e-9 || hi < bounds.max[i]! - 1e-9
      if (touches) continuous.push({ min: lo, max: hi })
    }
  }
  const sorted = [...new Set(cuts.map((c) => Math.round(c * 1e6) / 1e6))].sort((a, b) => a - b)
  return { cuts: sorted, continuous }
}

function mergeIntervals(list: readonly PlaneInterval[]): PlaneInterval[] {
  const sorted = [...list].sort((a, b) => a.min - b.min)
  const out: PlaneInterval[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv.min <= last.max + 1e-9)
      out[out.length - 1] = { ...last, max: Math.max(last.max, iv.max) }
    else out.push({ ...iv })
  }
  return out
}

/**
 * Polohy roviny, ve kterých vypadá řez stejně jako ve správné poloze: úseky se stálým řezem
 * (otisk uprostřed úseku) a jiné roviny řezu stejného druhu (např. osa jiné stejné díry).
 */
function equivalentPositions(
  meshes: MeshCache,
  spec: PartSpec,
  base: Omit<SectionRender, 'section'>,
  axis: Axis,
  at: number,
  targetFp: string,
): PlaneInterval[] {
  const { cuts, continuous } = sectionEvents(spec, axis)
  const out: PlaneInterval[] = [{ min: at, max: at }]
  const fpAt = (x: number) => sectionFp(meshes, { ...base, section: sectionSpec(axis, x) })
  for (let k = 0; k + 1 < cuts.length; k++) {
    const lo = cuts[k]!
    const hi = cuts[k + 1]!
    if (hi - lo < 1e-3) continue
    if (continuous.some((c) => c.min < hi - 1e-6 && c.max > lo + 1e-6)) continue
    if (fpAt((lo + hi) / 2) === targetFp) out.push({ min: lo, max: hi })
  }
  for (const c of planeCandidates(spec)) {
    if (c.axis === axis && Math.abs(c.at - at) > 1e-6 && fpAt(c.at) === targetFp) {
      out.push({ min: c.at, max: c.at })
    }
  }
  return mergeIntervals(out)
}

type SectionCat =
  'holeHatched' | 'noHatching' | 'wrongPlane' | 'hiddenEdges' | 'wrongDirection' | 'mutated'

const ALL_CATS: readonly SectionCat[] = [
  'holeHatched',
  'noHatching',
  'wrongPlane',
  'hiddenEdges',
  'wrongDirection',
  'mutated',
]

/** Preferované druhy distraktorů pro tři místa podle obtížnosti (zbylé druhy jako záloha). */
const SECTION_SLOTS: Readonly<Record<Difficulty, readonly (readonly SectionCat[])[]>> = {
  1: [
    ['holeHatched', 'noHatching'],
    ['noHatching', 'wrongPlane'],
    ['wrongPlane', 'holeHatched'],
  ],
  2: [
    ['holeHatched', 'noHatching'],
    ['wrongPlane', 'wrongDirection'],
    ['noHatching', 'wrongDirection'],
  ],
  3: [
    ['wrongDirection', 'wrongPlane'],
    ['hiddenEdges', 'holeHatched'],
    ['holeHatched', 'mutated', 'noHatching'],
  ],
  4: [
    ['hiddenEdges', 'wrongDirection'],
    ['wrongDirection', 'mutated'],
    ['mutated', 'holeHatched', 'wrongPlane'],
  ],
  5: [
    ['mutated', 'hiddenEdges'],
    ['hiddenEdges', 'wrongDirection'],
    ['wrongDirection', 'mutated', 'wrongPlane'],
  ],
}

const withFallback = (prefs: readonly SectionCat[]): SectionCat[] => [
  ...prefs,
  ...ALL_CATS.filter((c) => !prefs.includes(c)),
]

type SectionDistractor = { readonly fp: string; readonly option: Omit<SectionOption, 'id'> }

/** Kolik mutací tělesa se nejvýš zkusí sestavit. */
const MAX_MUTATED_BUILDS = 6

/** Úloha bez metadat (seed, obtížnost, verze); distributivně přes varianty. */
type Built<T> = T extends unknown ? Omit<T, 'seed' | 'difficulty' | 'engineVersion'> : never

function chooseVariant(
  meshes: MeshCache,
  rng: Rng,
  part: PartSpec,
  difficulty: Difficulty,
  plane: PlaneCandidate,
  view: ViewName,
  correct: { fp: string; lines: string },
): Built<SectionChooseTask> | null {
  const { axis, at, featureId } = plane
  const spec = sectionSpec(axis, at)
  const cuttingPlaneView = CUTTING_PLANE_VIEW[axis]
  const givenViews = STANDARD_VIEWS.filter((v) => v !== view)
  const option = (
    o: Partial<Omit<SectionOption, 'id'>> & Pick<SectionOption, 'errorCode'>,
  ): Omit<SectionOption, 'id'> => ({ part, section: spec, view, ...o })
  // možnosti se musí lišit i bez os (dvě možnosti lišící se jen osou díry by byly skoro stejné)
  const item = (o: Omit<SectionOption, 'id'>): SectionDistractor | undefined => {
    const fps = sectionFps(meshes, optionRender({ ...o, id: '' }))
    return fps && fps.lines !== correct.lines ? { fp: fps.lines, option: o } : undefined
  }
  const single = (cat: SectionCat, make: () => Omit<SectionOption, 'id'>) => {
    let done = false
    return () => {
      if (done) return null
      done = true
      const it = item(make())
      return it ? { cat, item: it } : undefined
    }
  }
  const fromList = <T>(
    cat: SectionCat,
    list: readonly T[],
    make: (x: T) => Omit<SectionOption, 'id'>,
  ) => {
    let i = 0
    return () => {
      if (i >= list.length) return null
      const it = item(make(list[i++]!))
      return it ? { cat, item: it } : undefined
    }
  }

  // šrafy přes díru (drážku): řez součásti bez prvku, kterým rovina prochází
  const cutFeatures = unique([
    featureId,
    ...planeCandidates(part)
      .filter((c) => c.axis === axis && Math.abs(c.at - at) < 1e-6)
      .map((c) => c.featureId),
  ])
  const holeHatched = fromList('holeHatched', cutFeatures, (id) =>
    option({
      part: { ...part, features: part.features.filter((f) => f.id !== id) },
      errorCode: 'SECTION_HOLE_HATCHED',
      featureId: id,
    }),
  )
  // jiná rovina: osa jiné díry na stejné ose, pak středy úseků mezi stěnami prvků
  const { cuts } = sectionEvents(part, axis)
  const otherPlanes = unique([
    ...rng.shuffle(
      planeCandidates(part)
        .filter((c) => c.axis === axis && Math.abs(c.at - at) > 1e-6)
        .map((c) => c.at),
    ),
    ...rng.shuffle(
      cuts
        .slice(0, -1)
        .map((c, k) => Math.round((c + cuts[k + 1]!) / 2))
        .filter((x) => Math.abs(x - at) > 1e-6 && x > cuts[0]! && x < cuts[cuts.length - 1]!),
    ),
  ])
  const wrongPlane = fromList('wrongPlane', otherPlanes, (x) =>
    option({ section: sectionSpec(axis, x), errorCode: 'WRONG_SECTION_PLANE', featureId }),
  )
  const opposite = OPPOSITE_VIEW[view]
  const from = viewFromOf(view, spec)
  const wrongDirection = single('wrongDirection', () =>
    option({
      section: sectionSpec(axis, at, from === 'min' ? 'max' : 'min'),
      view: opposite,
      errorCode: 'SECTION_WRONG_DIRECTION',
      featureId,
    }),
  )
  const noHatching = single('noHatching', () =>
    option({ mutation: 'no-hatching', errorCode: 'SECTION_NOT_HATCHED', featureId }),
  )
  const hiddenEdges = single('hiddenEdges', () =>
    option({ mutation: 'hidden-edges', errorCode: 'SECTION_HIDDEN_EDGES' }),
  )
  const mutations = partMutations(rng, part, difficulty)
    .filter((m) => m.kind !== 'mirror')
    .slice(0, MAX_MUTATED_BUILDS)
  const mutated = fromList('mutated', mutations, (m) =>
    option({
      part: m.part,
      errorCode: m.errorCode,
      ...(m.featureId ? { featureId: m.featureId } : {}),
    }),
  )

  const streams = new CandidateStreams<SectionCat, SectionDistractor>([
    { cats: ['noHatching'], next: noHatching, cheap: true },
    { cats: ['wrongDirection'], next: wrongDirection, cheap: true },
    { cats: ['hiddenEdges'], next: hiddenEdges, cheap: true },
    { cats: ['wrongPlane'], next: wrongPlane, cheap: true },
    { cats: ['holeHatched'], next: holeHatched },
    { cats: ['mutated'], next: mutated },
  ])
  const picked = selectDistinct(
    streams,
    SECTION_SLOTS[difficulty].map(withFallback),
    correct.lines,
    true,
  )
  if (!picked) return null
  const options = rng
    .shuffle([option({ errorCode: null }), ...picked.map((p) => p.option)])
    .map((o, i) => {
      const id = `m${i + 1}`
      return { ...o, id, part: { ...o.part, id: `${part.id}/${id}` } }
    })
  return {
    kind: 'section',
    variant: 'choose',
    part,
    section: spec,
    view,
    featureId,
    cuttingPlaneView,
    givenViews,
    options,
  }
}

const snap = (x: number, step: number) => Math.round(x / step) * step + 0

function placeVariant(
  meshes: MeshCache,
  part: PartSpec,
  difficulty: Difficulty,
  plane: PlaneCandidate,
  view: ViewName,
  correctFp: string,
): Built<SectionPlaceTask> | null {
  const { axis, at, featureId } = plane
  const i = AXIS_INDEX[axis]
  const bounds = partBounds(part)
  const step = SECTION_PLACE_STEP_MM
  const range: PlaneInterval = { min: bounds.min[i]! + step, max: bounds.max[i]! - step }
  // tolerance: podle obtížnosti, ale menší než vzdálenost k nejbližší změně řezu
  const { cuts } = sectionEvents(part, axis)
  const gap = Math.min(...cuts.map((c) => Math.abs(c - at)).filter((d) => d > 1e-6))
  const toleranceMm = Math.min(
    SECTION_PLACE_TOLERANCE_MM[difficulty],
    Math.floor(gap * 0.6 * 2) / 2,
  )
  if (toleranceMm < SECTION_PLACE_MIN_TOLERANCE_MM) return null
  const base = { part, view, cuttingPlaneView: null, show: [view] } as const
  const accepted = equivalentPositions(meshes, part, base, axis, at, correctFp)
  const distance = (x: number) =>
    Math.min(...accepted.map((iv) => (x < iv.min ? iv.min - x : x > iv.max ? x - iv.max : 0)))
  // výchozí poloha daleko od správné (blíž ke vzdálenějšímu konci)
  const len = range.max - range.min
  const ends = at - range.min > range.max - at ? [range.min, range.max] : [range.max, range.min]
  let start: number | null = null
  for (const end of ends) {
    for (const frac of [0.12, 0.25, 0.4]) {
      const x = snap(end === range.min ? range.min + frac * len : range.max - frac * len, step)
      if (distance(x) > 2 * toleranceMm + 1) {
        start = x
        break
      }
    }
    if (start !== null) break
  }
  if (start === null) return null
  return {
    kind: 'section',
    variant: 'place',
    part,
    section: sectionSpec(axis, at),
    view,
    featureId,
    range,
    step,
    start,
    toleranceMm,
    accepted,
  }
}

/**
 * Úloha „řez“ pro danou součást (null = pro tuto součást nejde, generátor zkusí jinou). Varianta
 * (vyber řez / umísti rovinu) se losuje ze seedu.
 */
export function buildSectionTask(
  wasm: ManifoldToplevel,
  rng: Rng,
  part: PartSpec,
  difficulty: Difficulty,
): Built<SectionTask> | null {
  const meshes = new MeshCache(wasm)
  const place = rng.chance(PLACE_CHANCE)
  const candidates = planeCandidates(part)
  if (candidates.length === 0) return null
  const order: PlaneCandidate[] = []
  const pool = [...candidates]
  while (pool.length > 0) {
    const c = rng.weighted(pool.map((p) => [p, p.weight] as const))
    order.push(c)
    pool.splice(pool.indexOf(c), 1)
  }
  for (const plane of order.slice(0, 3)) {
    const view = DEFAULT_SECTION_VIEW[plane.axis]
    const fps = sectionFps(meshes, {
      part,
      section: sectionSpec(plane.axis, plane.at),
      view,
      cuttingPlaneView: null,
      show: [view],
    })
    if (!fps) continue
    const t = place
      ? placeVariant(meshes, part, difficulty, plane, view, fps.fp)
      : chooseVariant(meshes, rng, part, difficulty, plane, view, fps)
    if (t) return t
  }
  return null
}

/** Vzdálenost polohy od nejbližší přijatelné polohy (mm). */
export function distanceToAccepted(task: SectionPlaceTask, at: number): number {
  return Math.min(
    ...task.accepted.map((iv) => (at < iv.min ? iv.min - at : at > iv.max ? at - iv.max : 0)),
  )
}

/** Hodnocení odpovědi na řez. */
export function evaluateSection(task: SectionTask, answer: SectionAnswer): TaskResult {
  if (task.variant === 'place') {
    if (!('at' in answer)) throw new Error('odpověď neodpovídá variantě úlohy')
    const ok = distanceToAccepted(task, answer.at) <= task.toleranceMm + 1e-9
    if (ok) return { correct: true, score: 1, errors: [] }
    return {
      correct: false,
      score: 0,
      errors: [{ code: 'WRONG_SECTION_PLANE', featureId: task.featureId, view: task.view }],
    }
  }
  if (!('optionId' in answer)) throw new Error('odpověď neodpovídá variantě úlohy')
  const option = task.options.find((o) => o.id === answer.optionId)
  if (!option) throw new Error(`neznámá možnost ${answer.optionId}`)
  if (option.errorCode === null) return { correct: true, score: 1, errors: [] }
  const code: ErrorCode = option.errorCode
  return {
    correct: false,
    score: 0,
    errors: [
      { code, ...(option.featureId ? { featureId: option.featureId } : {}), view: task.view },
    ],
  }
}
