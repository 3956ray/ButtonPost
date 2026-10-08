import {
  PLAN_ENTITLEMENTS,
  type PaidPlan,
} from '@/lib/billing/plans'

export type { PaidPlan } from '@/lib/billing/plans'

export interface Tier {
  name: 'Starter' | 'Pro' | 'Advanced'
  description: string
  features: string[]
  priceId: {
    month: string
    year: string
  }
}

function requiredPublicEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Missing required Paddle pricing environment variable: ${name}`,
    )
  }
  return value
}

function allowance(plan: PaidPlan) {
  return PLAN_ENTITLEMENTS[plan].cloudPublishBatchesPerMonth
}

export function getPricingTiers(): Tier[] {
  return [
    {
      name: 'Starter',
      description: 'For individual creators publishing a few times each week.',
      features: [
        `${allowance('starter')} cloud publish batches / month`,
        'Unlimited Local Runner publishing',
        'X + DEV cloud connections',
        'Encrypted per-user credentials',
      ],
      priceId: {
        month: requiredPublicEnv('NEXT_PUBLIC_PADDLE_STARTER_MONTH_PRICE_ID'),
        year: requiredPublicEnv('NEXT_PUBLIC_PADDLE_STARTER_YEAR_PRICE_ID'),
      },
    },
    {
      name: 'Pro',
      description: 'For creators who publish consistently across platforms.',
      features: [
        `${allowance('pro')} cloud publish batches / month`,
        'Everything in Starter',
        'Priority email support',
        'Early access to new integrations',
      ],
      priceId: {
        month: requiredPublicEnv('NEXT_PUBLIC_PADDLE_PRO_MONTH_PRICE_ID'),
        year: requiredPublicEnv('NEXT_PUBLIC_PADDLE_PRO_YEAR_PRICE_ID'),
      },
    },
    {
      name: 'Advanced',
      description: 'For power users with high-frequency publishing workflows.',
      features: [
        `${allowance('advanced')} cloud publish batches / month`,
        'Everything in Pro',
        'Highest cloud publishing allowance',
        'Priority issue handling',
      ],
      priceId: {
        month: requiredPublicEnv('NEXT_PUBLIC_PADDLE_ADVANCED_MONTH_PRICE_ID'),
        year: requiredPublicEnv('NEXT_PUBLIC_PADDLE_ADVANCED_YEAR_PRICE_ID'),
      },
    },
  ]
}

export function paidPlanForPriceId(priceId: string): PaidPlan | null {
  for (const tier of getPricingTiers()) {
    if (tier.priceId.month === priceId || tier.priceId.year === priceId) {
      return tier.name.toLowerCase() as PaidPlan
    }
  }

  return null
}
