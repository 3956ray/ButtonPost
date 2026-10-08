import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isButtonPostPlan,
  type ButtonPostPlan,
} from '@/lib/billing/plans'

export type CloudPublishUsage = {
  plan: ButtonPostPlan
  used: number
  monthlyLimit: number
  resetAt: string
}

export type CloudPublishReservation = CloudPublishUsage & {
  usageId: string | null
  allowed: boolean
}

type UsageRow = {
  plan?: unknown
  used?: unknown
  monthly_limit?: unknown
  reset_at?: unknown
}

type ReservationRow = UsageRow & {
  usage_id?: unknown
  allowed?: unknown
}

export function planEnforcementEnabled() {
  const current = process.env.BUTTONPOST_ENFORCE_PLANS?.trim()
  if (current === 'true') return true
  if (current === 'false') return false

  // Backward compatibility for the Phase 6D flag.
  return process.env.BUTTONPOST_REQUIRE_PRO === 'true'
}

function parseUsageRow(row: UsageRow | null | undefined): CloudPublishUsage {
  if (
    !row ||
    !isButtonPostPlan(row.plan) ||
    typeof row.used !== 'number' ||
    typeof row.monthly_limit !== 'number' ||
    typeof row.reset_at !== 'string'
  ) {
    throw new Error('ButtonPost cloud publish usage response was invalid.')
  }

  return {
    plan: row.plan,
    used: row.used,
    monthlyLimit: row.monthly_limit,
    resetAt: row.reset_at,
  }
}

export async function getCloudPublishUsage(
  supabase: SupabaseClient,
): Promise<CloudPublishUsage> {
  const { data, error } = await supabase.rpc('get_buttonpost_publish_usage')

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  return parseUsageRow(row as UsageRow | null | undefined)
}

export async function reserveCloudPublish(
  supabase: SupabaseClient,
): Promise<CloudPublishReservation> {
  const { data, error } = await supabase.rpc(
    'reserve_buttonpost_cloud_publish',
  )

  if (error) throw error

  const row = (Array.isArray(data) ? data[0] : data) as
    | ReservationRow
    | null
    | undefined

  const usage = parseUsageRow(row)

  if (typeof row?.allowed !== 'boolean') {
    throw new Error('ButtonPost cloud publish reservation was invalid.')
  }

  if (
    row.usage_id !== null &&
    row.usage_id !== undefined &&
    typeof row.usage_id !== 'string'
  ) {
    throw new Error('ButtonPost cloud publish usage id was invalid.')
  }

  return {
    ...usage,
    allowed: row.allowed,
    usageId:
      typeof row.usage_id === 'string'
        ? row.usage_id
        : null,
  }
}

export async function releaseCloudPublish(
  supabase: SupabaseClient,
  usageId: string,
) {
  const { data, error } = await supabase.rpc(
    'release_buttonpost_cloud_publish',
    { p_usage_id: usageId },
  )

  if (error) throw error
  return data === true
}
