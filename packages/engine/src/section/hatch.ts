import type { Vec2 } from '../projection/hlr'
import type { Segment2 } from './types'

const ROUND = 1e4
const round = (x: number) => Math.round(x * ROUND) / ROUND + 0

/**
 * Šrafy plochy řezu jako přesné úsečky: rovnoběžné přímky pod úhlem `angleDeg` (od osy u, proti směru
 * hodinových ručiček) ve vzdálenosti `spacing`, oříznuté na obrysy pravidlem sudý–lichý. Díry
 * (vnitřní obrysy) tak zůstanou bez šraf. Přímky jsou ukotvené k počátku souřadnic pohledu, takže
 * všechny plochy jedné součásti mají šrafy na stejných přímkách.
 */
export function hatchLines(
  loops: readonly (readonly Vec2[])[],
  angleDeg: number,
  spacing: number,
  phase = 0.5,
): Segment2[] {
  const rad = (angleDeg * Math.PI) / 180
  const dir: Vec2 = [Math.cos(rad), Math.sin(rad)]
  const normal: Vec2 = [-dir[1], dir[0]]
  // s = vzdálenost od přímky přes počátek (kolmo), t = poloha na přímce
  const sOf = (p: Vec2) => p[0] * normal[0] + p[1] * normal[1]
  const tOf = (p: Vec2) => p[0] * dir[0] + p[1] * dir[1]

  let minS = Infinity
  let maxS = -Infinity
  for (const loop of loops) {
    for (const p of loop) {
      const s = sOf(p)
      minS = Math.min(minS, s)
      maxS = Math.max(maxS, s)
    }
  }
  if (!Number.isFinite(minS)) return []

  const out: Segment2[] = []
  const k0 = Math.ceil(minS / spacing - phase)
  const k1 = Math.floor(maxS / spacing - phase)
  for (let k = k0; k <= k1; k++) {
    const s = (k + phase) * spacing
    const ts: number[] = []
    for (const loop of loops) {
      for (let i = 0; i < loop.length; i++) {
        const p = loop[i]!
        const q = loop[(i + 1) % loop.length]!
        const sp = sOf(p)
        const sq = sOf(q)
        // polootevřený interval: vrchol přesně na přímce se započítá jen jednou
        if ((sp <= s && s < sq) || (sq <= s && s < sp)) {
          const u = (s - sp) / (sq - sp)
          ts.push(tOf(p) + (tOf(q) - tOf(p)) * u)
        }
      }
    }
    ts.sort((a, b) => a - b)
    for (let i = 0; i + 1 < ts.length; i += 2) {
      const t0 = ts[i]!
      const t1 = ts[i + 1]!
      if (t1 - t0 < 1e-6) continue
      const at = (t: number): Vec2 => [
        round(normal[0] * s + dir[0] * t),
        round(normal[1] * s + dir[1] * t),
      ]
      out.push({ a: at(t0), b: at(t1) })
    }
  }
  return out
}
