import { initializePaddle } from '@paddle/paddle-js'

export async function createPaddleClient() {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim()
  if (!token) throw new Error('Paddle client token is not configured.')

  const environment =
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.startsWith('test_')
      ? 'sandbox'
      : 'production'

  return initializePaddle({
    token,
    environment,
  })
}
