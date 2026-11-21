/** Deterministický generátor náhodných čísel (mulberry32). Stejný seed = stejná posloupnost. */
export function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    /** Celé číslo v uzavřeném intervalu [min, max]. */
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    /** Náhodný jev s pravděpodobností p. */
    chance: (p: number) => next() < p,
    /** Výběr podle vah (dvojice [hodnota, váha]). */
    weighted: <T>(items: readonly (readonly [T, number])[]): T => {
      const total = items.reduce((s, [, w]) => s + w, 0)
      let r = next() * total
      for (const [item, w] of items) {
        r -= w
        if (r < 0) return item
      }
      return items[items.length - 1]![0]
    },
    shuffle: <T>(items: readonly T[]): T[] => {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j]!, out[i]!]
      }
      return out
    },
  }
}
export type Rng = ReturnType<typeof createRng>

/** Odvození samostatného seedu z více čísel (aby se proudy pro součást a úlohu nepletly). */
export function deriveSeed(...parts: readonly number[]): number {
  let h = 0x811c9dc5
  for (const p of parts) {
    h = Math.imul(h ^ (p >>> 0), 0x01000193)
    h ^= h >>> 15
    h = Math.imul(h, 0x2c1b3c6d)
    h ^= h >>> 12
  }
  return h >>> 0
}
