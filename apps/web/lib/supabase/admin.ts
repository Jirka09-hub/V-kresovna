import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { supabaseEnv } from './env'

/**
 * Klient se SUPABASE_SECRET_KEY (obchází RLS). Jen na serveru a jen pro akce, které RLS
 * nepokryje: založení účtu (Auth Admin API), nové heslo účastníkovi, zařazení nového účtu.
 * Oprávnění volajícího se musí ověřit předem (D-026).
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') throw new Error('createAdminClient jen na serveru')
  const { url } = supabaseEnv()
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('Chybí SUPABASE_SECRET_KEY (Cloudflare secret / .env.local)')
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** Je tajný klíč nastavený? (stránky pro zakládání účtů bez něj ukážou vysvětlení) */
export function hasAdminKey(): boolean {
  return !!process.env.SUPABASE_SECRET_KEY
}
