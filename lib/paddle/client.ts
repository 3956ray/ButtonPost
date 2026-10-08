import { initializePaddle } from '@paddle/paddle-js'

export type PaddleBrowserEnvironment = 'sandbox' | 'production'

export async function createPaddleClient(
  environment: PaddleBrowserEnvironment,
) {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim()
  if (!token) {
    throw new Error('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not configured.')
  }

  if (environment === 'sandbox' && !token.startsWith('test_')) {
    throw new Error(
      'Paddle sandbox requires a sandbox client-side token prefixed with test_.',
    )
  }

  if (environment === 'production' && token.startsWith('test_')) {
    throw new Error(
      'Paddle production cannot use a sandbox client-side token.',
    )
  }

  return initializePaddle({
    token,
    environment,
  })
}
