import { NextResponse } from 'next/server'
import { paidPlanForPriceId } from '@/lib/billing/tiers'
import {
  paddleWebhookSecret,
  resolvePaddleEnvironment,
  type PaddleEnvironmentName,
} from '@/lib/paddle/runtime'
import { createPaddleServerClient } from '@/lib/paddle/server'
import { verifyLivePaddleWebhookSource } from '@/lib/paddle/webhook-security'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

type PaddleCustomData = {
  buttonpost_user_id?: unknown
}

function readUserId(customData: unknown) {
  if (!customData || typeof customData !== 'object') return null
  const value = (customData as PaddleCustomData).buttonpost_user_id
  return typeof value === 'string' && value.length > 0 ? value : null
}

function normalizePeriodEnd(data: Record<string, unknown>) {
  const period = data.currentBillingPeriod
  if (!period || typeof period !== 'object') return null
  const endsAt = (period as { endsAt?: unknown }).endsAt
  return typeof endsAt === 'string' ? endsAt : null
}

function cancelAtPeriodEnd(data: Record<string, unknown>) {
  const scheduled = data.scheduledChange
  if (!scheduled || typeof scheduled !== 'object') return false
  const action = (scheduled as { action?: unknown }).action
  return action === 'cancel'
}

function readPriceId(data: Record<string, unknown>) {
  if (!Array.isArray(data.items)) return null

  for (const item of data.items) {
    if (!item || typeof item !== 'object') continue
    const price = (item as { price?: unknown }).price
    if (!price || typeof price !== 'object') continue
    const id = (price as { id?: unknown }).id
    if (typeof id === 'string' && id) return id
  }

  return null
}

async function syncSubscription(
  data: Record<string, unknown>,
  environment: PaddleEnvironmentName,
) {
  const id = typeof data.id === 'string' ? data.id : null
  const customerId =
    typeof data.customerId === 'string' ? data.customerId : null
  const status = typeof data.status === 'string' ? data.status : 'inactive'

  if (!id) return

  const admin = createAdminClient()
  let userId = readUserId(data.customData)
  let existingPlan: string | null = null

  const { data: existing, error: lookupError } = await admin
    .from('subscriptions')
    .select('user_id,plan')
    .eq('paddle_subscription_id', id)
    .eq('environment', environment)
    .maybeSingle()

  if (lookupError) throw lookupError

  if (!userId) {
    userId = existing?.user_id ?? null
  }
  existingPlan = existing?.plan ?? null

  if (!userId) return

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile) return

  const priceId = readPriceId(data)
  const tier = priceId
    ? paidPlanForPriceId(priceId, environment)
    : null
  const active = ['active', 'trialing', 'past_due'].includes(status)
  const plan = active ? tier ?? existingPlan ?? 'free' : 'free'

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      environment,
      provider: 'paddle',
      paddle_customer_id: customerId,
      paddle_subscription_id: id,
      status,
      plan,
      current_period_end: normalizePeriodEnd(data),
      cancel_at_period_end: cancelAtPeriodEnd(data),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,environment' },
  )

  if (error) throw error
}

export async function POST(request: Request) {
  const environment = resolvePaddleEnvironment(
    new URL(request.url).hostname,
  )

  if (environment === 'production') {
    try {
      const source = await verifyLivePaddleWebhookSource(request)

      if (!source.allowed) {
        console.warn('[paddle-webhook] rejected live source', {
          environment,
          sourceIp: source.ip,
          reason: source.reason,
        })

        return NextResponse.json(
          { error: 'Webhook source is not allowlisted.' },
          { status: 403 },
        )
      }
    } catch (cause) {
      console.error('[paddle-webhook] live allowlist unavailable', {
        errorName: cause instanceof Error ? cause.name : 'UnknownError',
        errorMessage:
          cause instanceof Error
            ? cause.message.slice(0, 240)
            : 'Unknown allowlist failure',
      })

      return NextResponse.json(
        { error: 'Webhook allowlist is temporarily unavailable.' },
        { status: 503 },
      )
    }
  }

  const signature = request.headers.get('paddle-signature') ?? ''

  let webhookSecret: string
  try {
    webhookSecret = paddleWebhookSecret(environment)
  } catch {
    return NextResponse.json(
      { error: 'Paddle webhook is not configured.' },
      { status: 503 },
    )
  }

  if (!signature) {
    return NextResponse.json(
      { error: 'Paddle signature is required.' },
      { status: 400 },
    )
  }

  const rawBody = await request.text()

  console.info('[paddle-webhook] received', {
    environment,
    hasSignature: Boolean(signature),
    bodyLength: rawBody.length,
  })

  try {
    const paddle = createPaddleServerClient(environment)
    const event = await paddle.webhooks.unmarshal(
      rawBody,
      webhookSecret,
      signature,
    )

    console.info('[paddle-webhook] verified', {
      environment,
      eventId: event.eventId,
      eventType: event.eventType,
    })

    const admin = createAdminClient()

    const { data: existing, error: existingError } = await admin
      .from('paddle_webhook_events')
      .select('event_id')
      .eq('event_id', event.eventId)
      .eq('environment', environment)
      .maybeSingle()

    if (existingError) throw existingError
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true })
    }

    if (
      event.eventType === 'subscription.created' ||
      event.eventType === 'subscription.updated' ||
      event.eventType === 'subscription.past_due' ||
      event.eventType === 'subscription.canceled' ||
      event.eventType === 'subscription.activated' ||
      event.eventType === 'subscription.trialing' ||
      event.eventType === 'subscription.paused' ||
      event.eventType === 'subscription.resumed'
    ) {
      await syncSubscription(
        event.data as unknown as Record<string, unknown>,
        environment,
      )
    }

    const { error: auditError } = await admin
      .from('paddle_webhook_events')
      .insert({
        event_id: event.eventId,
        environment,
        event_type: event.eventType,
        occurred_at: event.occurredAt,
      })

    if (auditError) throw auditError

    console.info('[paddle-webhook] processed', {
      environment,
      eventId: event.eventId,
      eventType: event.eventType,
    })

    return NextResponse.json({ ok: true })
  } catch (cause) {
    console.error('[paddle-webhook] failed', {
      environment,
      errorName: cause instanceof Error ? cause.name : 'UnknownError',
      errorMessage:
        cause instanceof Error
          ? cause.message.slice(0, 300)
          : 'Unknown webhook failure',
    })

    return NextResponse.json(
      { error: 'Invalid webhook.' },
      { status: 400 },
    )
  }
}
