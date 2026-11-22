'use server'

import { revalidatePath } from 'next/cache'
import type { OrgKind } from '@/lib/auth/viewer'
import { appUrl, dbError, isUuid, requireViewer, str, type ManageState } from '@/lib/manage/server'

export type CreateOrgState = ManageState & {
  readonly orgId?: string
  readonly orgName?: string
}
export type AdminInvitationState = ManageState & { readonly link?: string }

const FORBIDDEN: ManageState = { error: 'FORBIDDEN' }
const DATE = /^\d{4}-\d{2}-\d{2}$/

async function requirePlatformAdmin() {
  const ctx = await requireViewer()
  return ctx?.viewer.isPlatformAdmin ? ctx : null
}

function parseLicense(fd: FormData): { seats: number; validUntil: string } | { error: string } {
  const seats = Number(str(fd, 'seats'))
  const validUntil = str(fd, 'validUntil')
  if (!Number.isInteger(seats) || seats < 0 || seats > 100000) return { error: 'SEATS_INVALID' }
  if (!DATE.test(validUntil) || Number.isNaN(Date.parse(validUntil)))
    return { error: 'DATE_INVALID' }
  return { seats, validUntil }
}

function refresh() {
  revalidatePath('/[locale]/platforma', 'page')
}

export async function createOrganization(
  _prev: CreateOrgState,
  fd: FormData,
): Promise<CreateOrgState> {
  const ctx = await requirePlatformAdmin()
  if (!ctx) return FORBIDDEN
  const name = str(fd, 'name')
  const kind = str(fd, 'kind') as OrgKind
  if (name.length < 2 || name.length > 120) return { error: 'ORG_NAME_INVALID' }
  if (kind !== 'company' && kind !== 'school') return { error: 'INVALID_INPUT' }
  const license = parseLicense(fd)
  if ('error' in license) return license
  const { data, error } = await ctx.supabase.rpc('create_organization', {
    p_name: name,
    p_kind: kind,
    p_seat_limit: license.seats,
    p_valid_until: license.validUntil,
  })
  if (error || !data) return { error: dbError(error) }
  refresh()
  return { ok: true, orgId: data, orgName: name }
}

export async function updateLicense(_prev: ManageState, fd: FormData): Promise<ManageState> {
  const ctx = await requirePlatformAdmin()
  const orgId = str(fd, 'orgId')
  if (!ctx || !isUuid(orgId)) return FORBIDDEN
  const license = parseLicense(fd)
  if ('error' in license) return license
  const { error } = await ctx.supabase.rpc('update_organization_license', {
    p_org: orgId,
    p_seat_limit: license.seats,
    p_valid_until: license.validUntil,
  })
  if (error) return { error: dbError(error) }
  refresh()
  return { ok: true }
}

/** Pozvánka pro prvního správce organizace (create_invitation pustí správce platformy). */
export async function createAdminInvitation(
  _prev: AdminInvitationState,
  fd: FormData,
): Promise<AdminInvitationState> {
  const ctx = await requirePlatformAdmin()
  const orgId = str(fd, 'orgId')
  if (!ctx || !isUuid(orgId)) return FORBIDDEN
  const note = str(fd, 'note').slice(0, 120)
  const { data, error } = await ctx.supabase.rpc('create_invitation', {
    p_org: orgId,
    p_role: 'org_admin',
    ...(note ? { p_note: note } : {}),
  })
  if (error || !data) return { error: dbError(error) }
  return { link: await appUrl(`/pozvanka/${data}`) }
}
