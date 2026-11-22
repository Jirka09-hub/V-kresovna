import { headers } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { getViewer, type Viewer } from '@/lib/auth/viewer'
import { createClient } from '@/lib/supabase/server'

/**
 * Společné pomocné funkce pro správu (školitel, správce organizace, správa platformy, D-028).
 * Jen pro server; nejsou to server actions (soubor bez 'use server'), volají je akce
 * v lib/trainer, lib/org-admin a lib/platform a serverové stránky.
 */

/** Stav formulářů správy: kód chyby (překlad `manage.errors` / `auth.errors`) a doplněk. */
export type ManageState = {
  readonly error?: string
  /** doplněk k chybě, např. číslo řádku */
  readonly detail?: string
  readonly ok?: boolean
}

/** Kódy chyb z databáze (raise exception '<KÓD>'). */
const DB_ERRORS = [
  'LAST_ORG_ADMIN',
  'NOT_TRAINER',
  'LICENSE_EXPIRED',
  'NO_SEATS',
  'FORBIDDEN',
] as const

type PgError = { readonly message?: string; readonly code?: string } | null | undefined

export function dbError(error: PgError): string {
  if (!error) return 'UNKNOWN'
  const known = DB_ERRORS.find((c) => error.message?.includes(c))
  if (known) return known
  // 42501 = chybí oprávnění (RLS / grant), 23505 = duplicita, 23514/22xxx = neplatná hodnota
  if (error.code === '42501') return 'FORBIDDEN'
  if (error.code === '23505') return 'DUPLICATE'
  if (error.code === '23514' || error.code?.startsWith('22')) return 'INVALID_INPUT'
  return 'UNKNOWN'
}

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim()

export const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/** Adresa webu z hlaviček požadavku (pro odkazy k předání: pozvánky, připojení kódem). */
export async function siteOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost'
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() || (local ? 'http' : 'https')
  return `${proto}://${host}`
}

/** Celý odkaz na stránku aplikace v aktuálním jazyce. */
export async function appUrl(path: string): Promise<string> {
  return `${await siteOrigin()}/${await getLocale()}${path}`
}

type ServerClient = Awaited<ReturnType<typeof createClient>>

/** Přihlášený uživatel a klient s jeho oprávněními (RLS); null = nepřihlášen. */
export async function requireViewer(): Promise<{
  viewer: Viewer
  supabase: ServerClient
} | null> {
  const viewer = await getViewer()
  if (!viewer) return null
  return { viewer, supabase: await createClient() }
}

export type ManagedGroup = {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly joinCode: string | null
  readonly archivedAt: string | null
}

/**
 * Skupina, kterou přihlášený uživatel smí spravovat (stejná pravidla jako `app.can_manage_group`
 * v SQL: správce organizace všechny její skupiny, školitel ty, které vede), jinak null.
 * Skupinu čte klientem uživatele, takže skupina cizí organizace neprojde už přes RLS.
 */
export async function loadManagedGroup(groupId: string): Promise<{
  viewer: Viewer
  supabase: ServerClient
  group: ManagedGroup
} | null> {
  if (!isUuid(groupId)) return null
  const ctx = await requireViewer()
  if (!ctx) return null
  const { viewer, supabase } = ctx
  const { data: group } = await supabase
    .from('groups')
    .select('id, org_id, name, join_code, archived_at')
    .eq('id', groupId)
    .maybeSingle()
  if (!group) return null
  const role = viewer.memberships.find((m) => m.orgId === group.org_id)?.role
  let allowed = role === 'org_admin'
  if (role === 'trainer') {
    const { data } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', group.id)
      .eq('user_id', viewer.userId)
      .eq('role', 'trainer')
      .maybeSingle()
    allowed = !!data
  }
  if (!allowed) return null
  return {
    viewer,
    supabase,
    group: {
      id: group.id,
      orgId: group.org_id,
      name: group.name,
      joinCode: group.join_code,
      archivedAt: group.archived_at,
    },
  }
}

/** Je přihlášený uživatel správcem dané organizace? */
export async function requireOrgAdmin(orgId: string) {
  if (!isUuid(orgId)) return null
  const ctx = await requireViewer()
  if (!ctx) return null
  const m = ctx.viewer.memberships.find((x) => x.orgId === orgId)
  return m?.role === 'org_admin' ? ctx : null
}
