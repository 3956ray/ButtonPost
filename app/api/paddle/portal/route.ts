import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type PaddlePortalResponse = {
  data?: {
    urls?: {
      general?: {
        overview?: string
      }
    }
  }
}

function paddleApiBase() {
  return process.env.PADDLE_ENV === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com'
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Sign in is required.' }, { status: 401 })
  }

  const apiKey = process.env.PADDLE_API_KEY?.trim()
  if (!apiKey) {
    return Response.json(
      { error: 'Paddle billing is not configured.' },
      { status: 503 },
    )
  }

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('paddle_customer_id,paddle_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return Response.json(
      { error: 'Could not read ButtonPost billing state.' },
      { status: 500 },
    )
  }

  if (!subscription?.paddle_customer_id) {
    return Response.json(
      { error: 'No Paddle customer is linked to this account yet.' },
      { status: 404 },
    )
  }

  const response = await fetch(
    \`\${paddleApiBase()}/customers/\${encodeURIComponent(
      subscription.paddle_customer_id,
    )}/portal-sessions\`,
    {
      method: 'POST',
      headers: {
        Authorization: \`Bearer \${apiKey}\`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(
        subscription.paddle_subscription_id
          ? { subscription_ids: [subscription.paddle_subscription_id] }
          : {},
      ),
      cache: 'no-store',
    },
  )

  const body = (await response.json().catch(() => ({}))) as PaddlePortalResponse
  const url = body.data?.urls?.general?.overview

  if (!response.ok || !url) {
    return Response.json(
      { error: 'Paddle could not create a customer portal session.' },
      { status: 502 },
    )
  }

  return Response.json({ url })
}
