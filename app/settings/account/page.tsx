import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DeleteAccountPanel } from '@/components/delete-account-panel'
import { createClient } from '@/lib/supabase/server'

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/settings/account')

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div>
          <Link className="auth-home" href="/">← ButtonPost</Link>
          <span className="eyebrow">Settings</span>
          <h1>Account</h1>
          <p>
            Review your ButtonPost identity and permanently delete the account
            when you no longer want ButtonPost to retain server-side user data.
          </p>
        </div>

        <div className="settings-header-actions">
          <Link className="auth-link" href="/pricing">
            Pricing
          </Link>
          <Link className="auth-link" href="/settings/connections">
            Connections
          </Link>
          <Link className="auth-link" href="/settings/billing">
            Billing
          </Link>
          <span className="auth-chip">{user.email}</span>
        </div>
      </header>

      <section className="account-card">
        <span className="eyebrow">Signed-in identity</span>
        <h2>{user.email ?? 'ButtonPost user'}</h2>
        <p>
          Your cloud identity owns your platform connections, subscription
          entitlement, and runner device records. Post drafts and publication
          history remain local-first in this browser.
        </p>
      </section>

      <DeleteAccountPanel />
    </main>
  )
}
