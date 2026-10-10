import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { PricingTable } from '@/components/pricing-table'
import { getPricingTiers } from '@/lib/billing/tiers'
import { paddleClientToken } from '@/lib/paddle/runtime'
import { createClient } from '@/lib/supabase/server'

function validCountryCode(value: string | null) {
  const normalized = value?.trim().toUpperCase()
  return normalized && /^[A-Z]{2}$/.test(normalized)
    ? normalized
    : undefined
}

export default async function LivePricingVerificationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/internal/live-pricing')
  }

  if (
    !process.env.BUTTONPOST_LIVE_TESTER_USER_ID ||
    user.id !== process.env.BUTTONPOST_LIVE_TESTER_USER_ID
  ) {
    notFound()
  }

  const requestHeaders = await headers()
  const countryCode = validCountryCode(
    requestHeaders.get('x-vercel-ip-country'),
  )
  const tiers = getPricingTiers('production')
  const clientToken = paddleClientToken('production')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('paddle_customer_id')
    .eq('user_id', user.id)
    .eq('environment', 'production')
    .maybeSingle()

  return (
    <main className="pricing-shell">
      <header className="pricing-hero">
        <div className="pricing-nav">
          <Link className="auth-home" href="/">← ButtonPost</Link>
          <span className="auth-chip">{user.email}</span>
        </div>

        <span className="eyebrow">Owner-only Live verification</span>
        <h1>Paddle Live checkout verification.</h1>
        <p>
          This page uses the real Paddle Live catalog on the approved
          buttonpost.app domain. Open Checkout to verify prices and rendering,
          but do not complete a real payment yet.
        </p>
      </header>

      <p className="billing-banner error">
        LIVE PADDLE · verification only · do not submit payment
      </p>

      <PricingTable
        tiers={tiers}
        environment="production"
        clientToken={clientToken}
        paddleCustomerId={subscription?.paddle_customer_id ?? null}
        countryCode={countryCode}
        userId={user.id}
        email={user.email ?? null}
      />
    </main>
  )
}
