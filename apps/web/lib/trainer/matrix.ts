/**
 * Matice postupu skupiny (účastníci × lekce), čistá funkce nad řádky z databáze (D-028).
 */

export type CellStatus = 'none' | 'started' | 'done'

export type MatrixCell = {
  readonly status: CellStatus
  /** nejlepší výsledek dokončeného průchodu 0–1 (jen u `done`) */
  readonly bestScore: number | null
}

export type MatrixParticipant = {
  readonly userId: string
  readonly displayName: string
  readonly username: string | null
}

export type MatrixRow = MatrixParticipant & {
  readonly cells: Readonly<Record<string, MatrixCell>>
  /** výsledek závěrečného testu (null = test nedokončil) a jestli splnil hranici */
  readonly finalScore: number | null
  readonly finalPassed: boolean | null
  readonly certificateCode: string | null
}

export type ProgressRow = {
  readonly user_id: string
  readonly lesson_slug: string
  readonly finished_runs: number | null
  readonly best_score: number | null
  readonly last_started_at: string | null
}

export type CertificateRow = { readonly user_id: string; readonly verification_code: string }

const NONE: MatrixCell = { status: 'none', bestScore: null }

export function buildMatrix(input: {
  readonly participants: readonly MatrixParticipant[]
  readonly progress: readonly ProgressRow[]
  readonly certificates: readonly CertificateRow[]
  readonly lessonSlugs: readonly string[]
  readonly finalLessonSlug: string
  readonly passThreshold: number
}): MatrixRow[] {
  const byUser = new Map<string, Map<string, ProgressRow>>()
  for (const p of input.progress) {
    let m = byUser.get(p.user_id)
    if (!m) byUser.set(p.user_id, (m = new Map()))
    m.set(p.lesson_slug, p)
  }
  const certs = new Map(input.certificates.map((c) => [c.user_id, c.verification_code]))

  return [...input.participants]
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'cs'))
    .map((participant) => {
      const progress = byUser.get(participant.userId)
      const cells: Record<string, MatrixCell> = {}
      for (const slug of input.lessonSlugs) {
        const p = progress?.get(slug)
        if (p && (p.finished_runs ?? 0) > 0) {
          cells[slug] = { status: 'done', bestScore: p.best_score ?? 0 }
        } else if (p && p.last_started_at) {
          cells[slug] = { status: 'started', bestScore: null }
        } else {
          cells[slug] = NONE
        }
      }
      const final = cells[input.finalLessonSlug] ?? NONE
      const finalScore = final.status === 'done' ? final.bestScore : null
      return {
        ...participant,
        cells,
        finalScore,
        finalPassed: finalScore === null ? null : finalScore >= input.passThreshold - 1e-6,
        certificateCode: certs.get(participant.userId) ?? null,
      }
    })
}

/** Procenta pro zobrazení (zaokrouhlená na celé). */
export const percent = (score: number) => Math.round(score * 100)

/** Nejčastější kódy chyb z pokusů (sestupně podle počtu, při shodě abecedně). */
export function topErrorCodes(
  attempts: readonly { readonly error_codes: readonly string[] | null }[],
  limit = 8,
): { code: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const a of attempts) {
    // jeden pokus počítá každý kód jen jednou
    for (const code of new Set(a.error_codes ?? [])) counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  return [...counts]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, limit)
}
