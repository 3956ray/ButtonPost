import { deleteUserCloudMedia } from '@/lib/media/blob-storage'
import { cancelPaddleSubscriptionImmediately } from '@/lib/paddle/subscriptions'
import {
  consumeRateLimit,
  rateLimitResponse,
} from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json(
      { error: 'Cross-origin account deletion is not allowed.' },
      { status: 403 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Sign in is required.' }, { status: 401 })
  }

  try {
    const rateLimit = await consumeRateLimit(supabase, 'account_delete')
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)
  } catch {
    return Response.json(
      { error: 'Could not verify account deletion rate limit.' },
      { status: 503 },
    )
  }

  let body: { confirmation?: unknown }
  try {
    body = (await request.json()) as { confirmation?: unknown }
  } catch {
    return Response.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 },
    )
  }

  if (body.confirmation !== 'DELETE') {
    return Response.json(
      { error: 'Type DELETE to confirm account deletion.' },
      { status: 400 },
    )
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return Response.json(
      { error: 'Account deletion is not configured on this deployment.' },
      { status: 503 },
    )
  }

  try {
    await deleteUserCloudMedia(user.id)
  } catch {
    return Response.json(
      {
        error:
          'Could not delete ButtonPost cloud media. The account was not deleted.',
      },
      { status: 502 },
    )
  }

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('paddle_subscription_id,status,environment')
    .eq('user_id', user.id)

  if (subscriptionError) {
    return Response.json(
      { error: 'Could not read subscription status.' },
      { status: 500 },
    )
  }

  for (const subscription of subscriptions ?? []) {
    if (
      !subscription.paddle_subscription_id ||
      subscription.status === 'canceled'
    ) {
      continue
    }

    if (
      subscription.environment !== 'sandbox' &&
      subscription.environment !== 'production'
    ) {
      return Response.json(
        { error: 'Stored Paddle environment is invalid.' },
        { status: 500 },
      )
    }

    try {
      await cancelPaddleSubscriptionImmediately(
        subscription.paddle_subscription_id,
        subscription.environment,
      )
    } catch {
      return Response.json(
        {
          error:
            'Could not cancel every Paddle subscription. The account was not deleted.',
        },
        { status: 502 },
      )
    }
  }

  try {
    const { error } = await admin.auth.admin.deleteUser(user.id)

    if (error) throw error
  } catch {
    return Response.json(
      {
        error:
          'Could not delete the ButtonPost account. No further deletion steps were performed.',
      },
      { status: 500 },
    )
  }

  return Response.json({ ok: true })
}
