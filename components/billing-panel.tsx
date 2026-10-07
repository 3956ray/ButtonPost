'use client'

import { useRef, useState } from 'react'
import { createPaddleClient } from '@/lib/paddle/client'

type Props = {
  userId: string
  email: string | null
  plan: 'free' | 'pro'
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  billingConfigured: boolean
  portalAvailable: boolean
  priceId: string | null
  sandbox: boolean
  notice?: string | null
}

export function BillingPanel({
  userId,
  email,
  plan,
  subscriptionStatus,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  billingConfigured,
  portalAvailable,
  priceId,
  sandbox,
  notice,
}: Props) {
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null)
  const [error, setError] = useState('')
  const paddlePromise = useRef<ReturnType<typeof createPaddleClient> | null>(null)

  function getPaddle() {
    if (!paddlePromise.current) {
      paddlePromise.current = createPaddleClient()
    }
    return paddlePromise.current
  }

  async function upgrade() {
    if (!billingConfigured || !priceId) {
      setError('Paddle Checkout is not configured yet.')
      return
    }

    setBusy('checkout')
    setError('')

    try {
      const paddle = await getPaddle()
      if (!paddle) throw new Error('Paddle Checkout could not be initialized.')

      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        ...(email ? { customer: { email } } : {}),
        customData: {
          buttonpost_user_id: userId,
        },
        settings: {
          displayMode: 'overlay',
          variant: 'one-page',
          theme: 'light',
          successUrl: `${window.location.origin}/settings/billing?checkout=success`,
        },
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not open Paddle Checkout.',
      )
    } finally {
      setBusy(null)
    }
  }

  async function manageBilling() {
    setBusy('portal')
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
      setBusy(null)
    }
  }

  const periodLabel = currentPeriodEnd
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
      }).format(new Date(currentPeriodEnd))
    : null

  return (
    <div className="billing-grid">
      {sandbox ? (
        <p className="billing-banner sandbox">
          Paddle Sandbox · test payments only
        </p>
      ) : null}

      {notice ? <p className="billing-banner success">{notice}</p> : null}
      {error ? <p className="billing-banner error">{error}</p> : null}

      <section className="billing-card billing-current">
        <div className="billing-card-head">
          <div>
            <span className="eyebrow">Current plan</span>
            <h2>{plan === 'pro' ? 'ButtonPost Pro' : 'Free'}</h2>
          </div>
          <span className={'billing-plan ' + (plan === 'pro' ? 'pro' : '')}>
            {plan === 'pro' ? 'Pro' : 'Free'}
          </span>
        </div>

        {plan === 'pro' ? (
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

            {portalAvailable ? (
              <button
                type="button"
                className="billing-secondary"
                disabled={busy === 'portal'}
                onClick={manageBilling}
              >
                {busy === 'portal' ? 'Opening…' : 'Manage billing'}
              </button>
            ) : null}
          </>
        ) : (
          <p>
            Free access is active while ButtonPost completes its paid-beta
            setup. Upgrade to Pro through Paddle when billing is enabled.
          </p>
        )}
      </section>

      <section className="billing-card billing-pro">
        <div className="billing-card-head">
          <div>
            <span className="eyebrow">Paid plan</span>
            <h2>ButtonPost Pro</h2>
          </div>
          <span className="billing-price">Monthly</span>
        </div>

        <p>
          Keep cloud API publishing, per-user platform connections, and future
          paid ButtonPost features under one subscription.
        </p>

        <div className="billing-features">
          <span>✓ X + DEV cloud publishing</span>
          <span>✓ Per-user encrypted platform connections</span>
          <span>✓ Paddle-hosted billing management</span>
        </div>

        {plan === 'pro' ? (
          <span className="billing-active-note">Your Pro entitlement is active.</span>
        ) : (
          <button
            type="button"
            className="billing-primary"
            disabled={!billingConfigured || busy === 'checkout'}
            onClick={upgrade}
          >
            {!billingConfigured
              ? 'Checkout setup pending'
              : busy === 'checkout'
                ? 'Opening checkout…'
                : 'Upgrade to Pro'}
          </button>
        )}

        {!billingConfigured ? (
          <p className="billing-helper">
            Paddle Checkout is not fully configured on this deployment yet.
          </p>
        ) : null}
      </section>
    </div>
  )
}
