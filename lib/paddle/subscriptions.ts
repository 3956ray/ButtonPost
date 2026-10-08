import 'server-only'
import {
  paddleApiBase,
  paddleApiKey,
  type PaddleEnvironmentName,
} from '@/lib/paddle/runtime'

export async function cancelPaddleSubscriptionImmediately(
  subscriptionId: string,
  environment: PaddleEnvironmentName,
) {
  const apiKey = paddleApiKey(environment)

  const response = await fetch(
    paddleApiBase(environment) +
      '/subscriptions/' +
      encodeURIComponent(subscriptionId) +
      '/cancel',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
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
      'Paddle subscription cancellation failed with status ' +
        response.status +
        '.',
    )
  }
}
