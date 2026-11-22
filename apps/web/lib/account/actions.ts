'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { validPassword } from '@/lib/auth/login-id'
import { DELETE_CONFIRMATION } from './constants'
import { ACTIVE_ORG_COOKIE } from '@/lib/auth/viewer'
import { createClient } from '@/lib/supabase/server'

/**
 * Akce stránky „Můj účet“ (D-029). Vše za přihlášeného uživatele přes jeho session (RLS), jen
 * smazání účtu jde přes funkci `delete_my_account`. Chyby jsou kódy s překladem
 * v messages `account.errors.<KÓD>`.
 */
export type AccountFormState = {
  readonly error?: string
  readonly ok?: boolean
  readonly values?: Record<string, string>
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim()

function revalidateAccount() {
  revalidatePath('/[locale]/ucet', 'page')
}

export async function updateDisplayName(
  _prev: AccountFormState,
  fd: FormData,
): Promise<AccountFormState> {
  const displayName = str(fd, 'displayName').replace(/\s+/g, ' ')
  const values = { displayName }
  if (displayName.length < 2 || displayName.length > 80) return { error: 'NAME_INVALID', values }
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { error: 'NOT_SIGNED_IN', values }
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', auth.user.id)
  if (error) return { error: 'UNKNOWN', values }
  revalidateAccount()
  return { ok: true, values }
}

export async function changePassword(
  _prev: AccountFormState,
  fd: FormData,
): Promise<AccountFormState> {
  const current = String(fd.get('currentPassword') ?? '')
  const next = String(fd.get('newPassword') ?? '')
  if (!validPassword(next)) return { error: 'PASSWORD_INVALID' }
  if (next !== String(fd.get('newPassword2') ?? '')) return { error: 'PASSWORD_MISMATCH' }
  if (next === current) return { error: 'SAME_PASSWORD' }
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const email = auth.user?.email
  if (!email) return { error: 'NOT_SIGNED_IN' }
  // současné heslo ověřit přihlášením (u účtů bez e-mailu je to technická adresa)
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: current,
  })
  if (signInError) return { error: 'WRONG_PASSWORD' }
  const { error } = await supabase.auth.updateUser({ password: next })
  if (error) {
    return {
      error:
        error.code === 'same_password'
          ? 'SAME_PASSWORD'
          : error.code === 'weak_password'
            ? 'PASSWORD_INVALID'
            : 'UNKNOWN',
    }
  }
  return { ok: true }
}

export async function leaveOrganization(
  _prev: AccountFormState,
  fd: FormData,
): Promise<AccountFormState> {
  const orgId = str(fd, 'orgId')
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { error: 'NOT_SIGNED_IN' }
  const { data, error } = await supabase
    .from('memberships')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('org_id', orgId)
    .select('org_id')
  if (error)
    return { error: error.message.includes('LAST_ORG_ADMIN') ? 'LAST_ORG_ADMIN' : 'UNKNOWN' }
  if (!data?.length) return { error: 'UNKNOWN' }
  const store = await cookies()
  if (store.get(ACTIVE_ORG_COOKIE)?.value === orgId) store.delete(ACTIVE_ORG_COOKIE)
  revalidateAccount()
  return { ok: true }
}

export async function deleteAccount(
  _prev: AccountFormState,
  fd: FormData,
): Promise<AccountFormState> {
  if (str(fd, 'confirm') !== DELETE_CONFIRMATION) return { error: 'CONFIRM_MISMATCH' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_my_account')
  if (error) return { error: 'UNKNOWN' }
  // účet už neexistuje: odhlásit a pro jistotu smazat i cookies session
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  const store = await cookies()
  for (const c of store.getAll()) {
    if (c.name.startsWith('sb-') || c.name === ACTIVE_ORG_COOKIE) store.delete(c.name)
  }
  return redirect({ href: { pathname: '/', query: { ucet: 'smazan' } }, locale: await getLocale() })
}
