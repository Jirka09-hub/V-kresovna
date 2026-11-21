import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// Přesměrování na jazykovou verzi (/ → /cs). Obnovu Supabase session sem přidáme ve fázi 4.
export default createMiddleware(routing)

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
