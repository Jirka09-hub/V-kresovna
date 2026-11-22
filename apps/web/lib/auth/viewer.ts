import { cookies } from 'next/headers'
import { cache } from 'react'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { usernameFromEmail, isSyntheticEmail } from './login-id'

export type OrgRole = Database['public']['Enums']['org_role']
export type OrgKind = Database['public']['Enums']['org_kind']

/** Cookie s id aktivní organizace (u členů více organizací), D-026. */
export const ACTIVE_ORG_COOKIE = 'vk_org'

export type ViewerMembership = {
  readonly orgId: string
  readonly role: OrgRole
  readonly orgName: string
  readonly orgKind: OrgKind
  readonly licenseValidUntil: string
}

export type Viewer = {
  readonly userId: string
  readonly displayName: string
  /** přihlašovací jméno (účet bez e-mailu), jinak null */
  readonly username: string | null
  /** skutečný e-mail (u účtů bez e-mailu null) */
  readonly email: string | null
  readonly memberships: readonly ViewerMembership[]
  readonly activeOrgId: string | null
  readonly isPlatformAdmin: boolean
}

/** Přihlášený uživatel se členstvími (jednou za požadavek), nebo null. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return null
  const [profile, memberships, platform] = await Promise.all([
    supabase.from('profiles').select('display_name, username').eq('id', user.id).maybeSingle(),
    supabase
      .from('memberships')
      .select('org_id, role, organizations(name, kind, license_valid_until)')
      .eq('user_id', user.id),
    supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
  ])
  const list: ViewerMembership[] = (memberships.data ?? [])
    .filter((m) => m.organizations)
    .map((m) => ({
      orgId: m.org_id,
      role: m.role,
      orgName: m.organizations!.name,
      orgKind: m.organizations!.kind,
      licenseValidUntil: m.organizations!.license_valid_until,
    }))
    .sort((a, b) => a.orgName.localeCompare(b.orgName, 'cs'))
  const wanted = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value
  const active = list.find((m) => m.orgId === wanted) ?? list[0] ?? null
  return {
    userId: user.id,
    displayName: profile.data?.display_name ?? '',
    username: profile.data?.username ?? usernameFromEmail(user.email),
    email: isSyntheticEmail(user.email) ? null : (user.email ?? null),
    memberships: list,
    activeOrgId: active?.orgId ?? null,
    isPlatformAdmin: !!platform.data,
  }
})

export function activeMembership(viewer: Viewer): ViewerMembership | null {
  return viewer.memberships.find((m) => m.orgId === viewer.activeOrgId) ?? null
}

export { licenseActive } from './license'
