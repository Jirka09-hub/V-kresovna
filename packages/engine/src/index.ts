/**
 * Engine Výkresovny: parametrické součásti, boolovské operace, projekce, viditelnost hran, SVG výkres.
 * Nesmí importovat React, Next.js, DOM ani Supabase (běží v prohlížeči, workeru i Node).
 */
export { ENGINE_VERSION } from './version'

export * from './part/spec'
export * from './part/validate'
export { buildPart, InvalidPartError } from './part/build'
export { loadManifold, CIRCULAR_SEGMENTS, type ManifoldInitOptions } from './csg/manifold'
export type { SolidMesh, SurfaceInfo, CylinderInfo } from './mesh/types'
export {
  extractEdges,
  SHARP_EDGE_ANGLE_DEG,
  type EdgeModel,
  type LogicalEdge,
} from './edges/extract'
export {
  projectView,
  viewBasis,
  type Vec2,
  type ViewBasis,
  type ViewProjection,
  type ViewSegment,
  type EdgeVisibility,
} from './projection/hlr'
export * from './drawing/drawing'
export { drawingToSvg, scopeCss, DRAWING_ROOT_CLASS, type SvgOptions } from './drawing/svg'
export {
  canonicalView,
  drawingFingerprint,
  viewFingerprint,
  visualFingerprint,
  FINGERPRINT_PRECISION_MM,
  VISUAL_DIFFERENCE_MM,
} from './drawing/fingerprint'
export { TEST_PARTS } from './fixtures/test-parts'
export * from './dimensions'
export { toRenderData, transferables, type PartRenderData, type RenderEdge } from './render-data'
export * from './section'
export { SECTION_TEST_CASES, type SectionTestCase } from './fixtures/section-parts'
