import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseEnv } from './env'

/** Supabase klient pro serverové komponenty, server actions a route handlers. */
export async function createClient() {
  const { url, key } = supabaseEnv()
  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options)
        } catch {
          // volání ze serverové komponenty: cookies nejde nastavit, session obnoví middleware (fáze 4)
        }
      },
    },
  })
}
