import {
  PLAN_ENTITLEMENTS,
  type PaidPlan,
} from '@/lib/billing/plans'
import {
  paddlePriceId,
  type PaddleEnvironmentName,
} from '@/lib/paddle/runtime'

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

function allowance(plan: PaidPlan) {
  return PLAN_ENTITLEMENTS[plan].cloudPublishBatchesPerMonth
}

export function getPricingTiers(
  environment: PaddleEnvironmentName,
): Tier[] {
  return [
    {
      name: 'Starter',
      description: 'For individual creators publishing a few times each week.',
      features: [
        String(allowance('starter')) + ' cloud publish batches / month',
        'Unlimited Local Runner publishing',
        'X + DEV cloud connections',
        'Encrypted per-user credentials',
      ],
      priceId: {
        month: paddlePriceId(environment, 'starter', 'month'),
        year: paddlePriceId(environment, 'starter', 'year'),
      },
    },
    {
      name: 'Pro',
      description: 'For creators who publish consistently across platforms.',
      features: [
        String(allowance('pro')) + ' cloud publish batches / month',
        'Everything in Starter',
        'Priority email support',
        'Early access to new integrations',
      ],
      priceId: {
        month: paddlePriceId(environment, 'pro', 'month'),
        year: paddlePriceId(environment, 'pro', 'year'),
      },
    },
    {
      name: 'Advanced',
      description: 'For power users with high-frequency publishing workflows.',
      features: [
        String(allowance('advanced')) + ' cloud publish batches / month',
        'Everything in Pro',
        'Highest cloud publishing allowance',
        'Priority issue handling',
      ],
      priceId: {
        month: paddlePriceId(environment, 'advanced', 'month'),
        year: paddlePriceId(environment, 'advanced', 'year'),
      },
    },
  ]
}

export function paidPlanForPriceId(
  priceId: string,
  environment: PaddleEnvironmentName,
): PaidPlan | null {
  for (const tier of getPricingTiers(environment)) {
    if (
      tier.priceId.month === priceId ||
      tier.priceId.year === priceId
    ) {
      return tier.name.toLowerCase() as PaidPlan
    }
  }

  return null
}
