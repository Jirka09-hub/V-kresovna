'use server'

import { cookies } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { createAdminClient, hasAdminKey } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { parseLoginId, validPassword } from './login-id'
import { ACTIVE_ORG_COOKIE } from './viewer'

/** Stav formulářů: kód chyby (překlad v messages `auth.errors.<KÓD>`), případně vyplněné hodnoty. */
export type FormState = { readonly error?: string; readonly values?: Record<string, string> }

/** Kódy chyb, které vracejí databázové funkce (raise exception '<KÓD>'). */
const DB_ERRORS = [
  'INVALID_CODE',
  'LICENSE_EXPIRED',
  'NO_SEATS',
  'INVALID_INVITATION',
  'INVITATION_USED',
  'INVITATION_EXPIRED',
  'FORBIDDEN',
] as const

function dbError(message: string | undefined): string {
  return DB_ERRORS.find((c) => message?.includes(c)) ?? 'UNKNOWN'
}

/** Bezpečný cíl přesměrování (jen cesta v aplikaci, bez jazyka). */
function safeNext(next: FormDataEntryValue | null, fallback: string): string {
  const n = typeof next === 'string' ? next : ''
  if (!n.startsWith('/') || n.startsWith('//') || n.includes('\\')) return fallback
  return n.replace(/^\/cs(?=\/|$)/, '') || fallback
}

async function setActiveOrg(orgId: string) {
  ;(await cookies()).set(ACTIVE_ORG_COOKIE, orgId, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === 'production',
  })
}

async function go(href: string): Promise<never> {
  return redirect({ href, locale: await getLocale() })
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim()

export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const loginId = str(fd, 'login')
  const parsed = parseLoginId(loginId)
  const values = { login: loginId }
  if (!parsed) return { error: 'LOGIN_INVALID', values }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password: String(fd.get('password') ?? ''),
  })
  if (error) return { error: 'INVALID_CREDENTIALS', values }
  return go(safeNext(fd.get('next'), '/ucet'))
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  ;(await cookies()).delete(ACTIVE_ORG_COOKIE)
  await go('/')
}

export async function switchOrganization(fd: FormData): Promise<void> {
  const orgId = str(fd, 'orgId')
  const supabase = await createClient()
  const { data } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('org_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .maybeSingle()
  if (data) await setActiveOrg(orgId)
  await go(safeNext(fd.get('next'), '/ucet'))
}

type JoinKind = 'code' | 'invitation' | 'platform'

/** Připojení přihlášeného uživatele (kód / pozvánka). */
async function joinAsCurrentUser(
  kind: JoinKind,
  secret: string,
): Promise<{ orgId?: string; error?: string }> {
  const supabase = await createClient()
  if (kind === 'platform') {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return { error: 'UNKNOWN' }
    const { error } = await createAdminClient().rpc('accept_platform_invitation', {
      p_token: secret,
      p_user: auth.user.id,
    })
    return error ? { error: dbError(error.message) } : {}
  }
  const { data, error } =
    kind === 'code'
      ? await supabase.rpc('join_organization', { p_code: secret })
      : await supabase.rpc('accept_invitation', { p_token: secret })
  return error ? { error: dbError(error.message) } : { orgId: data }
}

/** Kam po připojení: školitelé a správci na přehled, účastníci na lekce, správce platformy na správu. */
async function landing(kind: JoinKind, orgId?: string): Promise<string> {
  if (kind === 'platform') return '/platforma'
  if (!orgId) return '/lekce'
  const supabase = await createClient()
  const { data } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .maybeSingle()
  return data?.role === 'org_admin' ? '/sprava' : data?.role === 'trainer' ? '/skolitel' : '/lekce'
}

/** Přihlášený uživatel se připojí kódem nebo přijme pozvánku. */
export async function joinExisting(_prev: FormState, fd: FormData): Promise<FormState> {
  const kind = str(fd, 'kind') as JoinKind
  const secret = str(fd, 'secret')
  const res = await joinAsCurrentUser(kind, secret)
  if (res.error) return { error: res.error }
  if (res.orgId) await setActiveOrg(res.orgId)
  return go(await landing(kind, res.orgId))
}

/** Nový účet + připojení (kód organizace/skupiny, pozvánka nebo pozvánka správce platformy). */
export async function createAccountAndJoin(_prev: FormState, fd: FormData): Promise<FormState> {
  const kind = str(fd, 'kind') as JoinKind
  const secret = str(fd, 'secret')
  const displayName = str(fd, 'displayName')
  const login = str(fd, 'login')
  const password = String(fd.get('password') ?? '')
  const values = { displayName, login }

  if (displayName.length < 2 || displayName.length > 80) return { error: 'NAME_INVALID', values }
  const parsed = parseLoginId(login)
  if (!parsed) return { error: 'LOGIN_INVALID', values }
  if (!validPassword(password)) return { error: 'PASSWORD_INVALID', values }
  if (password !== String(fd.get('password2') ?? '')) return { error: 'PASSWORD_MISMATCH', values }
  if (!hasAdminKey()) return { error: 'SERVER_NOT_CONFIGURED', values }

  // ověřit kód/pozvánku dřív, než vznikne účet
  const supabase = await createClient()
  const admin = createAdminClient()
  if (kind === 'code') {
    const { data } = await supabase.rpc('join_code_preview', { p_code: secret })
    const status = data?.[0]?.status
    if (status !== 'ok')
      return {
        error: status === 'invalid' ? 'INVALID_CODE' : (status?.toUpperCase() ?? 'UNKNOWN'),
        values,
      }
  } else if (kind === 'invitation') {
    const { data } = await supabase.rpc('invitation_preview', { p_token: secret })
    const status = data?.[0]?.status
    if (status !== 'ok')
      return {
        error: status === 'invalid' ? 'INVALID_INVITATION' : `INVITATION_${status?.toUpperCase()}`,
        values,
      }
  } else {
    const { data } = await admin.rpc('platform_invitation_valid', { p_token: secret })
    if (!data) return { error: 'INVALID_INVITATION', values }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      ...(parsed.kind === 'username' ? { username: parsed.username } : {}),
    },
  })
  if (createError || !created.user) {
    const taken =
      createError?.code === 'email_exists' || /already/i.test(createError?.message ?? '')
    return {
      error: taken ? (parsed.kind === 'email' ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN') : 'UNKNOWN',
      values,
    }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password,
  })
  const res = signInError ? { error: 'UNKNOWN' } : await joinAsCurrentUser(kind, secret)
  if (res.error) {
    // připojení selhalo (např. mezitím došla místa): účet bez organizace nenechávat
    await supabase.auth.signOut()
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: res.error, values }
  }
  if ('orgId' in res && res.orgId) await setActiveOrg(res.orgId)
  return go(await landing(kind, 'orgId' in res ? res.orgId : undefined))
}
