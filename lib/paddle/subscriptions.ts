import 'server-only'
import { getPaddleEnvironment } from '@/lib/paddle/server'

function apiBase() {
  return getPaddleEnvironment() === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com'
}

export async function cancelPaddleSubscriptionImmediately(
  subscriptionId: string,
) {
  const apiKey = process.env.PADDLE_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Paddle API access is not configured.')
  }

  const response = await fetch(
    `${apiBase()}/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        effective_from: 'immediately',
      }),
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    throw new Error(
      `Paddle subscription cancellation failed with status ${response.status}.`,
    )
  }
}
