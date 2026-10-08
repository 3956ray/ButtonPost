import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BillingPanel } from '@/components/billing-panel'
import { getCloudPublishUsage } from '@/lib/billing/usage'
import { resolvePaddleEnvironment } from '@/lib/paddle/runtime'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export default async function BillingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/settings/billing')

  const requestHeaders = await headers()
  const environment = resolvePaddleEnvironment(
    requestHeaders.get('host'),
  )

  const [{ data: subscription, error }, usage] = await Promise.all([
    supabase
      .from('subscriptions')
      .select(
        'plan,status,current_period_end,cancel_at_period_end,paddle_customer_id',
      )
      .eq('user_id', user.id)
      .eq('environment', environment)
      .maybeSingle(),
    getCloudPublishUsage(user.id, environment),
  ])

  if (error) throw error


  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div>
          <Link className="auth-home" href="/">← ButtonPost</Link>
          <span className="eyebrow">Settings</span>
          <h1>Billing</h1>
          <p>
            Paddle handles checkout, invoices, payment methods, and subscription
            management. ButtonPost stores only the entitlement and usage state
            needed to decide which product features your account may use.
          </p>
        </div>

        <div className="settings-header-actions">
          <Link className="auth-link" href="/pricing">
            Pricing
          </Link>
          <Link className="auth-link" href="/settings/connections">
            Connections
          </Link>
          <Link className="auth-link" href="/settings/account">
            Account
          </Link>
          <span className="auth-chip">{user.email}</span>
        </div>
      </header>

      <BillingPanel
        plan={usage.plan}
        subscriptionStatus={subscription?.status ?? null}
        currentPeriodEnd={subscription?.current_period_end ?? null}
        cancelAtPeriodEnd={subscription?.cancel_at_period_end ?? false}
        portalAvailable={Boolean(subscription?.paddle_customer_id)}
        environment={environment}
        usageUsed={usage.used}
        usageMonthlyLimit={usage.monthlyLimit}
        usageResetAt={usage.resetAt}
      />
    </main>
  )
}
