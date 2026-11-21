import type { ViewName } from '@vykresovna/drafting-standards'
import { cutPlaneOf, viewFromOf, type CutPlane } from '@vykresovna/engine/section'
import * as THREE from 'three'
import type { Bounds } from './coords'

type Axis = 'x' | 'y' | 'z'
type P3 = [number, number, number]

/** Rovina interaktivního řezu ve 3D (souřadnice enginu, mm). */
export type SectionPlaneState = {
  readonly axis: Axis
  readonly at: number
  /** Ze které strany se díváme (odebere se materiál na této straně). Bez zadání podle běžného pohledu. */
  readonly viewFrom?: 'min' | 'max'
}

const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }

/** Pohled, ze kterého se na řez díváme (podle osy a strany): určuje i směr šraf jako ve výkresu. */
export function sectionViewOf(state: SectionPlaneState): ViewName {
  const from = state.viewFrom ?? defaultViewFrom(state.axis)
  if (state.axis === 'x') return from === 'min' ? 'left' : 'right'
  if (state.axis === 'y') return from === 'min' ? 'front' : 'rear'
  return from === 'max' ? 'top' : 'bottom'
}

/** Výchozí strana pohledu: zepředu (y), zleva (x) a shora (z), jako u nárysu, bokorysu a půdorysu. */
export function defaultViewFrom(axis: Axis): 'min' | 'max' {
  const view: ViewName = axis === 'x' ? 'left' : axis === 'y' ? 'front' : 'top'
  return viewFromOf(view, { axis })
}

/** Rovina řezu ve smyslu enginu (která strana zůstane). */
export function cutPlaneOfState(state: SectionPlaneState): CutPlane {
  return cutPlaneOf({
    axis: state.axis,
    at: state.at,
    label: 'A',
    viewFrom: state.viewFrom ?? defaultViewFrom(state.axis),
  })
}

/** Matice ze souřadnic enginu do světa three.js (otočení Z nahoru → Y nahoru, střed tělesa v počátku). */
export function engineToWorld(bounds: Bounds): THREE.Matrix4 {
  const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
  const shift = new THREE.Matrix4().makeTranslation(
    -bounds.center[0],
    -bounds.center[1],
    -bounds.center[2],
  )
  return rot.multiply(shift)
}

/** Ořezávací rovina three.js ve světových souřadnicích: zachová materiál za rovinou řezu. */
export function worldClippingPlane(plane: CutPlane, bounds: Bounds): THREE.Plane {
  const sign = plane.keep === 'max' ? 1 : -1
  const n = new THREE.Vector3()
  n.setComponent(AXIS_INDEX[plane.axis], sign)
  // three.js zahodí body se zápornou vzdáleností: sign · (p_osa − at) ≥ 0 zůstává
  return new THREE.Plane(n, -sign * plane.at).applyMatrix4(engineToWorld(bounds))
}

/**
 * Ořízne úsečky (dvojice bodů po sobě) na zachovanou stranu roviny. Vrací nové body a pro každou
 * výslednou úsečku index původní úsečky.
 */
export function clipSegments(
  points: readonly P3[],
  plane: CutPlane,
): { points: P3[]; source: number[] } {
  const ai = AXIS_INDEX[plane.axis]
  const sign = plane.keep === 'max' ? 1 : -1
  const out: P3[] = []
  const source: number[] = []
  for (let s = 0; s + 1 < points.length; s += 2) {
    const a = points[s]!
    const b = points[s + 1]!
    const da = sign * (a[ai] - plane.at)
    const db = sign * (b[ai] - plane.at)
    if (da < 0 && db < 0) continue
    if (da >= 0 && db >= 0) {
      out.push(a, b)
    } else {
      const t = da / (da - db)
      const m: P3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
      out.push(da >= 0 ? a : m, da >= 0 ? m : b)
    }
    source.push(s / 2)
  }
  return { points: out, source }
}

/**
 * Poloha na ose řezu nejblíž paprsku (myš): parametr bodu na přímce `origin + t·osa`, která je
 * paprsku nejblíž. Paprsek i přímka v souřadnicích enginu. null = paprsek je s osou rovnoběžný.
 */
export function axisPositionUnderRay(
  axis: Axis,
  origin: P3,
  rayOrigin: P3,
  rayDir: P3,
): number | null {
  const ai = AXIS_INDEX[axis]
  const u: P3 = [0, 0, 0]
  u[ai] = 1
  const v = rayDir
  const w0: P3 = [origin[0] - rayOrigin[0], origin[1] - rayOrigin[1], origin[2] - rayOrigin[2]]
  const b = v[ai]
  const c = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
  const d = w0[ai]
  const e = v[0] * w0[0] + v[1] * w0[1] + v[2] * w0[2]
  const denom = c - b * b
  if (denom < 1e-6 * c) return null
  return origin[ai] + (b * e - c * d) / denom
}
