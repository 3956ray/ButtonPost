import { deleteConnection, saveConnection } from '@/lib/connections/store'
import {
  consumeRateLimit,
  rateLimitResponse,
} from '@/lib/security/rate-limit'
import { createClient } from '@/lib/supabase/server'

type DevUser = {
  id?: number
  username?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Sign in is required.' }, { status: 401 })
  }

  try {
    const rateLimit = await consumeRateLimit(supabase, 'dev_connect')
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)
  } catch {
    return Response.json(
      { error: 'Could not verify DEV connection rate limit.' },
      { status: 503 },
    )
  }

  let body: { apiKey?: unknown }
  try {
    body = (await request.json()) as { apiKey?: unknown }
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  if (apiKey.length < 8 || apiKey.length > 512) {
    return Response.json({ error: 'Enter a valid DEV API key.' }, { status: 400 })
  }

  try {
    const response = await fetch('https://dev.to/api/users/me', {
      headers: {
        'api-key': apiKey,
        Accept: 'application/vnd.forem.api-v1+json',
      },
      cache: 'no-store',
    })

    const profile = (await response.json().catch(() => ({}))) as DevUser

    if (!response.ok || !profile.id || !profile.username) {
      return Response.json(
        { error: 'DEV rejected that API key.' },
        { status: 400 },
      )
    }

    await saveConnection(
      supabase,
      user.id,
      'devto',
      { kind: 'devto-api-key', apiKey },
      {
        externalAccountId: String(profile.id),
        externalUsername: profile.username,
      },
    )

    return Response.json({
      ok: true,
      connection: {
        platform: 'devto',
        status: 'connected',
        externalUsername: profile.username,
      },
    })
  } catch {
    return Response.json(
      { error: 'Could not verify the DEV API key.' },
      { status: 502 },
    )
  }
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Sign in is required.' }, { status: 401 })
  }

  try {
    await deleteConnection(supabase, user.id, 'devto')
    return Response.json({ ok: true })
  } catch {
    return Response.json(
      { error: 'Could not disconnect DEV.' },
      { status: 500 },
    )
  }
}
