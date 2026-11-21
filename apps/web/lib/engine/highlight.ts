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
