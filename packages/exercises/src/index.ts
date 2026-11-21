/**
 * Generátory úloh, distraktory a hodnocení s kódy chyb. Bez UI, bez DOM.
 *
 * - `generatePart(seed, obtížnost)`: náhodná čitelná součást (generator.ts),
 * - `generateTask(wasm, typ, seed, obtížnost)`: úloha s distraktory ověřenými otiskem výkresu (tasks.ts),
 * - `evaluate(úloha, odpověď)`: výsledek s kódy chyb (evaluate.ts),
 * - `applyDrawingMutation(výkres, mutace)`: chybný výkres pro distraktor (drawing-mutations.ts).
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
  type DrawingMutationCandidate,
} from './drawing-mutations'
export { generateTask, buildOptionDrawing, assignViewCards, SLOTS_AROUND_FRONT } from './tasks'
export { evaluate } from './evaluate'
