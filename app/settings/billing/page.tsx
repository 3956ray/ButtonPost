import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BillingPanel } from '@/components/billing-panel'
import { hasProAccess } from '@/lib/billing/entitlement'
import { createClient } from '@/lib/supabase/server'

type Props = {
  searchParams: Promise<{
    checkout?: string
  }>
}

export default async function BillingPage({ searchParams }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select(
      'plan,status,current_period_end,cancel_at_period_end,paddle_customer_id',
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error

  const params = await searchParams
  const pro = hasProAccess(
    subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
        }
      : null,
  )

  const billingConfigured = Boolean(
    process.env.PADDLE_API_KEY?.trim() &&
      process.env.PADDLE_WEBHOOK_SECRET?.trim() &&
      process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() &&
      process.env.NEXT_PUBLIC_PADDLE_PRICE_ID?.trim(),
  )

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div>
          <Link className="auth-home" href="/">← ButtonPost</Link>
          <span className="eyebrow">Settings</span>
          <h1>Billing</h1>
          <p>
            Paddle handles checkout, invoices, payment methods, and subscription
            management. ButtonPost stores only the entitlement state needed to
            decide which product features your account may use.
          </p>
        </div>

        <div className="settings-header-actions">
          <Link className="auth-link" href="/settings/connections">
            Connections
          </Link>
          <span className="auth-chip">{user.email}</span>
        </div>
      </header>

      <BillingPanel
        userId={user.id}
        email={user.email ?? null}
        plan={pro ? 'pro' : 'free'}
        subscriptionStatus={subscription?.status ?? null}
        currentPeriodEnd={subscription?.current_period_end ?? null}
        cancelAtPeriodEnd={subscription?.cancel_at_period_end ?? false}
        billingConfigured={billingConfigured}
        portalAvailable={Boolean(subscription?.paddle_customer_id)}
        priceId={process.env.NEXT_PUBLIC_PADDLE_PRICE_ID?.trim() || null}
        sandbox={process.env.PADDLE_ENV !== 'production'}
        notice={
          params.checkout === 'success'
            ? 'Checkout completed. Paddle is confirming your subscription; refresh shortly if Pro is not visible yet.'
            : null
        }
      />
    </main>
  )
}
