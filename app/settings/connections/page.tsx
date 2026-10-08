import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ConnectionsPanel } from '@/components/connections-panel'
import { listConnections } from '@/lib/connections/store'
import { createClient } from '@/lib/supabase/server'

type Props = {
  searchParams: Promise<{
    connected?: string
    error?: string
  }>
}

function noticeFor(params: { connected?: string; error?: string }) {
  if (params.connected === 'x') return 'X connected successfully.'

  const messages: Record<string, string> = {
    x_app_not_configured: 'X app credentials are not configured on ButtonPost.',
    x_start_failed:
      'Could not start X authorization. Check the X app callback URL and permissions.',
    x_callback_missing: 'X authorization was canceled or expired.',
    x_callback_failed:
      'X authorization could not be completed. Try connecting again.',
    x_rate_limited:
      'Too many X connection attempts. Wait a few minutes and try again.',
    x_rate_limit_failed:
      'ButtonPost could not verify the X connection rate limit.',
  }

  return params.error ? messages[params.error] ?? 'Connection failed.' : null
}

export default async function ConnectionsPage({ searchParams }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const connections = await listConnections(supabase, user.id)
  const params = await searchParams

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div>
          <Link className="auth-home" href="/">← ButtonPost</Link>
          <span className="eyebrow">YOUR WORKSPACE / STEP 02</span>
          <h1>Connect your channels<span className="brand-accent">.</span></h1>
          <p>
            Choose where your ideas travel. Connect X with one authorization or
            add your DEV Community API key. Your credentials remain encrypted.
          </p>
        </div>
        <div className="settings-header-actions">
          <Link className="auth-link" href="/settings/billing">
            Billing
          </Link>
          <Link className="auth-link" href="/settings/account">
            Account
          </Link>
          <span className="auth-chip">{user.email}</span>
        </div>
      </header>

      <ConnectionsPanel
        initialConnections={connections.map((connection) => ({
          platform: connection.platform,
          status: connection.status,
          externalUsername: connection.externalUsername,
        }))}
        notice={noticeFor(params)}
      />
      <div className="settings-finish">
        <div>
          <span className="eyebrow">NEXT / YOUR FIRST POST</span>
          <strong>Ready to share something?</strong>
          <p>Return to the publishing desk whenever you’re ready.</p>
        </div>
        <Link href="/" className="settings-finish-link">Go to publishing desk <span aria-hidden="true">↗</span></Link>
      </div>
    </main>
  )
}
