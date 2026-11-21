/**
 * Časová osa animace rozložení průměten (0 až 1). Čistá funkce, aby šla testovat bez WebGL.
 *
 * 1. průmětny se objeví (nárysna za tělesem, půdorysna pod ním, bokorysna vpravo: evropské promítání),
 * 2. promítací paprsky přenesou hrany na průmětny a nakreslí se pohledy,
 * 3. půdorysna se sklopí dolů a bokorysna vytočí doprava do roviny nárysny, těleso zmizí,
 * 4. kamera se postaví před výkres.
 */
export type UnfoldPhase = {
  /** Viditelnost průměten 0–1. */
  planes: number
  /** Kreslení pohledů a paprsků 0–1. */
  drawing: number
  /** Paprsky (nejvíc vidět během kreslení, pak zmizí). */
  rays: number
  /** Úhel sklopení průměten 0 až π/2. */
  fold: number
  /** Průhlednost tělesa 1 → 0. */
  body: number
  /** Kamera má stát před výkresem. */
  cameraFront: boolean
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
/** Plynulý náběh a doběh pohybu. */
export const ease = (x: number) => x * x * (3 - 2 * x)

export const UNFOLD_STEPS = [0, 0.2, 0.5, 0.85, 1] as const

export function unfoldPhase(progress: number): UnfoldPhase {
  const p = clamp01(progress)
  const planes = ease(clamp01(p / 0.2))
  const drawing = ease(clamp01((p - 0.2) / 0.3))
  const fold = ease(clamp01((p - 0.5) / 0.35))
  const rays = drawing * (1 - clamp01((p - 0.5) / 0.1))
  return {
    planes,
    drawing,
    rays,
    fold: (fold * Math.PI) / 2,
    body: 1 - fold,
    cameraFront: p >= 0.85,
  }
}
