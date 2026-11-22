import { FINAL_TEST_PASS_THRESHOLD, PILOT_MODULE } from '@vykresovna/content'
import type { OrgRole } from '@/lib/auth/viewer'
import type { ManagedGroup } from '@/lib/manage/server'
import type { createClient } from '@/lib/supabase/server'
import { buildMatrix, topErrorCodes, type MatrixRow } from './matrix'

type ServerClient = Awaited<ReturnType<typeof createClient>>

/** Kolik dní zpět se počítají nejčastější chyby skupiny. */
export const MISTAKES_DAYS = 90
/** Strop načtených pokusů pro statistiku chyb (pilot: desítky lidí, stovky pokusů). */
const MISTAKES_ATTEMPT_LIMIT = 10_000

/** Závěrečný test modulu (lekce s `test`), stejně jako v `app.certificate_rules`. */
export const FINAL_LESSON_SLUG = PILOT_MODULE.lessons.find((l) => l.test)?.slug ?? ''

export type GroupPerson = {
  readonly userId: string
  readonly displayName: string
  readonly username: string | null
  readonly groupRole: 'participant' | 'trainer'
}

export type OrgPerson = {
  readonly userId: string
  readonly displayName: string
  readonly username: string | null
  readonly role: OrgRole
}

export type GroupData = {
  readonly members: readonly GroupPerson[]
  readonly orgMembers: readonly OrgPerson[]
  readonly assignments: readonly { id: string; lessonSlug: string; dueAt: string | null }[]
  readonly matrix: readonly MatrixRow[]
  /** sloupce lekcí v matici (bez závěrečného testu, ten má vlastní sloupec) */
  readonly lessonSlugs: readonly string[]
  readonly mistakes: readonly { code: string; count: number }[]
  readonly mistakesAttempts: number
}

/**
 * Data stránky skupiny. Vše čte klient přihlášeného uživatele, takže co neprojde přes RLS
 * (cizí organizace, výsledky lidí mimo jeho skupiny), se sem vůbec nedostane (D-026, D-028).
 */
export async function loadGroupData(
  supabase: ServerClient,
  group: ManagedGroup,
): Promise<GroupData> {
  const [membersRes, assignmentsRes, orgMembersRes] = await Promise.all([
    supabase
      .from('group_members')
      .select('user_id, role, profiles(display_name, username)')
      .eq('group_id', group.id),
    supabase
      .from('assignments')
      .select('id, lesson_slug, due_at')
      .eq('group_id', group.id)
      .eq('module_slug', PILOT_MODULE.slug),
    supabase
      .from('memberships')
      .select('user_id, role, profiles(display_name, username)')
      .eq('org_id', group.orgId),
  ])
  const members: GroupPerson[] = (membersRes.data ?? [])
    .map((m) => ({
      userId: m.user_id,
      displayName: m.profiles?.display_name ?? '',
      username: m.profiles?.username ?? null,
      groupRole: m.role,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'cs'))
  const orgMembers: OrgPerson[] = (orgMembersRes.data ?? [])
    .map((m) => ({
      userId: m.user_id,
      displayName: m.profiles?.display_name ?? '',
      username: m.profiles?.username ?? null,
      role: m.role,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'cs'))

  const participants = members.filter((m) => m.groupRole === 'participant')
  const ids = participants.map((p) => p.userId)
  const since = new Date(Date.now() - MISTAKES_DAYS * 86_400_000).toISOString()
  const [progressRes, certRes, attemptsRes] = ids.length
    ? await Promise.all([
        supabase
          .from('lesson_progress')
          .select('user_id, lesson_slug, finished_runs, best_score, last_started_at')
          .eq('org_id', group.orgId)
          .eq('module_slug', PILOT_MODULE.slug)
          .in('user_id', ids),
        supabase
          .from('certificates')
          .select('user_id, verification_code')
          .eq('org_id', group.orgId)
          .eq('module_slug', PILOT_MODULE.slug)
          .in('user_id', ids),
        supabase
          .from('attempts')
          .select('error_codes')
          .eq('org_id', group.orgId)
          .eq('is_correct', false)
          .gte('created_at', since)
          .in('user_id', ids)
          .limit(MISTAKES_ATTEMPT_LIMIT),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const allSlugs = PILOT_MODULE.lessons.filter((l) => l.status === 'available').map((l) => l.slug)
  const matrix = buildMatrix({
    participants,
    progress: progressRes.data ?? [],
    certificates: certRes.data ?? [],
    lessonSlugs: allSlugs,
    finalLessonSlug: FINAL_LESSON_SLUG,
    passThreshold: FINAL_TEST_PASS_THRESHOLD,
  })
  const attempts = attemptsRes.data ?? []
  return {
    members,
    orgMembers,
    assignments: (assignmentsRes.data ?? []).map((a) => ({
      id: a.id,
      lessonSlug: a.lesson_slug,
      dueAt: a.due_at,
    })),
    matrix,
    lessonSlugs: allSlugs.filter((s) => s !== FINAL_LESSON_SLUG),
    mistakes: topErrorCodes(attempts),
    mistakesAttempts: attempts.filter((a) => (a.error_codes ?? []).length > 0).length,
  }
}
