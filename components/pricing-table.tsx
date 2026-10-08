'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Tier } from '@/lib/billing/tiers'
import {
  createPaddleClient,
  type PaddleBrowserEnvironment,
} from '@/lib/paddle/client'

type BillingCycle = 'month' | 'year'
type TierName = Tier['name']

type Props = {
  tiers: Tier[]
  environment: PaddleBrowserEnvironment
  countryCode?: string
  userId: string
  email: string | null
}

type PriceMap = Partial<Record<TierName, string>>

export function PricingTable({
  tiers,
  environment,
  countryCode,
  userId,
  email,
}: Props) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('month')
  const [prices, setPrices] = useState<PriceMap>({})
  const [loading, setLoading] = useState(true)
  const [busyTier, setBusyTier] = useState<TierName | null>(null)
  const [error, setError] = useState('')
  const paddlePromise = useRef<ReturnType<typeof createPaddleClient> | null>(
    null,
  )

  function getPaddle() {
    if (!paddlePromise.current) {
      paddlePromise.current = createPaddleClient(environment)
    }
    return paddlePromise.current
  }

  const activePriceIds = useMemo(
    () =>
      tiers.map((tier) => ({
        tier: tier.name,
        priceId: tier.priceId[billingCycle],
      })),
    [tiers, billingCycle],
  )

  useEffect(() => {
    let cancelled = false

    async function loadPrices() {
      setLoading(true)
      setError('')

      try {
        const paddle = await getPaddle()
        if (!paddle) {
          throw new Error('Paddle.js could not be initialized.')
        }

        const result = await paddle.PricePreview({
          items: activePriceIds.map(({ priceId }) => ({
            priceId,
            quantity: 1,
          })),
          ...(countryCode
            ? {
                address: {
                  countryCode,
                },
              }
            : {}),
        })

        const nextPrices: PriceMap = {}
        const lineItems = result.data.details.lineItems

        for (const item of lineItems) {
          const priceId = item.price.id
          const match = activePriceIds.find(
            (candidate) => candidate.priceId === priceId,
          )

          if (match) {
            nextPrices[match.tier] = item.formattedTotals.total
          }
        }

        for (const { tier } of activePriceIds) {
          if (!nextPrices[tier]) {
            throw new Error(
              `Paddle did not return a localized total for ${tier}.`,
            )
          }
        }

        if (!cancelled) {
          setPrices(nextPrices)
        }
      } catch (cause) {
        if (!cancelled) {
          setPrices({})
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load localized Paddle prices.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadPrices()

    return () => {
      cancelled = true
    }
  }, [activePriceIds, countryCode])

  async function subscribe(tier: Tier) {
    const shownPrice = prices[tier.name]
    if (!shownPrice) {
      setError('Wait for Paddle to load the localized price first.')
      return
    }

    setBusyTier(tier.name)
    setError('')

    try {
      const paddle = await getPaddle()
      if (!paddle) {
        throw new Error('Paddle.js could not be initialized.')
      }

      paddle.Checkout.open({
        items: [
          {
            priceId: tier.priceId[billingCycle],
            quantity: 1,
          },
        ],
        ...(email ? { customer: { email } } : {}),
        customData: {
          buttonpost_user_id: userId,
        },
        settings: {
          displayMode: 'overlay',
          variant: 'one-page',
          successUrl: `${window.location.origin}/welcome`,
        },
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not open Paddle Checkout.',
      )
    } finally {
      setBusyTier(null)
    }
  }

  return (
    <>
      <div className="pricing-toolbar">
        <div
          className="billing-toggle"
          role="group"
          aria-label="Billing frequency"
        >
          <button
            type="button"
            className={billingCycle === 'month' ? 'active' : ''}
            onClick={() => setBillingCycle('month')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={billingCycle === 'year' ? 'active' : ''}
            onClick={() => setBillingCycle('year')}
          >
            Yearly
          </button>
        </div>

        <span className="pricing-location">
          {countryCode
            ? `Localized by Paddle for ${countryCode}`
            : 'Localized by Paddle from your IP'}
        </span>
      </div>

      {error ? <p className="pricing-error">{error}</p> : null}

      <div className="pricing-grid">
        {tiers.map((tier) => (
          <article
            className={
              'pricing-card ' + (tier.name === 'Pro' ? 'featured' : '')
            }
            key={tier.name}
          >
            <div className="pricing-card-top">
              <div>
                <span className="eyebrow">ButtonPost</span>
                <h2>{tier.name}</h2>
              </div>
              {tier.name === 'Pro' ? (
                <span className="pricing-popular">Popular</span>
              ) : null}
            </div>

            <p className="pricing-description">{tier.description}</p>

            <div className="pricing-price">
              <strong>
                {loading ? 'Loading…' : prices[tier.name] ?? 'Unavailable'}
              </strong>
              <span>/{billingCycle}</span>
            </div>

            <ul className="pricing-features">
              {tier.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>

            <button
              type="button"
              className="pricing-subscribe"
              disabled={
                loading ||
                !prices[tier.name] ||
                busyTier !== null
              }
              onClick={() => subscribe(tier)}
            >
              {busyTier === tier.name ? 'Opening checkout…' : 'Subscribe'}
            </button>
          </article>
        ))}
      </div>

      <p className="pricing-footnote">
        Prices shown above are the localized totals returned by Paddle for the
        selected billing period.
      </p>
    </>
  )
}
