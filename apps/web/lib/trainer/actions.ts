'use server'

import { PILOT_MODULE } from '@vykresovna/content'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import {
  generatePassword,
  suggestUsername,
  SYNTHETIC_EMAIL_DOMAIN,
  usernameFromEmail,
} from '@/lib/auth/login-id'
import {
  appUrl,
  dbError,
  isUuid,
  loadManagedGroup,
  requireViewer,
  str,
  type ManageState,
} from '@/lib/manage/server'
import { createAdminClient, hasAdminKey } from '@/lib/supabase/admin'
import { BULK_MAX } from './constants'
import { pragueEndOfDay } from './dates'

export type InvitationState = ManageState & { readonly link?: string }
export type CreatedAccount = {
  readonly name: string
  readonly login: string
  readonly password: string
}
export type BulkState = ManageState & { readonly created?: readonly CreatedAccount[] }
export type ResetState = ManageState & {
  readonly name?: string
  readonly login?: string
  readonly password?: string
}

const FORBIDDEN: ManageState = { error: 'FORBIDDEN' }

function refresh() {
  revalidatePath('/[locale]/skolitel', 'layout')
}

/** Nová skupina v aktivní organizaci; spouštěč v DB z tvůrce udělá školitele skupiny. */
export async function createGroup(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const ctx = await requireViewer()
  const orgId = str(fd, 'orgId')
  const name = str(fd, 'name')
  const role = ctx?.viewer.memberships.find((m) => m.orgId === orgId)?.role
  if (!ctx || (role !== 'trainer' && role !== 'org_admin')) return FORBIDDEN
  if (name.length < 1 || name.length > 80) return { error: 'GROUP_NAME_INVALID' }
  const { data, error } = await ctx.supabase
    .from('groups')
    .insert({ org_id: orgId, name, created_by: ctx.viewer.userId })
    .select('id')
    .single()
  if (error || !data) return { error: dbError(error) }
  refresh()
  return redirect({ href: `/skolitel/skupina/${data.id}`, locale: await getLocale() })
}

export async function setGroupArchived(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const ctx = await loadManagedGroup(str(fd, 'groupId'))
  if (!ctx) return FORBIDDEN
  const archived = str(fd, 'archived') === '1'
  const { error } = await ctx.supabase
    .from('groups')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', ctx.group.id)
  if (error) return { error: dbError(error) }
  refresh()
  return { ok: true }
}

export async function regenerateGroupCode(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const ctx = await loadManagedGroup(str(fd, 'groupId'))
  if (!ctx) return FORBIDDEN
  const { error } = await ctx.supabase.rpc('regenerate_join_code', { p_group: ctx.group.id })
  if (error) return { error: dbError(error) }
  refresh()
  return { ok: true }
}

function parseDue(fd: FormData): { dueAt: string | null } | { error: string } {
  const raw = str(fd, 'dueDate')
  if (!raw) return { dueAt: null }
  const dueAt = pragueEndOfDay(raw)
  return dueAt ? { dueAt } : { error: 'DATE_INVALID' }
}

export async function addAssignment(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const ctx = await loadManagedGroup(str(fd, 'groupId'))
  if (!ctx) return FORBIDDEN
  const lessonSlug = str(fd, 'lessonSlug')
  if (!PILOT_MODULE.lessons.some((l) => l.slug === lessonSlug && l.status === 'available'))
    return { error: 'LESSON_INVALID' }
  const due = parseDue(fd)
  if ('error' in due) return due
  const { error } = await ctx.supabase.from('assignments').insert({
    group_id: ctx.group.id,
    module_slug: PILOT_MODULE.slug,
    lesson_slug: lessonSlug,
    due_at: due.dueAt,
    created_by: ctx.viewer.userId,
  })
  if (error) return { error: error.code === '23505' ? 'ALREADY_ASSIGNED' : dbError(error) }
  refresh()
  return { ok: true }
}

export async function updateAssignmentDue(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const ctx = await loadManagedGroup(str(fd, 'groupId'))
  const id = str(fd, 'assignmentId')
  if (!ctx || !isUuid(id)) return FORBIDDEN
  const due = parseDue(fd)
  if ('error' in due) return due
  const { error } = await ctx.supabase
    .from('assignments')
    .update({ due_at: due.dueAt })
    .eq('id', id)
    .eq('group_id', ctx.group.id)
  if (error) return { error: dbError(error) }
  refresh()
  return { ok: true }
}

export async function removeAssignment(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const ctx = await loadManagedGroup(str(fd, 'groupId'))
  const id = str(fd, 'assignmentId')
  if (!ctx || !isUuid(id)) return FORBIDDEN
  const { error } = await ctx.supabase
    .from('assignments')
    .delete()
    .eq('id', id)
    .eq('group_id', ctx.group.id)
  if (error) return { error: dbError(error) }
  refresh()
  return { ok: true }
}

/** Zařazení existujícího člena organizace: účastník jako účastník, školitel/správce jako školitel. */
export async function addGroupMember(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const ctx = await loadManagedGroup(str(fd, 'groupId'))
  const userId = str(fd, 'userId')
  if (!ctx || !isUuid(userId)) return FORBIDDEN
  const { data: membership } = await ctx.supabase
    .from('memberships')
    .select('role')
    .eq('org_id', ctx.group.orgId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!membership) return { error: 'NOT_ORG_MEMBER' }
  const { error } = await ctx.supabase.from('group_members').insert({
    group_id: ctx.group.id,
    org_id: ctx.group.orgId,
    user_id: userId,
    role: membership.role === 'participant' ? 'participant' : 'trainer',
  })
  if (error) return { error: error.code === '23505' ? 'ALREADY_IN_GROUP' : dbError(error) }
  refresh()
  return { ok: true }
}

export async function removeGroupMember(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const ctx = await loadManagedGroup(str(fd, 'groupId'))
  const userId = str(fd, 'userId')
  // sám sebe ze skupiny neodebírá (přišel by o přístup); to udělá správce
  if (!ctx || !isUuid(userId) || userId === ctx.viewer.userId) return FORBIDDEN
  const { error } = await ctx.supabase
    .from('group_members')
    .delete()
    .eq('group_id', ctx.group.id)
    .eq('user_id', userId)
  if (error) return { error: dbError(error) }
  refresh()
  return { ok: true }
}

/** Pozvánka pro účastníka rovnou do skupiny; odkaz se ukáže jen jednou (v DB je otisk). */
export async function createGroupInvitation(
  _prev: InvitationState,
  fd: FormData,
): Promise<InvitationState> {
  const ctx = await loadManagedGroup(str(fd, 'groupId'))
  if (!ctx) return FORBIDDEN
  const note = str(fd, 'note').slice(0, 120)
  const { data, error } = await ctx.supabase.rpc('create_invitation', {
    p_org: ctx.group.orgId,
    p_role: 'participant',
    p_group: ctx.group.id,
    ...(note ? { p_note: note } : {}),
  })
  if (error || !data) return { error: dbError(error) }
  return { link: await appUrl(`/pozvanka/${data}`) }
}

/** Jména z textového pole: jedno na řádek, prázdné řádky pryč. */
function parseNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

type Admin = ReturnType<typeof createAdminClient>

/** Založí účet bez e-mailu; při obsazeném jménu zkusí číselnou příponu. */
async function createAccount(
  admin: Admin,
  name: string,
): Promise<{ id: string; login: string; password: string } | null> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const login = suggestUsername(name, attempt === 0 ? undefined : attempt + 1)
    const { data: taken } = await admin
      .from('profiles')
      .select('id')
      .eq('username', login)
      .maybeSingle()
    if (taken) continue
    const password = generatePassword()
    const { data, error } = await admin.auth.admin.createUser({
      email: `${login}@${SYNTHETIC_EMAIL_DOMAIN}`,
      password,
      email_confirm: true,
      user_metadata: { display_name: name, username: login },
    })
    if (data.user) return { id: data.user.id, login, password }
    // souběh: jméno mezitím někdo zabral → další přípona; jiná chyba → konec
    if (!(error?.code === 'email_exists' || /already|exists|duplicate/i.test(error?.message ?? '')))
      return null
  }
  return null
}

/**
 * Hromadné založení účtů pro lidi bez e-mailu (D-028). Oprávnění: školitel skupiny nebo správce
 * organizace (ověřeno klientem uživatele), samotné založení přes Auth Admin API. Hesla se vrátí
 * jen v této odpovědi; nikde se neukládají v čitelné podobě.
 */
export async function bulkCreateAccounts(_prev: BulkState, fd: FormData): Promise<BulkState> {
  const ctx = await loadManagedGroup(str(fd, 'groupId'))
  if (!ctx) return FORBIDDEN
  if (!hasAdminKey()) return { error: 'SERVER_NOT_CONFIGURED' }
  const names = parseNames(String(fd.get('names') ?? ''))
  if (names.length === 0) return { error: 'BULK_EMPTY' }
  if (names.length > BULK_MAX) return { error: 'BULK_TOO_MANY', detail: String(BULK_MAX) }
  const bad = names.findIndex((n) => n.length < 2 || n.length > 80)
  if (bad >= 0) return { error: 'BULK_NAME_INVALID', detail: String(bad + 1) }

  const admin = createAdminClient()
  const created: CreatedAccount[] = []
  for (const name of names) {
    const account = await createAccount(admin, name)
    if (!account) return { created, error: 'BULK_FAILED', detail: name }
    const { error } = await admin.rpc('add_participant', {
      p_user: account.id,
      p_org: ctx.group.orgId,
      p_group: ctx.group.id,
    })
    if (error) {
      // účet bez organizace nenechávat; u plné nebo prošlé licence nemá smysl pokračovat
      await admin.auth.admin.deleteUser(account.id)
      return { created, error: dbError(error), detail: name }
    }
    created.push({ name, login: account.login, password: account.password })
  }
  refresh()
  return { created, ok: true }
}

/** Nové heslo účastníkovi (zapomněl ho a e-mail nemá); ukáže se jen jednou. */
export async function resetPassword(_prev: ResetState, fd: FormData): Promise<ResetState> {
  const ctx = await requireViewer()
  const target = str(fd, 'userId')
  if (!ctx || !isUuid(target)) return FORBIDDEN
  if (!hasAdminKey()) return { error: 'SERVER_NOT_CONFIGURED' }
  const admin = createAdminClient()
  const { data: allowed } = await admin.rpc('can_manage_account', {
    p_actor: ctx.viewer.userId,
    p_target: target,
  })
  if (allowed !== true) return FORBIDDEN
  const password = generatePassword()
  const { data, error } = await admin.auth.admin.updateUserById(target, { password })
  if (error || !data.user) return { error: 'UNKNOWN' }
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', target)
    .maybeSingle()
  return {
    ok: true,
    name: profile?.display_name ?? '',
    login: usernameFromEmail(data.user.email) ?? data.user.email ?? '',
    password,
  }
}
