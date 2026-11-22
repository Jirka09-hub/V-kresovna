import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { supabaseEnv } from './lib/supabase/env'

const intl = createMiddleware(routing)

/**
 * 1) Přesměrování na jazykovou verzi (/ → /cs).
 * 2) Obnova Supabase session (výměna prošlého access tokenu), jen když prohlížeč posílá auth cookie,
 *    aby anonymní návštěvy (demo, lekce) nic nestály.
 */
export default async function middleware(request: NextRequest) {
  const response = intl(request)
  if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) return response

  const { url, key } = supabaseEnv()
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        }
      },
    },
  })
  await supabase.auth.getClaims()
  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
