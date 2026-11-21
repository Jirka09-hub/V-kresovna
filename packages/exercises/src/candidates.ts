/**
 * Výběr distraktorů z proudů kandidátů (společné pro cvičení 2, 3 a 5). Kandidát se vyhodnocuje
 * (staví a kreslí) až ve chvíli, kdy je potřeba.
 */

/**
 * Proudy kandidátů po kategoriích. Kandidát se vyhodnocuje (staví) až ve chvíli, kdy je potřeba;
 * kandidát jiné kategorie se odloží do zásobníku své kategorie.
 */
export class CandidateStreams<C extends string, T> {
  private readonly buffers = new Map<C, T[]>()
  constructor(
    private readonly producers: readonly {
      readonly cats: readonly C[]
      /** null = vyčerpáno, undefined = kandidát zamítnut, jinak kandidát a jeho kategorie */
      readonly next: () => { cat: C; item: T } | null | undefined
      /** Levný producent (bez stavění tělesa) smí vyrábět i při výběru „pestrých“ kandidátů. */
      readonly cheap?: boolean
    }[],
  ) {}

  /** Vezme první vyhovující kandidát kategorie; nevyhovující zůstávají v zásobníku pro další výběr. */
  take(cat: C, accept: (item: T) => boolean, onlyCheap = false): T | null {
    const buf = this.buffer(cat)
    const idx = buf.findIndex(accept)
    if (idx >= 0) return buf.splice(idx, 1)[0]!
    for (const p of this.producers) {
      if (!p.cats.includes(cat) || (onlyCheap && !p.cheap)) continue
      for (;;) {
        const r = p.next()
        if (r === null) break
        if (r === undefined) continue
        if (r.cat === cat && accept(r.item)) return r.item
        this.buffer(r.cat).push(r.item)
      }
    }
    return null
  }

  private buffer(cat: C): T[] {
    let buf = this.buffers.get(cat)
    if (!buf) {
      buf = []
      this.buffers.set(cat, buf)
    }
    return buf
  }
}

/**
 * Vybere distraktory pro sloty (každý slot = pořadí preferovaných kategorií). Otisk musí být jiný než
 * u správné odpovědi i u ostatních distraktorů. Přednost má už vyhodnocený (nebo levný) kandidát
 * s dosud nepoužitým kódem chyby (pestřejší možnosti); když žádný není, stačí odlišný otisk.
 */
export function selectDistinct<
  C extends string,
  T extends { fp: string; option: { errorCode: unknown } },
>(
  streams: CandidateStreams<C, T>,
  slots: readonly (readonly C[])[],
  correctFp: string,
  /**
   * true = nejdřív zkusit všechny kategorie slotu s nepoužitým kódem chyby, teprve pak připustit
   * opakovaný kód (pestřejší možnosti). Výchozí false zachovává výběr cvičení 2 a 3 (stabilní seedy).
   */
  codesFirst = false,
): T[] | null {
  const used = new Set<string>([correctFp])
  const usedCodes = new Set<unknown>()
  const picked: T[] = []
  const accept = (strict: boolean) => (item: T) =>
    !used.has(item.fp) && (!strict || !usedCodes.has(item.option.errorCode))
  for (const prefs of slots) {
    let found: T | null = null
    if (codesFirst) {
      for (const strict of [true, false]) {
        for (const cat of prefs) {
          found = streams.take(cat, accept(strict), false)
          if (found) break
        }
        if (found) break
      }
    } else {
      for (const cat of prefs) {
        for (const strict of [true, false]) {
          found = streams.take(cat, accept(strict), strict)
          if (found) break
        }
        if (found) break
      }
    }
    if (!found) return null
    used.add(found.fp)
    usedCodes.add(found.option.errorCode)
    picked.push(found)
  }
  return picked
}
