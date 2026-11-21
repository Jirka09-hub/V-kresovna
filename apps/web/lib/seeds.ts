/** Nový náhodný seed úlohy (kladné 31bitové celé číslo). Úlohy jsou ze seedu deterministické. */
export function randomSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]! & 0x7fffffff || 1
}
