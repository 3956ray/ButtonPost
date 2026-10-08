'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { PaidPlan } from '@/lib/billing/tiers'

type Props = {
  plan: 'free' | PaidPlan
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  portalAvailable: boolean
  environment: 'sandbox' | 'production'
}

const PLAN_LABELS: Record<'free' | PaidPlan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  advanced: 'Advanced',
}

export function BillingPanel({
  plan,
  subscriptionStatus,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  portalAvailable,
  environment,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
            <h2>{PLAN_LABELS[plan]}</h2>
          </div>
          <span className={'billing-plan ' + (paid ? 'pro' : '')}>
            {PLAN_LABELS[plan]}
          </span>
        </div>

        {paid ? (
          <>
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

            <div className="billing-actions-row">
              <Link className="billing-primary welcome-link" href="/pricing">
                View plans
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
          </>
        ) : (
          <>
            <p>
              Choose Starter, Pro, or Advanced on the pricing page. Checkout and
              localized totals are handled by Paddle.
            </p>
            <Link className="billing-primary welcome-link" href="/pricing">
              View pricing
            </Link>
          </>
        )}
      </section>
    </div>
  )
}
