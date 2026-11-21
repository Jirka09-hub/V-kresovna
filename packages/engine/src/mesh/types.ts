import type { Axis } from '../part/spec'
import type { Vec3 } from '@vykresovna/drafting-standards'

/** Válcová plocha díry (víme ji přesně z parametrů prvku, ne jen z teselace). */
export type CylinderInfo = {
  readonly axis: Axis
  /** Bod na ose (v ostatních souřadnicích odpovídá středu díry). */
  readonly center: Vec3
  readonly radius: number
}

export type SurfaceInfo = {
  /** Stabilní klíč plochy (rovinná plocha `p:<originalID>:<faceID>`, válec `cyl:<featureId>`). */
  readonly key: string
  /** Prvek, ze kterého plocha vznikla; null = základní kvádr. */
  readonly featureId: string | null
  readonly cylinder?: CylinderInfo
}

/** Výsledné těleso jako síť trojúhelníků v souřadnicích enginu (mm, float64). */
export type SolidMesh = {
  readonly positions: Float64Array
  readonly triangles: Uint32Array
  /** Index do `surfaces` pro každý trojúhelník. */
  readonly triSurface: Int32Array
  /** Jednotková normála každého trojúhelníku (3 čísla na trojúhelník). */
  readonly triNormals: Float64Array
  readonly surfaces: readonly SurfaceInfo[]
  readonly bbox: { readonly min: Vec3; readonly max: Vec3 }
  readonly volume: number
}
