import { loadCredential } from '@/lib/connections/store'
import {
  planEnforcementEnabled,
  releaseCloudPublish,
  reserveCloudPublish,
} from '@/lib/billing/usage'
import { publishEverywhere } from '@/lib/publishers/publish-everywhere'
import {
  consumeRateLimit,
  rateLimitResponse,
} from '@/lib/security/rate-limit'
import {
  PLATFORM_IDS,
  type PlatformCredentialMap,
  type PlatformId,
} from '@/lib/publishers/types'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type PublishRequest = {
  title?: unknown
  content?: unknown
  platforms?: unknown
  media?: unknown
}

function isSourceMedia(
  value: unknown,
): value is { url: string; name?: string; contentType?: string } {
  if (!value || typeof value !== 'object') return false
  const media = value as Record<string, unknown>

  if (typeof media.url !== 'string') return false

  try {
    const url = new URL(media.url)
    if (url.protocol !== 'https:') return false
    if (!url.hostname.endsWith('.blob.vercel-storage.com')) return false
  } catch {
    return false
  }

  return (
    (media.name === undefined || typeof media.name === 'string') &&
    (media.contentType === undefined ||
      typeof media.contentType === 'string')
  )
}

function isPlatformId(value: unknown): value is PlatformId {
  return (
    typeof value === 'string' &&
    (PLATFORM_IDS as readonly string[]).includes(value)
  )
}

function quotaError(
  used: number,
  monthlyLimit: number,
  resetAt: string,
) {
  return Response.json(
    {
      error:
        `Monthly cloud publishing limit reached (${used}/${monthlyLimit}). ` +
        'Local Runner publishing remains unlimited. Upgrade your plan or wait for the monthly reset.',
      code: 'plan_limit_reached',
      used,
      monthlyLimit,
      resetAt,
    },
    { status: 402 },
  )
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
    const rateLimit = await consumeRateLimit(supabase, 'publish')
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)
  } catch {
    return Response.json(
      { error: 'Could not verify publish rate limit.' },
      { status: 503 },
    )
  }

  let body: PublishRequest
  try {
    body = (await request.json()) as PublishRequest
  } catch {
    return Response.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 },
    )
  }

  if (typeof body.title !== 'string' || !body.title.trim()) {
    return Response.json({ error: 'Title is required.' }, { status: 400 })
  }
  if (typeof body.content !== 'string' || !body.content.trim()) {
    return Response.json({ error: 'Content is required.' }, { status: 400 })
  }
  if (
    !Array.isArray(body.platforms) ||
    body.platforms.length === 0 ||
    !body.platforms.every(isPlatformId)
  ) {
    return Response.json(
      { error: 'Choose at least one supported platform.' },
      { status: 400 },
    )
  }

  const media =
    body.media === undefined
      ? []
      : Array.isArray(body.media) &&
          body.media.length <= 9 &&
          body.media.every(isSourceMedia)
        ? body.media
        : null

  if (media === null) {
    return Response.json(
      {
        error:
          'Media must be an array of up to 9 ButtonPost Vercel Blob image URLs.',
      },
      { status: 400 },
    )
  }

  let reservation
  try {
    reservation = await reserveCloudPublish(user.id)
  } catch {
    return Response.json(
      { error: 'Could not verify ButtonPost cloud publishing allowance.' },
      { status: 503 },
    )
  }

  if (!reservation.allowed && planEnforcementEnabled()) {
    return quotaError(
      reservation.used,
      reservation.monthlyLimit,
      reservation.resetAt,
    )
  }

  const credentials: PlatformCredentialMap = {}

  try {
    for (const platform of [...new Set(body.platforms)]) {
      const credential = await loadCredential(
        supabase,
        user.id,
        platform,
      )
      if (credential) credentials[platform] = credential
    }

    const results = await publishEverywhere(
      {
        title: body.title.trim(),
        content: body.content,
        media,
      },
      body.platforms,
      credentials,
    )

    const counted = results.some(
      (result) =>
        result.status === 'published' || result.status === 'draft',
    )

    if (reservation.usageId && !counted) {
      try {
        await releaseCloudPublish(user.id, reservation.usageId)
      } catch {
        // Publishing results are more important than a best-effort quota
        // rollback. A later support review can reconcile an isolated row.
      }
    }

    return Response.json({
      results,
      usage: {
        plan: reservation.plan,
        used:
          reservation.usageId && !counted
            ? Math.max(reservation.used - 1, 0)
            : reservation.used,
        monthlyLimit: reservation.monthlyLimit,
        resetAt: reservation.resetAt,
      },
    })
  } catch {
    if (reservation.usageId) {
      try {
        await releaseCloudPublish(user.id, reservation.usageId)
      } catch {
        // Best-effort rollback only.
      }
    }

    return Response.json(
      { error: 'ButtonPost could not complete the cloud publish request.' },
      { status: 500 },
    )
  }
}
