import { NextResponse } from 'next/server'
import { createPaddleServerClient } from '@/lib/paddle/server'
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

async function syncSubscription(data: Record<string, unknown>) {
  const userId = readUserId(data.customData)
  if (!userId) return

  const id = typeof data.id === 'string' ? data.id : null
  const customerId =
    typeof data.customerId === 'string' ? data.customerId : null
  const status = typeof data.status === 'string' ? data.status : 'inactive'

  if (!id) return

  const admin = createAdminClient()
  const plan = ['active', 'trialing', 'past_due', 'paused'].includes(status)
    ? 'pro'
    : 'free'

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      provider: 'paddle',
      paddle_customer_id: customerId,
      paddle_subscription_id: id,
      status,
      plan,
      current_period_end: normalizePeriodEnd(data),
      cancel_at_period_end: cancelAtPeriodEnd(data),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) throw error
}

export async function POST(request: Request) {
  const signature = request.headers.get('paddle-signature') ?? ''
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET?.trim()

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: 'Paddle webhook is not configured.' },
      { status: 503 },
    )
  }

  const rawBody = await request.text()

  try {
    const paddle = createPaddleServerClient()
    const event = await paddle.webhooks.unmarshal(
      rawBody,
      webhookSecret,
      signature,
    )

    const admin = createAdminClient()

    const { data: existing, error: existingError } = await admin
      .schema('private')
      .from('paddle_webhook_events')
      .select('event_id')
      .eq('event_id', event.eventId)
      .maybeSingle()

    if (existingError) throw existingError
    if (existing) return NextResponse.json({ ok: true, duplicate: true })

    if (
      event.eventType === 'subscription.created' ||
      event.eventType === 'subscription.updated' ||
      event.eventType === 'subscription.canceled' ||
      event.eventType === 'subscription.activated' ||
      event.eventType === 'subscription.trialing' ||
      event.eventType === 'subscription.paused' ||
      event.eventType === 'subscription.resumed'
    ) {
      await syncSubscription(event.data as unknown as Record<string, unknown>)
    }

    const { error: auditError } = await admin
      .schema('private')
      .from('paddle_webhook_events')
      .insert({
        event_id: event.eventId,
        event_type: event.eventType,
        occurred_at: event.occurredAt,
      })

    if (auditError) throw auditError

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid webhook.' }, { status: 400 })
  }
}
