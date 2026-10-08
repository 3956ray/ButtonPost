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

export function getPricingTiers(): Tier[] {
  return [
    {
      name: 'Starter',
      description: 'For individual creators getting their cross-platform workflow online.',
      features: [
        'X + DEV cloud publishing',
        'Local Runner destinations',
        'Per-user encrypted connections',
      ],
      priceId: {
        month: requiredPublicEnv('NEXT_PUBLIC_PADDLE_STARTER_MONTH_PRICE_ID'),
        year: requiredPublicEnv('NEXT_PUBLIC_PADDLE_STARTER_YEAR_PRICE_ID'),
      },
    },
    {
      name: 'Pro',
      description: 'For creators who publish consistently across multiple destinations.',
      features: [
        'Everything in Starter',
        'Built for regular multi-platform publishing',
        'Priority access to new ButtonPost integrations',
      ],
      priceId: {
        month: requiredPublicEnv('NEXT_PUBLIC_PADDLE_PRO_MONTH_PRICE_ID'),
        year: requiredPublicEnv('NEXT_PUBLIC_PADDLE_PRO_YEAR_PRICE_ID'),
      },
    },
    {
      name: 'Advanced',
      description: 'For power users with heavier publishing workflows.',
      features: [
        'Everything in Pro',
        'Designed for higher-volume workflows',
        'Priority product support',
      ],
      priceId: {
        month: requiredPublicEnv('NEXT_PUBLIC_PADDLE_ADVANCED_MONTH_PRICE_ID'),
        year: requiredPublicEnv('NEXT_PUBLIC_PADDLE_ADVANCED_YEAR_PRICE_ID'),
      },
    },
  ]
}

export type PaidPlan = 'starter' | 'pro' | 'advanced'

export function paidPlanForPriceId(priceId: string): PaidPlan | null {
  for (const tier of getPricingTiers()) {
    if (tier.priceId.month === priceId || tier.priceId.year === priceId) {
      return tier.name.toLowerCase() as PaidPlan
    }
  }

  return null
}
