import { Environment, Paddle } from '@paddle/paddle-node-sdk'

export function getPaddleServerConfig() {
  const apiKey = process.env.PADDLE_API_KEY?.trim()
  const environment = process.env.PADDLE_ENV === 'production'
    ? Environment.production
    : Environment.sandbox

  if (!apiKey) return null

  return { apiKey, environment }
}

export function createPaddleServerClient() {
  const config = getPaddleServerConfig()
  if (!config) throw new Error('Paddle server is not configured.')

  return new Paddle(config.apiKey, {
    environment: config.environment,
  })
}
