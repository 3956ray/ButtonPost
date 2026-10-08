import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BillingPanel } from '@/components/billing-panel'
import { paidPlanFromSubscription } from '@/lib/billing/entitlement'
import { getPaddleEnvironment } from '@/lib/paddle/server'
import { createClient } from '@/lib/supabase/server'

export default async function BillingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/settings/billing')

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select(
      'plan,status,current_period_end,cancel_at_period_end,paddle_customer_id',
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error

  const paidPlan = paidPlanFromSubscription(
    subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
        }
      : null,
  )

  const environment = getPaddleEnvironment()

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
          <Link className="auth-link" href="/pricing">
            Pricing
          </Link>
          <Link className="auth-link" href="/settings/connections">
            Connections
          </Link>
          <span className="auth-chip">{user.email}</span>
        </div>
      </header>

      <BillingPanel
        plan={paidPlan ?? 'free'}
        subscriptionStatus={subscription?.status ?? null}
        currentPeriodEnd={subscription?.current_period_end ?? null}
        cancelAtPeriodEnd={subscription?.cancel_at_period_end ?? false}
        portalAvailable={Boolean(subscription?.paddle_customer_id)}
        environment={environment}
      />
    </main>
  )
}
