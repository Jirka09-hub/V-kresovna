'use server'

import { revalidatePath } from 'next/cache'
import type { OrgRole } from '@/lib/auth/viewer'
import {
  appUrl,
  dbError,
  isUuid,
  requireOrgAdmin,
  str,
  type ManageState,
} from '@/lib/manage/server'

export type OrgInvitationState = ManageState & { readonly link?: string }

const FORBIDDEN: ManageState = { error: 'FORBIDDEN' }
const ROLES: readonly OrgRole[] = ['participant', 'trainer', 'org_admin']
const isRole = (v: string): v is OrgRole => (ROLES as readonly string[]).includes(v)

function refresh() {
  revalidatePath('/[locale]/sprava', 'layout')
  revalidatePath('/[locale]/skolitel', 'layout')
}

export async function renameOrganization(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const ctx = await requireOrgAdmin(str(fd, 'orgId'))
  if (!ctx) return FORBIDDEN
  const name = str(fd, 'name')
  if (name.length < 2 || name.length > 120) return { error: 'ORG_NAME_INVALID' }
  const { error } = await ctx.supabase
    .from('organizations')
    .update({ name })
    .eq('id', str(fd, 'orgId'))
  if (error) return { error: dbError(error) }
  refresh()
  return { ok: true }
}

export async function regenerateOrgCode(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const orgId = str(fd, 'orgId')
  const ctx = await requireOrgAdmin(orgId)
  if (!ctx) return FORBIDDEN
  const { error } = await ctx.supabase.rpc('regenerate_join_code', { p_org: orgId })
  if (error) return { error: dbError(error) }
  refresh()
  return { ok: true }
}

/**
 * Změna role člena. Sesazení na účastníka zabere místo v licenci (kontrola počtu míst) a jeho
 * vedení skupin v organizaci se změní na účastnictví (D-028).
 */
export async function changeMemberRole(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const orgId = str(fd, 'orgId')
  const userId = str(fd, 'userId')
  const role = str(fd, 'role')
  const ctx = await requireOrgAdmin(orgId)
  if (!ctx || !isUuid(userId) || !isRole(role)) return FORBIDDEN
  const { supabase } = ctx
  const { data: current } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!current) return { error: 'NOT_ORG_MEMBER' }
  if (current.role === role) return { ok: true }

  if (role === 'participant') {
    const [{ data: org }, { count }] = await Promise.all([
      supabase.from('organizations').select('seat_limit').eq('id', orgId).single(),
      supabase
        .from('memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'participant'),
    ])
    if (!org || (count ?? 0) >= org.seat_limit) return { error: 'NO_SEATS' }
  }

  const { error } = await supabase
    .from('memberships')
    .update({ role })
    .eq('org_id', orgId)
    .eq('user_id', userId)
  if (error) return { error: dbError(error) }
  if (role === 'participant') {
    await supabase
      .from('group_members')
      .update({ role: 'participant' })
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('role', 'trainer')
  }
  refresh()
  return { ok: true }
}

/** Odebrání z organizace (výsledky zůstanou, D-026). Sám sebe tu správce neodebírá. */
export async function removeMember(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const orgId = str(fd, 'orgId')
  const userId = str(fd, 'userId')
  const ctx = await requireOrgAdmin(orgId)
  if (!ctx || !isUuid(userId) || userId === ctx.viewer.userId) return FORBIDDEN
  const { error } = await ctx.supabase
    .from('memberships')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId)
  if (error) return { error: dbError(error) }
  refresh()
  return { ok: true }
}

export async function createOrgInvitation(
  _prev: OrgInvitationState,
  fd: FormData,
): Promise<OrgInvitationState> {
  const orgId = str(fd, 'orgId')
  const role = str(fd, 'role')
  const groupId = str(fd, 'groupId')
  const note = str(fd, 'note').slice(0, 120)
  const ctx = await requireOrgAdmin(orgId)
  if (!ctx || !isRole(role) || (groupId && !isUuid(groupId))) return FORBIDDEN
  const { data, error } = await ctx.supabase.rpc('create_invitation', {
    p_org: orgId,
    p_role: role,
    ...(groupId ? { p_group: groupId } : {}),
    ...(note ? { p_note: note } : {}),
  })
  if (error || !data) return { error: dbError(error) }
  refresh()
  return { link: await appUrl(`/pozvanka/${data}`) }
}

export async function revokeInvitation(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const orgId = str(fd, 'orgId')
  const id = str(fd, 'invitationId')
  const ctx = await requireOrgAdmin(orgId)
  if (!ctx || !isUuid(id)) return FORBIDDEN
  const { error } = await ctx.supabase.from('invitations').delete().eq('id', id).eq('org_id', orgId)
  if (error) return { error: dbError(error) }
  refresh()
  return { ok: true }
}
