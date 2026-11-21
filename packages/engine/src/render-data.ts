import type { Vec3, ViewName } from '@vykresovna/drafting-standards'
import type { Drawing } from './drawing/drawing'
import { drawingToSvg } from './drawing/svg'
import type { EdgeModel } from './edges/extract'
import type { SolidMesh } from './mesh/types'
import type { ViewProjection } from './projection/hlr'

/**
 * Data pro vykreslení součásti v UI (3D síť, hrany, pohledy a SVG výkres).
 * Jen typovaná pole a čisté objekty, aby šla posílat z Web Workeru (structured clone, přenos bufferů).
 */
export type RenderEdge = {
  readonly id: string
  /** Souřadnice bodů lomené čáry (x, y, z, x, y, z, …) v souřadnicích enginu. */
  readonly points: Float32Array
  readonly closed: boolean
  readonly featureIds: readonly string[]
}

export type PartRenderData = {
  readonly partId: string
  readonly positions: Float32Array
  readonly indices: Uint32Array
  readonly edges: readonly RenderEdge[]
  readonly bbox: { readonly min: Vec3; readonly max: Vec3 }
  readonly views: readonly ViewProjection[]
  readonly viewNames: readonly ViewName[]
  readonly svg: string
}

export function toRenderData(
  mesh: SolidMesh,
  edges: EdgeModel,
  drawing: Drawing,
  svgTitle?: string,
): PartRenderData {
  const renderEdges: RenderEdge[] = edges.logicalEdges.map((e) => {
    const pts = new Float32Array(e.vertices.length * 3)
    e.vertices.forEach((v, i) => {
      pts[i * 3] = mesh.positions[v * 3]!
      pts[i * 3 + 1] = mesh.positions[v * 3 + 1]!
      pts[i * 3 + 2] = mesh.positions[v * 3 + 2]!
    })
    return { id: e.id, points: pts, closed: e.closed, featureIds: e.featureIds }
  })
  return {
    partId: drawing.partId,
    positions: Float32Array.from(mesh.positions),
    indices: Uint32Array.from(mesh.triangles),
    edges: renderEdges,
    bbox: mesh.bbox,
    views: drawing.views.map((v) => v.projection),
    viewNames: drawing.views.map((v) => v.view),
    svg: drawingToSvg(drawing, svgTitle ? { title: svgTitle } : {}),
  }
}

/** Buffery, které lze při posílání z workeru přenést bez kopírování. */
export function transferables(data: PartRenderData): ArrayBuffer[] {
  return [
    data.positions.buffer as ArrayBuffer,
    data.indices.buffer as ArrayBuffer,
    ...data.edges.map((e) => e.points.buffer as ArrayBuffer),
  ]
}
