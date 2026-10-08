'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  PLAN_ENTITLEMENTS,
  type ButtonPostPlan,
} from '@/lib/billing/plans'

type Props = {
  plan: ButtonPostPlan
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  portalAvailable: boolean
  environment: 'sandbox' | 'production'
  usageUsed: number
  usageMonthlyLimit: number
  usageResetAt: string
}

export function BillingPanel({
  plan,
  subscriptionStatus,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  portalAvailable,
  environment,
  usageUsed,
  usageMonthlyLimit,
  usageResetAt,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const entitlement = PLAN_ENTITLEMENTS[plan]

  async function manageBilling() {
    setBusy(true)
    setError('')

    try {
      const response = await fetch('/api/paddle/portal', {
        method: 'POST',
      })
      const data = (await response.json().catch(() => ({}))) as {
        url?: string
        error?: string
      }

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Could not open Paddle billing portal.')
      }

      window.location.assign(data.url)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not open Paddle billing portal.',
      )
      setBusy(false)
    }
  }

  const periodLabel = currentPeriodEnd
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
      }).format(new Date(currentPeriodEnd))
    : null

  const resetLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(usageResetAt))

  const usagePercent =
    usageMonthlyLimit > 0
      ? Math.min(100, Math.round((usageUsed / usageMonthlyLimit) * 100))
      : 0

  const paid = plan !== 'free'

  return (
    <div className="billing-grid">
      {environment === 'sandbox' ? (
        <p className="billing-banner sandbox">
          Paddle Sandbox · test payments only
        </p>
      ) : null}

      {error ? <p className="billing-banner error">{error}</p> : null}

      <section className="billing-card billing-current">
        <div className="billing-card-head">
          <div>
            <span className="eyebrow">Current plan</span>
            <h2>{entitlement.label}</h2>
          </div>
          <span className={'billing-plan ' + (paid ? 'pro' : '')}>
            {entitlement.label}
          </span>
        </div>

        {paid ? (
          <p>
            Your Paddle subscription is{' '}
            <strong>{subscriptionStatus || 'active'}</strong>.
            {periodLabel
              ? ` Current billing period ends ${periodLabel}.`
              : ''}
            {cancelAtPeriodEnd
              ? ' Cancellation is scheduled for the end of the billing period.'
              : ''}
          </p>
        ) : (
          <p>
            Free includes a small cloud publishing allowance so you can test the
            full ButtonPost workflow before subscribing. Local Runner publishing
            stays unlimited.
          </p>
        )}

        <div className="usage-block">
          <div className="usage-heading">
            <div>
              <span className="eyebrow">Cloud publishing this month</span>
              <strong>
                {usageUsed} / {usageMonthlyLimit}
              </strong>
            </div>
            <span>Resets {resetLabel}</span>
          </div>

          <div
            className="usage-track"
            role="progressbar"
            aria-label="Monthly cloud publishing usage"
            aria-valuemin={0}
            aria-valuemax={usageMonthlyLimit}
            aria-valuenow={usageUsed}
          >
            <span style={{ width: `${usagePercent}%` }} />
          </div>

          <p className="usage-note">
            One cloud publish batch is one ButtonPost server publish action.
            Publishing to X and DEV together still counts once. Local Runner
            destinations never consume this allowance.
          </p>
        </div>

        <div className="billing-actions-row">
          <Link className="billing-primary welcome-link" href="/pricing">
            {paid ? 'View plans' : 'Upgrade'}
          </Link>
          {portalAvailable ? (
            <button
              type="button"
              className="billing-secondary"
              disabled={busy}
              onClick={manageBilling}
            >
              {busy ? 'Opening…' : 'Manage billing'}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
