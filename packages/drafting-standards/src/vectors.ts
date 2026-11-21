/** Jednoduchý 3D vektor v souřadnicích enginu: X doprava, Y dozadu (do hloubky), Z nahoru, mm. */
export type Vec3 = readonly [number, number, number]

export const X_AXIS: Vec3 = [1, 0, 0]
export const Y_AXIS: Vec3 = [0, 1, 0]
export const Z_AXIS: Vec3 = [0, 0, 1]

export function neg(v: Vec3): Vec3 {
  return [-v[0], -v[1], -v[2]]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
