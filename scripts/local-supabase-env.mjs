// Zapíše apps/web/.env.local s hodnotami lokální Supabase (supabase start), aby build a e2e testy
// běžely proti lokální databázi, ne proti produkci. Použití: pnpm db:env (lokálně i v CI).
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
const env = Object.fromEntries(
  out
    .split('\n')
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
)
for (const key of ['API_URL', 'PUBLISHABLE_KEY', 'SECRET_KEY']) {
  if (!env[key]) throw new Error(`supabase status nevrátil ${key} (běží lokální Supabase?)`)
}
const file = join(import.meta.dirname, '../apps/web/.env.local')
writeFileSync(
  file,
  [
    '# Vygenerováno scripts/local-supabase-env.mjs: lokální Supabase (necommitovat).',
    `NEXT_PUBLIC_SUPABASE_URL=${env.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${env.PUBLISHABLE_KEY}`,
    `SUPABASE_SECRET_KEY=${env.SECRET_KEY}`,
    '',
  ].join('\n'),
)
console.log(`Zapsáno ${file}`)
