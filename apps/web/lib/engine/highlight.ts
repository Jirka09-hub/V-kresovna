/**
 * Propojení zvýraznění mezi 3D a 2D. Id ve výkresu:
 * - logická hrana `p:…|cyl:d1#0` (hrana mezi dvěma plochami),
 * - obrys válce `sil:cyl:d1` (jen ve 2D, ve 3D mu odpovídají hrany díry),
 * - osa `feature:d1`.
 */
export function highlightKey(hoverId: string): string | null {
  if (hoverId.startsWith('feature:')) return `cyl:${hoverId.slice('feature:'.length)}`
  if (hoverId.startsWith('sil:')) return hoverId.slice('sil:'.length)
  const cyl = /cyl:[^|#]+/.exec(hoverId)
  return cyl ? cyl[0] : null
}

/** Patří id (hrany ve 3D nebo prvku ve 2D) ke zvýrazněnému objektu? */
export function isRelated(id: string, hoverId: string | null): boolean {
  if (!hoverId) return false
  if (id === hoverId) return true
  const key = highlightKey(hoverId)
  if (!key) return false
  return id === `sil:${key}` || id.split('|').some((part) => part.replace(/#\d+$/, '') === key)
}

type EdgeLike = { readonly id: string; readonly featureIds: readonly string[] }

/** Hrany 3D modelu, které patří k prvku (díra, drážka…), podle původu ploch. */
export function featureEdgeIds(edges: readonly EdgeLike[], featureId: string): string[] {
  return edges.filter((e) => e.featureIds.includes(featureId)).map((e) => e.id)
}

/**
 * Id čar ve výkresu, které patří k prvku: jeho logické hrany, obrysy válce a kuželového dna
 * (`sil:cyl:<id>`, `sil:cone:<id>`) a osa (`feature:<id>`).
 */
export function featureDrawingIds(edges: readonly EdgeLike[], featureId: string): Set<string> {
  return new Set([
    ...featureEdgeIds(edges, featureId),
    `feature:${featureId}`,
    `sil:cyl:${featureId}`,
    `sil:cone:${featureId}`,
  ])
}
