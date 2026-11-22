/**
 * Příprava dat pro e2e testy s účty: přímo přes lokální Supabase se SUPABASE_SECRET_KEY
 * (apps/web/.env.local z `pnpm db:env`). Bez klíče se testy s účty přeskočí.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/database.types'
import { SYNTHETIC_EMAIL_DOMAIN } from '../lib/auth/login-id'

function readEnv(): Record<string, string> {
  try {
    const text = readFileSync(fileURLToPath(new URL('../.env.local', import.meta.url)), 'utf8')
    return Object.fromEntries(
      text
        .split('\n')
        .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
        .filter((m): m is RegExpMatchArray => !!m)
        .map((m) => [m[1]!, m[2]!]),
    )
  } catch {
    return {}
  }
}

const env = { ...readEnv(), ...process.env } as Record<string, string | undefined>
const url = env.NEXT_PUBLIC_SUPABASE_URL
const secret = env.SUPABASE_SECRET_KEY

/** Běží lokální Supabase s tajným klíčem (a ne produkce)? */
export const dbAvailable = !!url && !!secret && /127\.0\.0\.1|localhost/.test(url)

let client: SupabaseClient<Database> | null = null
export function admin(): SupabaseClient<Database> {
  if (!dbAvailable)
    throw new Error('e2e s účty potřebují lokální Supabase (pnpm db:start && pnpm db:env)')
  client ??= createClient<Database>(url!, secret!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

/** Krátké unikátní id (testy běží paralelně proti jedné databázi). */
export const uniq = () => randomUUID().replace(/-/g, '').slice(0, 10)

export async function createOrg(
  opts: { name?: string; seats?: number; validDays?: number; kind?: 'company' | 'school' } = {},
) {
  const valid = new Date(Date.now() + (opts.validDays ?? 30) * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const { data, error } = await admin()
    .from('organizations')
    .insert({
      name: opts.name ?? `Firma ${uniq()}`,
      kind: opts.kind ?? 'company',
      seat_limit: opts.seats ?? 30,
      license_valid_until: valid,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Účet s přihlašovacím jménem (bez e-mailu); vrací i heslo. */
export async function createUser(displayName = `Uživatel ${uniq()}`) {
  const username = `u${uniq()}`
  const password = `heslo-${uniq()}`
  const { data, error } = await admin().auth.admin.createUser({
    email: `${username}@${SYNTHETIC_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, username },
  })
  if (error) throw error
  return { id: data.user.id, username, password, displayName }
}

export async function addMember(
  userId: string,
  orgId: string,
  role: Database['public']['Enums']['org_role'],
) {
  const { error } = await admin()
    .from('memberships')
    .insert({ user_id: userId, org_id: orgId, role })
  if (error) throw error
}

export async function createGroup(orgId: string, name: string, trainerId?: string) {
  const { data, error } = await admin()
    .from('groups')
    .insert({ org_id: orgId, name, created_by: trainerId ?? null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function addGroupMember(
  groupId: string,
  orgId: string,
  userId: string,
  role: 'participant' | 'trainer' = 'participant',
) {
  const { error } = await admin()
    .from('group_members')
    .insert({ group_id: groupId, org_id: orgId, user_id: userId, role })
  if (error) throw error
}

/** Klient přihlášený jako daný uživatel (publishable klíč + heslo), pro akce „za uživatele“. */
export async function userClient(
  username: string,
  password: string,
): Promise<SupabaseClient<Database>> {
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const c = createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInWithPassword({
    email: `${username}@${SYNTHETIC_EMAIL_DOMAIN}`,
    password,
  })
  if (error) throw error
  return c
}
