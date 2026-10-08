import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { PricingTable } from '@/components/pricing-table'
import { getPricingTiers } from '@/lib/billing/tiers'
import {
  paddleClientToken,
  resolvePaddleEnvironment,
} from '@/lib/paddle/runtime'
import { createClient } from '@/lib/supabase/server'

function validCountryCode(value: string | null) {
  const normalized = value?.trim().toUpperCase()
  return normalized && /^[A-Z]{2}$/.test(normalized)
    ? normalized
    : undefined
}

export default async function PricingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/pricing')
  }

  const requestHeaders = await headers()
  const countryCode = validCountryCode(
    requestHeaders.get('x-vercel-ip-country'),
  )
  const environment = resolvePaddleEnvironment(
    requestHeaders.get('host'),
  )
  const tiers = getPricingTiers(environment)
  const clientToken = paddleClientToken(environment)

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('paddle_customer_id')
    .eq('user_id', user.id)
    .eq('environment', environment)
    .maybeSingle()

  return (
    <main className="pricing-shell">
      <header className="pricing-hero">
        <div className="pricing-nav">
          <Link className="auth-home" href="/">← ButtonPost</Link>
          <div className="settings-header-actions">
            <Link className="auth-link" href="/settings/billing">
              Billing
            </Link>
            <Link className="auth-link" href="/settings/account">
              Account
            </Link>
            <span className="auth-chip">{user.email}</span>
          </div>
        </div>

        <span className="eyebrow">Pricing</span>
        <h1>Choose the plan that fits your publishing rhythm.</h1>
        <p>
          Localized totals come directly from Paddle. Switch billing periods
          without client-side currency math or reformatting.
        </p>
      </header>

      <PricingTable
        tiers={tiers}
        environment={environment}
        clientToken={clientToken}
        paddleCustomerId={subscription?.paddle_customer_id ?? null}
        countryCode={countryCode}
        userId={user.id}
        email={user.email ?? null}
      />
    </main>
  )
}
