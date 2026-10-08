import {
  getCloudPublishUsage,
  planEnforcementEnabled,
} from '@/lib/billing/usage'
import { resolvePaddleEnvironment } from '@/lib/paddle/runtime'
import { createMediaUploadTicket } from '@/lib/security/media-ticket'
import {
  consumeRateLimit,
  rateLimitResponse,
} from '@/lib/security/rate-limit'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Sign in is required.' }, { status: 401 })
  }

  try {
    const rateLimit = await consumeRateLimit(supabase, 'media_ticket')
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)
  } catch {
    return Response.json(
      { error: 'Could not verify media upload rate limit.' },
      { status: 503 },
    )
  }

  const environment = resolvePaddleEnvironment(
    new URL(request.url).hostname,
  )

  try {
    const usage = await getCloudPublishUsage(user.id, environment)

    if (
      planEnforcementEnabled() &&
      usage.used >= usage.monthlyLimit
    ) {
      return Response.json(
        {
          error:
            `Monthly cloud publishing limit reached (${usage.used}/${usage.monthlyLimit}). ` +
            'Upgrade your plan or wait for the monthly reset before uploading cloud media.',
          code: 'plan_limit_reached',
          used: usage.used,
          monthlyLimit: usage.monthlyLimit,
          resetAt: usage.resetAt,
        },
        { status: 402 },
      )
    }
  } catch {
    return Response.json(
      { error: 'Could not verify ButtonPost cloud publishing allowance.' },
      { status: 503 },
    )
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    return Response.json(
      {
        error:
          'Server media storage is not configured. Connect a public Vercel Blob store to ButtonPost so BLOB_STORE_ID (OIDC) or BLOB_READ_WRITE_TOKEN is available.',
      },
      { status: 503 },
    )
  }

  const ticket = createMediaUploadTicket(user.id)
  if (!ticket) {
    return Response.json(
      { error: 'Server media ticket signing is not configured.' },
      { status: 503 },
    )
  }

  return Response.json(ticket)
}
