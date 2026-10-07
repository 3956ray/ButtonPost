export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) return null
  return { url, publishableKey }
}

export function requireSupabasePublicConfig() {
  const config = getSupabasePublicConfig()
  if (!config) throw new Error('Supabase Auth is not configured.')
  return config
}
