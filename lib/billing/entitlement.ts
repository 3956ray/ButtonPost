import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaidPlan } from '@/lib/billing/tiers'

export type SubscriptionEntitlement = {
  plan: string | null
  status: string | null
  currentPeriodEnd: string | null
}

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])
const PAID_PLANS = new Set<PaidPlan>(['starter', 'pro', 'advanced'])

export function publishingRequiresPaidPlan() {
  return process.env.BUTTONPOST_REQUIRE_PRO === 'true'
}

export function paidPlanFromSubscription(
  subscription: SubscriptionEntitlement | null | undefined,
): PaidPlan | null {
  if (!subscription?.plan || !subscription.status) return null
  if (!ACTIVE_STATUSES.has(subscription.status)) return null
  if (!PAID_PLANS.has(subscription.plan as PaidPlan)) return null
  return subscription.plan as PaidPlan
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

export async function canUseCloudPublishing(
  supabase: SupabaseClient,
  userId: string,
) {
  if (!publishingRequiresPaidPlan()) return true

  const subscription = await getSubscriptionEntitlement(supabase, userId)
  return hasPaidAccess(subscription)
}
