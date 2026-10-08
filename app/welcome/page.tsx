import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolvePaddleEnvironment } from '@/lib/paddle/runtime'
import { createClient } from '@/lib/supabase/server'

export default async function WelcomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/welcome')
  }

  const requestHeaders = await headers()
  const environment = resolvePaddleEnvironment(
    requestHeaders.get('host'),
  )

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan,status')
    .eq('user_id', user.id)
    .eq('environment', environment)
    .maybeSingle()

  const active =
    subscription?.plan &&
    subscription.plan !== 'free' &&
    ['active', 'trialing', 'past_due'].includes(subscription.status)

  return (
    <main className="welcome-shell">
      <section className="welcome-card">
        <span className="eyebrow">ButtonPost</span>
        <h1>{active ? 'Your plan is active.' : 'Payment received.'}</h1>
        <p>
          {active
            ? `Paddle confirmed your ${subscription.plan} subscription. Your ButtonPost entitlement is ready.`
            : 'Paddle is finishing the subscription webhook sync. Your plan should appear in Billing shortly.'}
        </p>

        <div className="welcome-actions">
          <Link className="billing-primary welcome-link" href="/">
            Go to ButtonPost
          </Link>
          <Link className="billing-secondary welcome-link" href="/settings/billing">
            View billing
          </Link>
        </div>
      </section>
    </main>
  )
}
