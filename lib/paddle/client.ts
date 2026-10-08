import { initializePaddle } from '@paddle/paddle-js'
import type { PaddleEnvironmentName } from '@/lib/paddle/runtime'

export type PaddleBrowserEnvironment = PaddleEnvironmentName

export async function createPaddleClient(
  environment: PaddleBrowserEnvironment,
  token: string,
  paddleCustomerId?: string | null,
) {
  if (!token) {
    throw new Error('Paddle client-side token is not configured.')
  }

  if (environment === 'sandbox' && !token.startsWith('test_')) {
    throw new Error(
      'Paddle sandbox requires a sandbox client-side token prefixed with test_.',
    )
  }

  if (environment === 'production' && !token.startsWith('live_')) {
    throw new Error(
      'Paddle production requires a live client-side token prefixed with live_.',
    )
  }

  if (environment === 'production') {
    return initializePaddle({
      token,
      pwCustomer: paddleCustomerId
        ? { id: paddleCustomerId }
        : {},
    })
  }

  return initializePaddle({
    token,
    environment: 'sandbox',
  })
}
