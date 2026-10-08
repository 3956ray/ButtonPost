import { Environment, Paddle } from '@paddle/paddle-node-sdk'
import type { PaddleBrowserEnvironment } from '@/lib/paddle/client'

export function getPaddleEnvironment(): PaddleBrowserEnvironment {
  const environment = process.env.PADDLE_ENV?.trim()

  if (environment !== 'sandbox' && environment !== 'production') {
    throw new Error(
      'PADDLE_ENV must be explicitly set to sandbox or production.',
    )
  }

  return environment
}

export function getPaddleServerConfig() {
  const apiKey = process.env.PADDLE_API_KEY?.trim()
  if (!apiKey) return null

  const environmentName = getPaddleEnvironment()
  const environment =
    environmentName === 'production'
      ? Environment.production
      : Environment.sandbox

  return { apiKey, environment, environmentName }
}

export function createPaddleServerClient() {
  const config = getPaddleServerConfig()
  if (!config) throw new Error('Paddle server is not configured.')

  return new Paddle(config.apiKey, {
    environment: config.environment,
  })
}
