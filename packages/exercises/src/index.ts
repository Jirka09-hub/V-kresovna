/**
 * Generátory úloh, distraktory a hodnocení s kódy chyb. Bez UI, bez DOM.
 *
 * - `generatePart(seed, obtížnost)`: náhodná čitelná součást (generator.ts),
 * - `generateTask(wasm, typ, seed, obtížnost)`: úloha s distraktory ověřenými otiskem výkresu (tasks.ts),
 * - `evaluate(úloha, odpověď)`: výsledek s kódy chyb (evaluate.ts),
 * - `applyDrawingMutation(výkres, mutace)`: chybný výkres pro distraktor (drawing-mutations.ts),
 * - „najdi chybu“: chybný výkres, místa chyby a hodnocení kliknutí (find-error.ts),
 * - „řez“: roviny řezu, distraktory a výkresy řezu (section.ts), „odečti kótu“ (dimension.ts),
 * - `pickNextTask(historie, seed, plán)`: adaptivní výběr další úlohy (adaptivity.ts).
 */
export * from './types'
export { createRng, deriveSeed, type Rng } from './rng'
export { generatePart, generatePartWith, type FeatureRecipe } from './generator'
export { layoutOk, MIN_FEATURE_MM, MIN_WALL_MM, HOLE_DIAMETERS } from './layout'
export {
  partMutations,
  mirrorPart,
  type PartMutation,
  type PartMutationKind,
} from './part-mutations'
export {
  applyDrawingMutation,
  drawingMutationCandidates,
  DRAWING_MUTATION_ERROR,
  mutationTouches,
  type DrawingMutationCandidate,
} from './drawing-mutations'
export {
  generateTask,
  buildOptionDrawing,
  assignViewCards,
  SLOTS_AROUND_FRONT,
  type GenerateTaskOptions,
} from './tasks'
export {
  applyFindErrorMutation,
  buildFindErrorDrawing,
  evaluateFindError,
  findErrorCandidates,
  findErrorFamilyFor,
  findErrorHit,
  findErrorPositions,
  placedDrawingFingerprint,
  placeViews,
  viewPlacements,
  FIND_ERROR_CODE,
  FIND_ERROR_FAMILIES,
  FIND_ERROR_TOLERANCE_MM,
  type FindErrorCandidate,
  type FindErrorFamily,
  type ViewPlacement,
  type ViewPositions,
} from './find-error'
export {
  buildSectionTask,
  buildSectionViews,
  distanceToAccepted,
  evaluateSection,
  generateSectionPart,
  givenRender,
  isolateView,
  optionRender,
  planeCandidates,
  sectionDrawing,
  sectionEvents,
  sectionViews,
  targetRender,
  CUTTING_PLANE_VIEW,
  OPPOSITE_VIEW,
  SECTION_LABEL,
  SECTION_PLACE_MIN_TOLERANCE_MM,
  SECTION_PLACE_STEP_MM,
  SECTION_PLACE_TOLERANCE_MM,
  type PlaneCandidate,
} from './section'
export { buildDimensionTask, drawingDimensionsOf, evaluateDimension, WALLS } from './dimension'
export * from './geometry2d'
export * from './adaptivity'
export { evaluate } from './evaluate'
