/**
 * Řezy (plný řez rovinou kolmou na hlavní osu). Čistý TypeScript bez WASM: podmodul
 * `@vykresovna/engine/section` smí importovat i hlavní vlákno prohlížeče (3D prohlížeč počítá
 * plochu řezu při tažení roviny sám, D-016).
 */
export * from './types'
export {
  cutSolid,
  cutSolidWithCap,
  sectionCap,
  COPLANAR_NUDGE_MM,
  type CutPlane,
  type MeshInput,
  type SectionCap,
} from './cut'
export { hatchLines } from './hatch'
export {
  triangulateFace,
  groupRings,
  signedArea2,
  pointInRing,
  type RingPoint,
} from './triangulate'
export {
  cutPlaneOf,
  viewFromOf,
  prepareSection,
  fitSectionAnnotations,
  sectionAnnotationBoxes,
  InvalidSectionError,
  LETTER_WIDTH_FACTOR,
  CAP_HEIGHT_EM,
  DEFAULT_SECTION_VIEW,
  type PreparedSection,
} from './view'
