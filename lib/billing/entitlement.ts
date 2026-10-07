import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SubscriptionEntitlement = {
  plan: string | null
  status: string | null
  currentPeriodEnd: string | null
}

const PRO_STATUSES = new Set(['active', 'trialing', 'past_due'])

export function publishingRequiresPro() {
  return process.env.BUTTONPOST_REQUIRE_PRO === 'true'
}

export function hasProAccess(
  subscription: SubscriptionEntitlement | null | undefined,
) {
  return Boolean(
    subscription?.plan === 'pro' &&
      subscription.status &&
      PRO_STATUSES.has(subscription.status),
  )
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
  if (!publishingRequiresPro()) return true

  const subscription = await getSubscriptionEntitlement(supabase, userId)
  return hasProAccess(subscription)
}
