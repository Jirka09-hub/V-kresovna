import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'
import { supabaseEnv } from './env'

/** Supabase klient pro klientské komponenty (jedna instance na stránku). */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null
export function createClient() {
  if (!browserClient) {
    const { url, key } = supabaseEnv()
    browserClient = createBrowserClient<Database>(url, key)
  }
  return browserClient
}
