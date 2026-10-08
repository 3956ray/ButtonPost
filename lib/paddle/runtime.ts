import 'server-only'

export type PaddleEnvironmentName = 'sandbox' | 'production'
export type PaddleBillingCycle = 'month' | 'year'
export type PaddlePlanKey = 'starter' | 'pro' | 'advanced'

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error('Missing required Paddle environment variable: ' + name)
  }
  return value
}

function normalizedHost(hostname: string | null | undefined) {
  return hostname?.trim().toLowerCase().split(':')[0] ?? ''
}

export function getDefaultPaddleEnvironment(): PaddleEnvironmentName {
  const environment = process.env.PADDLE_ENV?.trim()

  if (environment !== 'sandbox' && environment !== 'production') {
    throw new Error(
      'PADDLE_ENV must be explicitly set to sandbox or production.',
    )
  }

  return environment
}

export function resolvePaddleEnvironment(
  hostname?: string | null,
): PaddleEnvironmentName {
  const liveStagingHost = normalizedHost(
    process.env.PADDLE_LIVE_STAGING_HOST,
  )

  if (
    liveStagingHost &&
    normalizedHost(hostname) === liveStagingHost
  ) {
    return 'production'
  }

  return getDefaultPaddleEnvironment()
}

export function paddleApiBase(environment: PaddleEnvironmentName) {
  return environment === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com'
}

export function paddleApiKey(environment: PaddleEnvironmentName) {
  return requiredEnv(
    environment === 'production'
      ? 'PADDLE_LIVE_API_KEY'
      : 'PADDLE_API_KEY',
  )
}

export function paddleClientToken(environment: PaddleEnvironmentName) {
  return requiredEnv(
    environment === 'production'
      ? 'PADDLE_LIVE_CLIENT_TOKEN'
      : 'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN',
  )
}

export function paddleWebhookSecret(environment: PaddleEnvironmentName) {
  return requiredEnv(
    environment === 'production'
      ? 'PADDLE_LIVE_WEBHOOK_SECRET'
      : 'PADDLE_WEBHOOK_SECRET',
  )
}

function priceEnvName(
  environment: PaddleEnvironmentName,
  plan: PaddlePlanKey,
  cycle: PaddleBillingCycle,
) {
  const planPart = plan.toUpperCase()
  const cyclePart = cycle === 'month' ? 'MONTH' : 'YEAR'

  if (environment === 'production') {
    return 'PADDLE_LIVE_' + planPart + '_' + cyclePart + '_PRICE_ID'
  }

  return 'NEXT_PUBLIC_PADDLE_' + planPart + '_' + cyclePart + '_PRICE_ID'
}

export function paddlePriceId(
  environment: PaddleEnvironmentName,
  plan: PaddlePlanKey,
  cycle: PaddleBillingCycle,
) {
  return requiredEnv(priceEnvName(environment, plan, cycle))
}
