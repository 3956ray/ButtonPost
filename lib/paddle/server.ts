import { Environment, Paddle } from '@paddle/paddle-node-sdk'
import {
  paddleApiKey,
  type PaddleEnvironmentName,
} from '@/lib/paddle/runtime'

export function getPaddleServerConfig(
  environment: PaddleEnvironmentName,
) {
  const apiKey = paddleApiKey(environment)
  const sdkEnvironment =
    environment === 'production'
      ? Environment.production
      : Environment.sandbox

  return {
    apiKey,
    environment: sdkEnvironment,
    environmentName: environment,
  }
}

export function createPaddleServerClient(
  environment: PaddleEnvironmentName,
) {
  const config = getPaddleServerConfig(environment)

  return new Paddle(config.apiKey, {
    environment: config.environment,
  })
}
