import { AXIS_INDEX, otherAxes, type Box, type PartSpec } from './spec'

export type ValidationIssue = { readonly featureId: string | null; readonly message: string }

const isPositiveInt = (n: number) => Number.isInteger(n) && n > 0

function boxIssues(box: Box, size: readonly number[], featureId: string, additive: boolean) {
  const issues: ValidationIssue[] = []
  for (let i = 0; i < 3; i++) {
    const lo = box.min[i]!
    const hi = box.max[i]!
    if (!Number.isInteger(lo) || !Number.isInteger(hi)) {
      issues.push({ featureId, message: 'rozměry kvádru musí být celá čísla' })
    }
    if (hi <= lo) issues.push({ featureId, message: 'kvádr musí mít kladné rozměry' })
    if (!additive && (hi <= 0 || lo >= size[i]!)) {
      issues.push({ featureId, message: 'odebíraný kvádr se nedotýká základu' })
    }
  }
  return issues
}

/** Kontrola, že popis součásti dává smysl (celá čísla, prvky uvnitř základu). Prázdné pole = v pořádku. */
export function validatePart(spec: PartSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const size = spec.base.size
  if (!size.every(isPositiveInt)) {
    issues.push({ featureId: null, message: 'rozměry základu musí být kladná celá čísla' })
  }
  const ids = new Set<string>()
  for (const f of spec.features) {
    if (ids.has(f.id)) issues.push({ featureId: f.id, message: 'duplicitní id prvku' })
    ids.add(f.id)
    switch (f.kind) {
      case 'hole': {
        if (!isPositiveInt(f.diameter)) {
          issues.push({ featureId: f.id, message: 'průměr díry musí být kladné celé číslo' })
        }
        const r = f.diameter / 2
        const [a, b] = otherAxes(f.axis)
        const ca = f.at[0]
        const cb = f.at[1]
        if (
          ca - r <= 0 ||
          ca + r >= size[AXIS_INDEX[a]] ||
          cb - r <= 0 ||
          cb + r >= size[AXIS_INDEX[b]]
        ) {
          issues.push({ featureId: f.id, message: 'díra musí ležet celá uvnitř stěny' })
        }
        if (f.depth !== undefined) {
          if (!isPositiveInt(f.depth) || f.depth >= size[AXIS_INDEX[f.axis]]) {
            issues.push({
              featureId: f.id,
              message: 'hloubka slepé díry musí být menší než tloušťka',
            })
          }
          if (!f.from) issues.push({ featureId: f.id, message: 'slepá díra potřebuje stranu from' })
        }
        break
      }
      case 'slot':
      case 'step':
      case 'cutout':
        issues.push(...boxIssues(f.box, size, f.id, false))
        break
      case 'rib':
        issues.push(...boxIssues(f.box, size, f.id, true))
        break
      case 'chamfer': {
        const [a, b] = otherAxes(f.along)
        if (
          !isPositiveInt(f.size) ||
          f.size >= size[AXIS_INDEX[a]] ||
          f.size >= size[AXIS_INDEX[b]]
        ) {
          issues.push({ featureId: f.id, message: 'zkosení musí být menší než stěny' })
        }
        break
      }
    }
  }
  return issues
}
