import type { ViewName } from '@vykresovna/drafting-standards'
import type { Vec2 } from '../projection/hlr'
import type { Drawing, DrawingView } from './drawing'

/**
 * Kanonický otisk (hash) pohledu výkresu. Dva pohledy, které vypadají stejně, mají stejný otisk;
 * pohledy, které se viditelně liší, mají různý otisk. Slouží ke kontrole, že se distraktor
 * opravdu liší od správné odpovědi (docs/plan.md, kapitola 5.3).
 *
 * - Souřadnice se berou relativně k levému dolnímu rohu průmětu tělesa (otisk nezávisí na tom,
 *   kde pohled na výkrese leží) a zaokrouhlí se na FINGERPRINT_PRECISION_MM.
 * - Úseky na stejné přímce se stejnou viditelností se sloučí; skrytý úsek pod viditelným se
 *   nepočítá (ve výkresu ho viditelná čára zakryje). Nezáleží tedy na tom, jak jsou čáry rozdělené.
 * - Počítají se i kružnice a osy (bez id prvků, jen jak vypadají).
 */

/** Přesnost porovnání souřadnic (mm). Rozdíl menší než tisícina milimetru na výkrese nejde vidět. */
export const FINGERPRINT_PRECISION_MM = 1e-3

type Interval = { s0: number; s1: number }
type Line = { dir: Vec2; offset: number; visible: Interval[]; hidden: Interval[] }

const q = (x: number) => Math.round(x / FINGERPRINT_PRECISION_MM) + 0

/** Sjednocení intervalů (navazující a překrývající se spojí). */
function union(intervals: readonly Interval[]): Interval[] {
  const tol = FINGERPRINT_PRECISION_MM / 2
  const sorted = [...intervals].sort((a, b) => a.s0 - b.s0 || a.s1 - b.s1)
  const out: Interval[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv.s0 <= last.s1 + tol) last.s1 = Math.max(last.s1, iv.s1)
    else out.push({ ...iv })
  }
  return out
}

/** Rozdíl množin intervalů a − b (oba sjednocené a seřazené). */
function subtract(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const tol = FINGERPRINT_PRECISION_MM / 2
  const out: Interval[] = []
  for (const iv of a) {
    let pieces: Interval[] = [{ ...iv }]
    for (const cut of b) {
      const next: Interval[] = []
      for (const p of pieces) {
        if (cut.s1 <= p.s0 + tol || cut.s0 >= p.s1 - tol) {
          next.push(p)
          continue
        }
        if (cut.s0 > p.s0 + tol) next.push({ s0: p.s0, s1: cut.s0 })
        if (cut.s1 < p.s1 - tol) next.push({ s0: cut.s1, s1: p.s1 })
      }
      pieces = next
    }
    out.push(...pieces)
  }
  return out
}

/** Kanonický textový popis pohledu (seřazený, zaokrouhlený). Otisk je jeho hash. */
export function canonicalView(view: DrawingView): string {
  const origin = view.projection.bounds.min
  const rel = (p: Vec2): Vec2 => [p[0] - origin[0], p[1] - origin[1]]

  const lines = new Map<string, Line>()
  for (const seg of view.projection.segments) {
    const a = rel(seg.a)
    const b = rel(seg.b)
    let dx = b[0] - a[0]
    let dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len < FINGERPRINT_PRECISION_MM) continue
    dx /= len
    dy /= len
    // kanonický směr (úhel v [0, π))
    if (dy < -1e-12 || (Math.abs(dy) <= 1e-12 && dx < 0)) {
      dx = -dx
      dy = -dy
    }
    const offset = a[0] * dy - a[1] * dx
    const key = `${Math.round(dx * 1e6)},${Math.round(dy * 1e6)},${q(offset)}`
    let line = lines.get(key)
    if (!line) {
      line = { dir: [dx, dy], offset, visible: [], hidden: [] }
      lines.set(key, line)
    }
    const sa = a[0] * line.dir[0] + a[1] * line.dir[1]
    const sb = b[0] * line.dir[0] + b[1] * line.dir[1]
    line[seg.visibility].push({ s0: Math.min(sa, sb), s1: Math.max(sa, sb) })
  }

  const items: string[] = []
  for (const line of lines.values()) {
    const visible = union(line.visible)
    const hidden = subtract(union(line.hidden), visible)
    const point = (s: number) => {
      // bod přímky: patní bod (offset·n) + s·dir, kde n = (dy, −dx)
      const x = line.offset * line.dir[1] + s * line.dir[0]
      const y = -line.offset * line.dir[0] + s * line.dir[1]
      return `${q(x)},${q(y)}`
    }
    for (const [tag, list] of [
      ['V', visible],
      ['H', hidden],
    ] as const) {
      for (const iv of list) {
        if (iv.s1 - iv.s0 < FINGERPRINT_PRECISION_MM) continue
        items.push(`${tag} ${point(iv.s0)} ${point(iv.s1)}`)
      }
    }
  }

  for (const c of view.circles) {
    const p = rel(c.center)
    items.push(`C ${q(p[0])},${q(p[1])} ${q(c.radius)}`)
  }
  for (const cl of view.centerLines) {
    const a = rel(cl.a)
    const b = rel(cl.b)
    const pa = `${q(a[0])},${q(a[1])}`
    const pb = `${q(b[0])},${q(b[1])}`
    items.push(`A ${pa < pb ? `${pa} ${pb}` : `${pb} ${pa}`}`)
  }
  // řez: plochy řezu, šrafy, nešrafované části a stopy roviny řezu (u pohledů bez řezu se nic
  // nepřidá, takže jejich otisk zůstává stejný jako dřív)
  const pt = (p: Vec2) => {
    const r = rel(p)
    return `${q(r[0])},${q(r[1])}`
  }
  const seg = (tag: string, a: Vec2, b: Vec2) => {
    const pa = pt(a)
    const pb = pt(b)
    return `${tag} ${pa < pb ? `${pa} ${pb}` : `${pb} ${pa}`}`
  }
  const ring = (loop: readonly Vec2[]) => {
    const pts = simplifyRing(loop.map((p) => rel(p).map(q) as unknown as Vec2)).map(
      (p) => `${p[0]},${p[1]}`,
    )
    const variants: string[] = []
    for (const seq of [pts, [...pts].reverse()]) {
      for (let i = 0; i < seq.length; i++) {
        variants.push([...seq.slice(i), ...seq.slice(0, i)].join(' '))
      }
    }
    return variants.sort()[0] ?? ''
  }
  if (view.section) {
    for (const f of view.section.faces) {
      items.push(`F ${ring(f.outer)}${f.holes.map((h) => ` / ${ring(h)}`).join('')}`)
    }
    for (const f of view.section.unhatched ?? []) items.push(`U ${ring(f.outer)}`)
    for (const h of view.section.hatching) items.push(seg('X', h.a, h.b))
  }
  for (const m of view.cuttingPlanes ?? []) items.push(seg(`P${m.label}`, m.line.a, m.line.b))
  items.push(`S ${q(view.size[0])},${q(view.size[1])}`)
  return [...new Set(items)].sort().join(';')
}

/**
 * Obrys plochy bez nadbytečných vrcholů (opakované body a body ležící na přímce mezi sousedy, např.
 * z dělení kružnice díry na straně, kterou rovina řezu díru jen míjí): stejně nakreslené plochy
 * pak mají stejný otisk. Souřadnice jsou už zaokrouhlené (celé násobky přesnosti otisku).
 */
function simplifyRing(points: readonly Vec2[]): Vec2[] {
  let pts = points.filter((p, i) => {
    const prev = points[(i + points.length - 1) % points.length]!
    return points.length < 2 || p[0] !== prev[0] || p[1] !== prev[1]
  })
  let changed = true
  while (changed && pts.length > 3) {
    changed = false
    for (let i = 0; i < pts.length && pts.length > 3; i++) {
      const a = pts[(i + pts.length - 1) % pts.length]!
      const b = pts[i]!
      const c = pts[(i + 1) % pts.length]!
      const len = Math.hypot(c[0] - a[0], c[1] - a[1])
      // vzdálenost b od přímky a–c nejvýš jedna jednotka zaokrouhlení
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
      const between =
        (b[0] - a[0]) * (c[0] - a[0]) + (b[1] - a[1]) * (c[1] - a[1]) >= 0 &&
        (b[0] - c[0]) * (a[0] - c[0]) + (b[1] - c[1]) * (a[1] - c[1]) >= 0
      if (len > 0 && between && Math.abs(cross) / len <= 1) {
        pts = [...pts.slice(0, i), ...pts.slice(i + 1)]
        changed = true
        i--
      }
    }
  }
  return pts
}

/** 53bitový hash řetězce (cyrb53), deterministický v prohlížeči i v Node. */
function hash53(s: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

/** Otisk jednoho pohledu (nezávisí na názvu pohledu ani na jeho poloze na výkrese). */
export function viewFingerprint(view: DrawingView): string {
  const text = canonicalView(view)
  return hash53(text, 1) + hash53(text, 2)
}

/**
 * Otisk výkresu: otisky vybraných pohledů (výchozí všechny) v daném pořadí.
 * Chybějící pohled se zapíše jako „-“, aby se výkresy s různou sadou pohledů nikdy neshodovaly.
 */
export function drawingFingerprint(drawing: Drawing, views?: readonly ViewName[]): string {
  const names = views ?? drawing.views.map((v) => v.view)
  return names
    .map((name) => {
      const v = drawing.views.find((x) => x.view === name)
      return `${name}:${v ? viewFingerprint(v) : '-'}`
    })
    .join('|')
}
