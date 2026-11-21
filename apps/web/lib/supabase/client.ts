import { createBrowserClient } from '@supabase/ssr'
import { supabaseEnv } from './env'

/** Supabase klient pro klientské komponenty. */
export function createClient() {
  const { url, key } = supabaseEnv()
  return createBrowserClient(url, key)
}
