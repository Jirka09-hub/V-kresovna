/**
 * Triangulace rovinných mnohoúhelníků s dírami (plocha řezu) metodou ořezávání uší.
 *
 * Výsledné trojúhelníky používají jen vrcholy obrysů (žádné nové body), takže na ně přesně navazuje
 * oříznutá síť součásti a výsledné těleso zůstane uzavřené. Body ležící na přímce (vznikají, když rovina
 * protne více trojúhelníků jedné stěny) se zachovají: ucho, na jehož hraně leží jiný bod, se nebere.
 */

/** Bod obrysu: souřadnice v rovině a index vrcholu sítě. */
export type RingPoint = { readonly x: number; readonly y: number; readonly id: number }

const AREA_EPS = 1e-12

const cross = (o: RingPoint, a: RingPoint, b: RingPoint) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

const samePos = (a: RingPoint, b: RingPoint) => a.x === b.x && a.y === b.y

/** Dvojnásobek orientované plochy (kladná = proti směru hodinových ručiček). */
export function signedArea2(ring: readonly { x: number; y: number }[]): number {
  let s = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j]!.x - ring[i]!.x) * (ring[j]!.y + ring[i]!.y)
  }
  return s
}

/** Leží bod uvnitř mnohoúhelníku (pravidlo sudý–lichý)? */
export function pointInRing(x: number, y: number, ring: readonly { x: number; y: number }[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!
    const b = ring[j]!
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Leží směr q − p uvnitř úhlu u vrcholu p (vnitřek je vlevo od obrysu prev → p → next)? */
function inWedge(prev: RingPoint, p: RingPoint, next: RingPoint, q: RingPoint): boolean {
  const convex = cross(prev, p, next) >= 0
  const leftOfIn = cross(prev, p, q) > AREA_EPS
  const leftOfOut = cross(p, next, q) > AREA_EPS
  return convex ? leftOfIn && leftOfOut : leftOfIn || leftOfOut
}

/** Protínají se úsečky ab a cd (včetně dotyku)? */
function segmentsTouch(a: RingPoint, b: RingPoint, c: RingPoint, d: RingPoint): boolean {
  const d1 = cross(a, b, c)
  const d2 = cross(a, b, d)
  const d3 = cross(c, d, a)
  const d4 = cross(c, d, b)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }
  const onSeg = (p: RingPoint, q: RingPoint, r: RingPoint) =>
    Math.min(p.x, q.x) <= r.x &&
    r.x <= Math.max(p.x, q.x) &&
    Math.min(p.y, q.y) <= r.y &&
    r.y <= Math.max(p.y, q.y)
  if (Math.abs(d1) <= AREA_EPS && onSeg(a, b, c)) return true
  if (Math.abs(d2) <= AREA_EPS && onSeg(a, b, d)) return true
  if (Math.abs(d3) <= AREA_EPS && onSeg(c, d, a)) return true
  if (Math.abs(d4) <= AREA_EPS && onSeg(c, d, b)) return true
  return false
}

/**
 * Připojí díru k vnějšímu obrysu „mostem“ (dvojitou hranou) mezi vrcholem díry a viditelným vrcholem
 * obrysu. Most nesmí křížit žádnou hranu obrysu ani děr.
 */
function bridgeHole(
  ring: RingPoint[],
  hole: readonly RingPoint[],
  others: readonly (readonly RingPoint[])[],
): RingPoint[] {
  // vrchol díry s největším x (při shodě nejmenší y)
  let m = 0
  for (let i = 1; i < hole.length; i++) {
    const p = hole[i]!
    const q = hole[m]!
    if (p.x > q.x || (p.x === q.x && p.y < q.y)) m = i
  }
  const hm = hole[m]!
  const holePrev = hole[(m - 1 + hole.length) % hole.length]!
  const holeNext = hole[(m + 1) % hole.length]!

  const order = ring
    .map((p, i) => ({ i, d: (p.x - hm.x) ** 2 + (p.y - hm.y) ** 2 }))
    .sort((a, b) => a.d - b.d || a.i - b.i)

  const blocked = (p: RingPoint): boolean => {
    const check = (loop: readonly RingPoint[]) => {
      for (let k = 0; k < loop.length; k++) {
        const c = loop[k]!
        const d = loop[(k + 1) % loop.length]!
        // hrany, které začínají nebo končí v koncových bodech mostu, most jen „dotýkají“
        if (samePos(c, p) || samePos(d, p) || samePos(c, hm) || samePos(d, hm)) continue
        if (segmentsTouch(hm, p, c, d)) return true
      }
      return false
    }
    return check(ring) || check(hole) || others.some(check)
  }

  for (const { i } of order) {
    const p = ring[i]!
    if (samePos(p, hm)) continue
    const prev = ring[(i - 1 + ring.length) % ring.length]!
    const next = ring[(i + 1) % ring.length]!
    if (!inWedge(prev, p, next, hm)) continue
    if (!inWedge(holePrev, hm, holeNext, p)) continue
    if (blocked(p)) continue
    const rotated = [...hole.slice(m), ...hole.slice(0, m)]
    return [...ring.slice(0, i + 1), ...rotated, hm, p, ...ring.slice(i + 1)]
  }
  // nenalezeno (degenerovaný případ): díru vynecháme, plocha řezu ji pak překryje
  return ring
}

/** Ořezávání uší na jednom obrysu (proti směru hodinových ručiček). */
function earClip(ring: readonly RingPoint[]): [number, number, number][] {
  const n = ring.length
  const out: [number, number, number][] = []
  if (n < 3) return out
  const prev = Array.from({ length: n }, (_, i) => (i - 1 + n) % n)
  const next = Array.from({ length: n }, (_, i) => (i + 1) % n)
  const alive = new Uint8Array(n).fill(1)
  let remaining = n

  const isEar = (i: number, strict: boolean): boolean => {
    const a = ring[prev[i]!]!
    const b = ring[i]!
    const c = ring[next[i]!]!
    if (cross(a, b, c) <= AREA_EPS) return false
    for (let j = next[next[i]!]!; j !== prev[i]!; j = next[j]!) {
      const p = ring[j]!
      if (samePos(p, a) || samePos(p, b) || samePos(p, c)) continue
      const c1 = cross(a, b, p)
      const c2 = cross(b, c, p)
      const c3 = cross(c, a, p)
      if (strict) {
        // i bod na hraně ucha by vytvořil T-spoj
        if (c1 >= -AREA_EPS && c2 >= -AREA_EPS && c3 >= -AREA_EPS) return false
      } else if (c1 > AREA_EPS && c2 > AREA_EPS && c3 > AREA_EPS) {
        return false
      }
    }
    return true
  }

  const clip = (i: number, emit: boolean) => {
    if (emit) out.push([ring[prev[i]!]!.id, ring[i]!.id, ring[next[i]!]!.id])
    next[prev[i]!] = next[i]!
    prev[next[i]!] = prev[i]!
    alive[i] = 0
    remaining--
  }

  let start = 0
  while (remaining > 3) {
    let found = -1
    for (const strict of [true, false]) {
      let i = start
      for (let k = 0; k < remaining; k++, i = next[i]!) {
        if (isEar(i, strict)) {
          found = i
          break
        }
      }
      if (found >= 0) break
    }
    if (found < 0) {
      // nouzově: vyhodit degenerovaný (plochý) vrchol, jinak vrchol s největší plochou
      let best = -1
      let bestArea = -Infinity
      let i = start
      for (let k = 0; k < remaining; k++, i = next[i]!) {
        const area = cross(ring[prev[i]!]!, ring[i]!, ring[next[i]!]!)
        if (Math.abs(area) <= AREA_EPS) {
          best = i
          bestArea = 0
          break
        }
        if (area > bestArea) {
          bestArea = area
          best = i
        }
      }
      clip(best, bestArea > AREA_EPS)
      start = next[best]!
      continue
    }
    start = next[found]!
    clip(found, true)
  }
  if (remaining === 3) {
    const i = start
    if (cross(ring[prev[i]!]!, ring[i]!, ring[next[i]!]!) > AREA_EPS) {
      out.push([ring[prev[i]!]!.id, ring[i]!.id, ring[next[i]!]!.id])
    }
  }
  return out
}

/**
 * Rozdělí obrysy na vnější (kladná plocha) a díry (záporná plocha) a každou díru přiřadí nejmenšímu
 * vnějšímu obrysu, ve kterém leží.
 */
export function groupRings<T extends { x: number; y: number }>(
  rings: readonly (readonly T[])[],
): { outer: readonly T[]; holes: (readonly T[])[] }[] {
  const outers: { outer: readonly T[]; holes: (readonly T[])[]; area: number }[] = []
  const holes: (readonly T[])[] = []
  for (const r of rings) {
    if (r.length < 3) continue
    const a = signedArea2(r)
    if (a > AREA_EPS) outers.push({ outer: r, holes: [], area: a })
    else if (a < -AREA_EPS) holes.push(r)
  }
  outers.sort((p, q) => p.area - q.area)
  for (const h of holes) {
    // bod uvnitř díry poblíž jejího vrcholu, aby test nezávisel na bodech na hranici
    const p = h[0]!
    const owner = outers.find((o) => pointInRing(p.x, p.y, o.outer) || touchesRing(p, o.outer))
    owner?.holes.push(h)
  }
  return outers.map(({ outer, holes: hs }) => ({ outer, holes: hs }))
}

function touchesRing(p: { x: number; y: number }, ring: readonly { x: number; y: number }[]) {
  return ring.some((q) => q.x === p.x && q.y === p.y)
}

/** Triangulace jedné plochy (vnější obrys proti směru hodinových ručiček, díry po směru). */
export function triangulateFace(
  outer: readonly RingPoint[],
  holes: readonly (readonly RingPoint[])[],
): [number, number, number][] {
  let ring = [...outer]
  const pending = [...holes].sort(
    (a, b) => Math.max(...b.map((p) => p.x)) - Math.max(...a.map((p) => p.x)),
  )
  while (pending.length > 0) {
    const hole = pending.shift()!
    ring = bridgeHole(ring, hole, pending)
  }
  return earClip(ring)
}
