import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'
import { supabaseEnv } from './env'

/** Supabase klient pro serverové komponenty, server actions a route handlers (session z cookies). */
export async function createClient() {
  const { url, key } = supabaseEnv()
  const cookieStore = await cookies()
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options)
        } catch {
          // volání ze serverové komponenty: cookies nejde nastavit, session obnovuje middleware
        }
      },
    },
  })
}
