import { ENGINE_VERSION } from '@vykresovna/engine'
import { PROJECTION_METHOD } from '@vykresovna/drafting-standards'
import { supabaseEnv } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

/** Kontrola nasazení: běží aplikace, načtou se balíčky monorepa a je dostupný Supabase. */
export async function GET() {
  let supabase: 'ok' | 'error' = 'error'
  try {
    const { url, key } = supabaseEnv()
    const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } })
    supabase = res.ok ? 'ok' : 'error'
  } catch {
    supabase = 'error'
  }
  return Response.json({
    ok: true,
    engineVersion: ENGINE_VERSION,
    projectionMethod: PROJECTION_METHOD,
    supabase,
  })
}
