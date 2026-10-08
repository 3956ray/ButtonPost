import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RateLimitScope =
  | 'publish'
  | 'media_ticket'
  | 'dev_connect'
  | 'x_oauth_start'
  | 'billing_portal'
  | 'account_delete'

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: string
}

export async function consumeRateLimit(
  supabase: SupabaseClient,
  scope: RateLimitScope,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc(
    'consume_buttonpost_rate_limit',
    { rate_scope: scope },
  )

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (
    !row ||
    typeof row.allowed !== 'boolean' ||
    typeof row.remaining !== 'number' ||
    typeof row.reset_at !== 'string'
  ) {
    throw new Error('Rate limit response was invalid.')
  }

  return {
    allowed: row.allowed,
    remaining: row.remaining,
    resetAt: row.reset_at,
  }
}

export function rateLimitResponse(result: RateLimitResult) {
  const retryAfter = Math.max(
    1,
    Math.ceil((Date.parse(result.resetAt) - Date.now()) / 1000),
  )

  return Response.json(
    {
      error: 'Too many requests. Try again shortly.',
      code: 'rate_limited',
      resetAt: result.resetAt,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': result.resetAt,
      },
    },
  )
}
