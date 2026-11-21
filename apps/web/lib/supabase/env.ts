/** Veřejná konfigurace Supabase (bezpečná pro prohlížeč; přístup hlídá RLS). */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error('Chybí NEXT_PUBLIC_SUPABASE_URL nebo NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  }
  return { url, key }
}
