import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isPaidPlan,
  type ButtonPostPlan,
  type PaidPlan,
} from '@/lib/billing/plans'

export type SubscriptionEntitlement = {
  plan: string | null
  status: string | null
  currentPeriodEnd: string | null
}

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

export function paidPlanFromSubscription(
  subscription: SubscriptionEntitlement | null | undefined,
): PaidPlan | null {
  if (!subscription?.plan || !subscription.status) return null
  if (!ACTIVE_STATUSES.has(subscription.status)) return null
  return isPaidPlan(subscription.plan) ? subscription.plan : null
}

export function planFromSubscription(
  subscription: SubscriptionEntitlement | null | undefined,
): ButtonPostPlan {
  return paidPlanFromSubscription(subscription) ?? 'free'
}

export function hasPaidAccess(
  subscription: SubscriptionEntitlement | null | undefined,
) {
  return paidPlanFromSubscription(subscription) !== null
}

export async function getSubscriptionEntitlement(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionEntitlement | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan,status,current_period_end')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    plan: data.plan,
    status: data.status,
    currentPeriodEnd: data.current_period_end,
  }
}
