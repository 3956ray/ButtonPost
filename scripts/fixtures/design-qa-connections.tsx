// CI-ONLY connections display fixture; no credentials or network actions.
import Link from 'next/link'
import { ConnectionsPanel } from '@/components/connections-panel'

export default function ConnectionsFixture() {
  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div>
          <Link className="auth-home" href="/design-qa-fixture">← ButtonPost</Link>
          <span className="eyebrow">YOUR WORKSPACE / STEP 02</span>
          <h1>Connect your channels<span className="brand-accent">.</span></h1>
          <p>Choose where your ideas travel. Connect X with one authorization or add your DEV Community API key.</p>
        </div>
        <div className="settings-header-actions">
          <span className="auth-chip">preview@example.test</span>
        </div>
      </header>
      <ConnectionsPanel
        initialConnections={[
          { platform: 'x', status: 'connected', externalUsername: 'preview-writer' },
          { platform: 'devto', status: 'disconnected', externalUsername: null },
        ]}
      />
      <div className="settings-finish">
        <div>
          <span className="eyebrow">NEXT / YOUR FIRST POST</span>
          <strong>Ready to share something?</strong>
          <p>Return to your Post Desk whenever you’re ready.</p>
        </div>
        <Link href="/design-qa-fixture" className="settings-finish-link">
          Go to your Post Desk <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </main>
  )
}
