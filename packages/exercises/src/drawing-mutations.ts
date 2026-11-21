/**
 * Mutace výkresu (ne tělesa): skrytá hrana nakreslená plnou čarou, viditelná čárkovaně, chybějící hrana,
 * čára navíc. Hrany se vybírají podle id logických hran (`ViewSegment.edgeIds`).
 */
import type { ViewName } from '@vykresovna/drafting-standards'
import type { Drawing, DrawingView, EdgeModel, SolidMesh, ViewSegment } from '@vykresovna/engine'
import { collinear } from './geometry2d'
import { MIN_FEATURE_MM } from './layout'
import type { DrawingMutation, ErrorCode } from './types'

export const DRAWING_MUTATION_ERROR: Readonly<Record<DrawingMutation['kind'], ErrorCode>> = {
  'hidden-as-visible': 'HIDDEN_AS_VISIBLE',
  'visible-as-hidden': 'VISIBLE_AS_HIDDEN',
  'remove-edge': 'MISSING_EDGE',
  'add-edge': 'EXTRA_EDGE',
}

/** Týká se mutace úseku? (Id hrany, případně i přímka `onLine`.) */
export function mutationTouches(seg: ViewSegment, mutation: DrawingMutation): boolean {
  if (!seg.edgeIds.some((id) => mutation.edgeIds.includes(id))) return false
  return mutation.kind === 'add-edge' || !mutation.onLine || collinear(seg, mutation.onLine)
}

function mutateSegments(
  segments: readonly ViewSegment[],
  mutation: DrawingMutation,
): ViewSegment[] {
  const touches = (s: ViewSegment) => mutationTouches(s, mutation)
  switch (mutation.kind) {
    case 'hidden-as-visible':
      return segments.map((s) =>
        s.visibility === 'hidden' && touches(s) ? { ...s, visibility: 'visible' } : s,
      )
    case 'visible-as-hidden':
      return segments.map((s) =>
        s.visibility === 'visible' && touches(s) ? { ...s, visibility: 'hidden' } : s,
      )
    case 'remove-edge':
      return segments.filter((s) => !touches(s))
    case 'add-edge':
      return [
        ...segments,
        ...mutation.segments.map((s) => ({ ...s, edgeIds: [...mutation.edgeIds] })),
      ]
  }
}

/** Použije mutaci na pohled `mutation.view`. Čistá funkce: vrací nový výkres, vstup nemění. */
export function applyDrawingMutation(drawing: Drawing, mutation: DrawingMutation): Drawing {
  return {
    ...drawing,
    views: drawing.views.map((v) =>
      v.view === mutation.view
        ? {
            ...v,
            projection: {
              ...v.projection,
              segments: mutateSegments(v.projection.segments, mutation),
            },
          }
        : v,
    ),
  }
}

/** Mutace jednoho pohledu (pomocník pro porovnání otisků bez kopírování celého výkresu). */
export function applyToView(view: DrawingView, mutation: DrawingMutation): DrawingView {
  return {
    ...view,
    projection: {
      ...view.projection,
      segments: mutateSegments(view.projection.segments, mutation),
    },
  }
}

/** Mapa id hrany → prvek (pro zvýraznění chyby). Obrysy válců `sil:<plocha>` podle plochy. */
export function edgeFeatureLookup(
  mesh: SolidMesh,
  edges: EdgeModel,
): (edgeId: string) => string | undefined {
  const byEdge = new Map<string, string>()
  for (const e of edges.logicalEdges) {
    const f = e.featureIds[0]
    if (f) byEdge.set(e.id, f)
  }
  const bySurface = new Map<string, string>()
  for (const s of mesh.surfaces) if (s.featureId) bySurface.set(s.key, s.featureId)
  return (edgeId) =>
    byEdge.get(edgeId) ?? (edgeId.startsWith('sil:') ? bySurface.get(edgeId.slice(4)) : undefined)
}

export type DrawingMutationCandidate = {
  readonly mutation: DrawingMutation
  readonly featureId?: string
  /** Hrana mimo obrys pohledu (zajímavější než hrana vnějšího obrysu). */
  readonly interior: boolean
}

const segLength = (s: ViewSegment) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])

/**
 * Kandidáti na mutaci pohledu: každý úsek dost dlouhý na to, aby byla změna vidět, dá jednu mutaci
 * každého použitelného druhu. Odlišnost od správného pohledu se ověřuje až otiskem.
 */
export function drawingMutationCandidates(
  view: DrawingView,
  featureOf: (edgeId: string) => string | undefined,
): DrawingMutationCandidate[] {
  const { min, max } = view.projection.bounds
  const onOutline = (s: ViewSegment) => {
    const eps = 1e-6
    const sameU = Math.abs(s.a[0] - s.b[0]) < eps
    const sameV = Math.abs(s.a[1] - s.b[1]) < eps
    return (
      (sameU && (Math.abs(s.a[0] - min[0]) < eps || Math.abs(s.a[0] - max[0]) < eps)) ||
      (sameV && (Math.abs(s.a[1] - min[1]) < eps || Math.abs(s.a[1] - max[1]) < eps))
    )
  }
  const out: DrawingMutationCandidate[] = []
  const seen = new Set<string>()
  const name: ViewName = view.view
  for (const s of view.projection.segments) {
    if (segLength(s) < MIN_FEATURE_MM || s.edgeIds.length === 0) continue
    const kinds: Exclude<DrawingMutation['kind'], 'add-edge'>[] =
      s.visibility === 'hidden'
        ? ['hidden-as-visible', 'remove-edge']
        : ['visible-as-hidden', 'remove-edge']
    for (const kind of kinds) {
      const key = `${kind}:${s.edgeIds.join(' ')}`
      if (seen.has(key)) continue
      seen.add(key)
      const featureId = s.edgeIds.map(featureOf).find((f) => f !== undefined)
      out.push({
        mutation: { kind, view: name, edgeIds: [...s.edgeIds] },
        ...(featureId ? { featureId } : {}),
        interior: !onOutline(s),
      })
    }
  }
  return out
}
