import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PaddleEntity<T> = { data: T }
type PaddleList<T> = { data: T[] }

type Price = {
  id: string
  product_id: string
  name: string | null
  description: string
  status: string
  unit_price: { amount: string; currency_code: string }
  unit_price_overrides?: unknown[]
  billing_cycle: { interval: 'month' | 'year'; frequency: number } | null
  trial_period?: unknown
  tax_mode?: string
}

type Product = { id: string; name: string; status: string }
type ClientToken = { id: string; token: string; name: string; status: string }
type NotificationSetting = {
  id: string
  destination: string
  active: boolean
  endpoint_secret_key?: string
}
type Discount = {
  id: string
  status: string
  description: string
  enabled_for_checkout: boolean
  code: string | null
  type: 'flat' | 'flat_per_seat' | 'percentage'
  amount: string
  currency_code: string | null
  recur: boolean
  maximum_recurring_intervals: number | null
  usage_limit: number | null
  restrict_to: string[] | null
  expires_at: string | null
  custom_data: Record<string, unknown> | null
}

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error('Missing migration environment variable: ' + name)
  return value
}

async function paddle<T>(
  base: string,
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(base + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + apiKey,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      'Paddle ' + response.status + ' ' + path + ': ' +
      JSON.stringify(body).slice(0, 800),
    )
  }
  return body as T
}

const sandboxPriceEnvs = {
  starter: {
    month: 'NEXT_PUBLIC_PADDLE_STARTER_MONTH_PRICE_ID',
    year: 'NEXT_PUBLIC_PADDLE_STARTER_YEAR_PRICE_ID',
  },
  pro: {
    month: 'NEXT_PUBLIC_PADDLE_PRO_MONTH_PRICE_ID',
    year: 'NEXT_PUBLIC_PADDLE_PRO_YEAR_PRICE_ID',
  },
  advanced: {
    month: 'NEXT_PUBLIC_PADDLE_ADVANCED_MONTH_PRICE_ID',
    year: 'NEXT_PUBLIC_PADDLE_ADVANCED_YEAR_PRICE_ID',
  },
} as const

const productCopy = {
  starter: {
    name: 'ButtonPost Starter',
    description:
      'For individual creators publishing a few times each week with 50 cloud publish batches per month.',
  },
  pro: {
    name: 'ButtonPost Pro',
    description:
      'For creators publishing consistently across platforms with 200 cloud publish batches per month.',
  },
  advanced: {
    name: 'ButtonPost Advanced',
    description:
      'For power users with high-frequency publishing workflows and 600 cloud publish batches per month.',
  },
} as const

function priceName(
  plan: keyof typeof productCopy,
  cycle: 'month' | 'year',
) {
  const title = plan.charAt(0).toUpperCase() + plan.slice(1)
  return title + ' ' + (cycle === 'month' ? 'Monthly' : 'Yearly')
}

function isJunkDiscount(discount: Discount) {
  const text = (discount.description + ' ' + (discount.code || '')).toLowerCase()
  return /\b(test|junk|dummy|sandbox|example|demo)\b/.test(text)
}

function seal(value: unknown, secret: string) {
  const key = createHash('sha256').update(secret).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

export async function GET(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !==
      'phase-6g-paddle-live-staging' ||
    request.nextUrl.hostname !== 'staging.buttonpost.app'
  ) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const migrationSecret = required('PADDLE_MIGRATION_TOKEN')
  const sandboxKey = required('PADDLE_API_KEY')
  const liveKey = required('PADDLE_LIVE_API_KEY')
  const sandboxBase = 'https://sandbox-api.paddle.com'
  const liveBase = 'https://api.paddle.com'

  const sandboxPrices = new Map<string, Price>()
  const priceMap: Record<string, string> = {}
  const livePriceEnvValues: Record<string, string> = {}

  for (const [plan, cycles] of Object.entries(sandboxPriceEnvs)) {
    for (const [cycle, envName] of Object.entries(cycles)) {
      const oldId = required(envName)
      const source = (
        await paddle<PaddleEntity<Price>>(
          sandboxBase,
          sandboxKey,
          '/prices/' + encodeURIComponent(oldId),
        )
      ).data

      if (
        source.status !== 'active' ||
        !source.billing_cycle ||
        source.billing_cycle.interval !== cycle
      ) {
        throw new Error('Sandbox price mismatch for ' + plan + ':' + cycle)
      }

      sandboxPrices.set(plan + ':' + cycle, source)
    }
  }

  const liveProducts = (
    await paddle<PaddleList<Product>>(
      liveBase,
      liveKey,
      '/products?per_page=200',
    )
  ).data

  const productIds: Record<string, string> = {}

  for (const [plan, copy] of Object.entries(productCopy)) {
    let product = liveProducts.find(
      (item) => item.status === 'active' && item.name === copy.name,
    )

    if (!product) {
      product = (
        await paddle<PaddleEntity<Product>>(
          liveBase,
          liveKey,
          '/products',
          {
            method: 'POST',
            body: JSON.stringify({
              name: copy.name,
              description: copy.description,
              tax_category: 'saas',
              custom_data: { buttonpost_plan: plan },
            }),
          },
        )
      ).data
      liveProducts.push(product)
    }

    productIds[plan] = product.id
  }

  for (const [plan, cycles] of Object.entries(sandboxPriceEnvs)) {
    const productId = productIds[plan]
    const livePrices = (
      await paddle<PaddleList<Price>>(
        liveBase,
        liveKey,
        '/prices?per_page=200&product_id=' + encodeURIComponent(productId),
      )
    ).data

    for (const cycle of Object.keys(cycles) as Array<'month' | 'year'>) {
      const source = sandboxPrices.get(plan + ':' + cycle)
      if (!source) throw new Error('Missing sandbox source price.')

      const desiredName = priceName(
        plan as keyof typeof productCopy,
        cycle,
      )

      let livePrice = livePrices.find(
        (item) =>
          item.status === 'active' &&
          item.name === desiredName &&
          item.billing_cycle?.interval === cycle &&
          item.unit_price.amount === source.unit_price.amount &&
          item.unit_price.currency_code === source.unit_price.currency_code,
      )

      if (!livePrice) {
        livePrice = (
          await paddle<PaddleEntity<Price>>(
            liveBase,
            liveKey,
            '/prices',
            {
              method: 'POST',
              body: JSON.stringify({
                product_id: productId,
                name: desiredName,
                description:
                  'ButtonPost ' + plan + ' — ' +
                  (cycle === 'month' ? 'monthly' : 'yearly'),
                unit_price: source.unit_price,
                ...(Array.isArray(source.unit_price_overrides) &&
                source.unit_price_overrides.length
                  ? { unit_price_overrides: source.unit_price_overrides }
                  : {}),
                billing_cycle: source.billing_cycle,
                trial_period: source.trial_period ?? null,
                tax_mode: source.tax_mode || 'account_setting',
                quantity: { minimum: 1, maximum: 1 },
                custom_data: {
                  buttonpost_plan: plan,
                  buttonpost_cycle: cycle,
                  migrated_from_sandbox_price_id: source.id,
                },
              }),
            },
          )
        ).data
      }

      priceMap[source.id] = livePrice.id
      const envKey =
        'PADDLE_LIVE_' + plan.toUpperCase() + '_' +
        (cycle === 'month' ? 'MONTH' : 'YEAR') + '_PRICE_ID'
      livePriceEnvValues[envKey] = livePrice.id
    }
  }

  const sandboxDiscounts = (
    await paddle<PaddleList<Discount>>(
      sandboxBase,
      sandboxKey,
      '/discounts?per_page=200',
    )
  ).data

  const eligible = sandboxDiscounts.filter(
    (discount) => discount.status === 'active' && !isJunkDiscount(discount),
  )

  const discountMap: Record<string, string> = {}

  if (eligible.length) {
    const liveDiscounts = (
      await paddle<PaddleList<Discount>>(
        liveBase,
        liveKey,
        '/discounts?per_page=200',
      )
    ).data

    for (const source of eligible) {
      let target = liveDiscounts.find(
        (item) =>
          item.status === 'active' &&
          item.description === source.description &&
          item.code === source.code,
      )

      if (!target) {
        target = (
          await paddle<PaddleEntity<Discount>>(
            liveBase,
            liveKey,
            '/discounts',
            {
              method: 'POST',
              body: JSON.stringify({
                description: source.description,
                enabled_for_checkout: source.enabled_for_checkout,
                code: source.code,
                type: source.type,
                amount: source.amount,
                currency_code: source.currency_code,
                recur: source.recur,
                maximum_recurring_intervals:
                  source.maximum_recurring_intervals,
                usage_limit: source.usage_limit,
                restrict_to:
                  source.restrict_to?.map((id) => priceMap[id] || id) || null,
                expires_at: source.expires_at,
                custom_data: source.custom_data,
              }),
            },
          )
        ).data
      }

      discountMap[source.id] = target.id
    }
  }

  const tokens = (
    await paddle<PaddleList<ClientToken>>(
      liveBase,
      liveKey,
      '/client-tokens?per_page=200',
    )
  ).data

  let token = tokens.find(
    (item) => item.status === 'active' && item.name === 'ButtonPost Live',
  )

  if (!token) {
    token = (
      await paddle<PaddleEntity<ClientToken>>(
        liveBase,
        liveKey,
        '/client-tokens',
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'ButtonPost Live',
            description:
              'Paddle.js token for buttonpost.app and staging.buttonpost.app',
          }),
        },
      )
    ).data
  }

  const destination = 'https://staging.buttonpost.app/api/paddle/webhook'
  const settings = (
    await paddle<PaddleList<NotificationSetting>>(
      liveBase,
      liveKey,
      '/notification-settings?per_page=200',
    )
  ).data

  let webhook = settings.find(
    (item) => item.active && item.destination === destination,
  )

  if (!webhook) {
    webhook = (
      await paddle<PaddleEntity<NotificationSetting>>(
        liveBase,
        liveKey,
        '/notification-settings',
        {
          method: 'POST',
          body: JSON.stringify({
            description: 'ButtonPost Live staging subscription sync',
            type: 'url',
            destination,
            api_version: 1,
            traffic_source: 'all',
            include_sensitive_fields: false,
            subscribed_events: [
              'subscription.created',
              'subscription.activated',
              'subscription.trialing',
              'subscription.updated',
              'subscription.past_due',
              'subscription.paused',
              'subscription.resumed',
              'subscription.canceled',
              'transaction.completed',
            ],
          }),
        },
      )
    ).data
  }

  if (!webhook.endpoint_secret_key) {
    webhook = (
      await paddle<PaddleEntity<NotificationSetting>>(
        liveBase,
        liveKey,
        '/notification-settings/' + encodeURIComponent(webhook.id),
      )
    ).data
  }

  const result = {
    ok: true,
    liveProducts: productIds,
    sandboxToLivePriceIds: priceMap,
    livePriceEnvValues,
    migratedDiscounts: discountMap,
    skippedSandboxDiscountCount: sandboxDiscounts.length - eligible.length,
    liveClientToken: { id: token.id, token: token.token },
    liveWebhook: {
      id: webhook.id,
      endpointSecret: webhook.endpoint_secret_key || null,
      destination: webhook.destination,
    },
  }

  return NextResponse.json({
    ok: true,
    sealed: seal(result, migrationSecret),
  })
}
