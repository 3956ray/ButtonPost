export type PaidPlan = 'starter' | 'pro' | 'advanced'
export type ButtonPostPlan = 'free' | PaidPlan

export type PlanEntitlement = {
  label: string
  cloudPublishBatchesPerMonth: number
  localRunnerUnlimited: true
  support: string
}

export const PLAN_ENTITLEMENTS: Record<ButtonPostPlan, PlanEntitlement> = {
  free: {
    label: 'Free',
    cloudPublishBatchesPerMonth: 5,
    localRunnerUnlimited: true,
    support: 'Community support',
  },
  starter: {
    label: 'Starter',
    cloudPublishBatchesPerMonth: 50,
    localRunnerUnlimited: true,
    support: 'Standard email support',
  },
  pro: {
    label: 'Pro',
    cloudPublishBatchesPerMonth: 200,
    localRunnerUnlimited: true,
    support: 'Priority email support',
  },
  advanced: {
    label: 'Advanced',
    cloudPublishBatchesPerMonth: 600,
    localRunnerUnlimited: true,
    support: 'Priority issue handling',
  },
}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === 'starter' || value === 'pro' || value === 'advanced'
}

export function isButtonPostPlan(value: unknown): value is ButtonPostPlan {
  return value === 'free' || isPaidPlan(value)
}
