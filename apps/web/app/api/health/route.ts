import { ENGINE_VERSION } from '@vykresovna/engine'
import { PROJECTION_METHOD } from '@vykresovna/drafting-standards'
import { checkAdminKey } from '@/lib/supabase/admin'
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
    // jen zda je tajný klíč nastavený a databáze ho přijme (hodnota se nikdy nevrací);
    // bez něj nejde zakládat účty
    accounts: await checkAdminKey(),
  })
}
