import Link from 'next/link'
import { LocalRunnerCard } from '@/components/local-runner-card'
import { PublisherForm } from '@/components/publisher-form'
import { getPlatformMetadata } from '@/lib/publishers/registry'
import type { PlatformId } from '@/lib/publishers/types'
import { getSupabasePublicConfig } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

async function getAuthState() {
  if (!getSupabasePublicConfig()) {
    return {
      configured: false,
      userId: null as string | null,
      email: null as string | null,
      connectedPlatforms: [] as PlatformId[],
    }
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        configured: true,
        userId: null as string | null,
        email: null as string | null,
        connectedPlatforms: [] as PlatformId[],
      }
    }

    const { data: connections } = await supabase
      .from('platform_connections')
      .select('platform')
      .eq('user_id', user.id)
      .eq('status', 'connected')

    const connectedPlatforms = (connections ?? []).flatMap((connection) =>
      connection.platform === 'x' || connection.platform === 'devto'
        ? [connection.platform]
        : [],
    ) as PlatformId[]

    return {
      configured: true,
      userId: user.id,
      email: user.email ?? null,
      connectedPlatforms,
    }
  } catch {
    return {
      configured: true,
      userId: null as string | null,
      email: null as string | null,
      connectedPlatforms: [] as PlatformId[],
    }
  }
}

export default async function HomePage() {
  const platforms = getPlatformMetadata()
  const auth = await getAuthState()

  return (
    <main className="shell">
      <header className="hero">
        <div className="brand-row">
          <div className="brand-lockup">
            <span className="brand-mark">B</span>
            <span className="brand-name">ButtonPost</span>
          </div>

          <div className="auth-nav">
            {!auth.configured ? (
              <span className="auth-chip">Personal MVP</span>
            ) : auth.userId ? (
              <form action="/auth/signout" method="post" className="auth-form">
                <Link className="auth-link" href="/pricing">
                  Pricing
                </Link>
                <Link className="auth-link" href="/settings/connections">
                  Connections
                </Link>
                <Link className="auth-link" href="/settings/billing">
                  Billing
                </Link>
                <Link className="auth-link" href="/settings/account">
                  Account
                </Link>
                <span className="auth-email" title={auth.email ?? undefined}>
                  {auth.email ?? 'Signed in'}
                </span>
                <button type="submit" className="auth-link auth-button">
                  Sign out
                </button>
              </form>
            ) : (
              <Link className="auth-link" href="/login">
                Sign in
              </Link>
            )}
          </div>
        </div>

        <h1>Write once. Publish everywhere.</h1>
        <p>
          One source post. Platform-specific formatting only. Publish to every selected destination in one action.
          X and DEV work directly from the web — no installation required.
        </p>
        {auth.configured && !auth.userId ? (
          <div className="hero-onboarding">
            <Link className="hero-onboarding-primary" href="/login?next=/">
              Start publishing →
            </Link>
            <span>Sign in, connect a platform, and publish from your browser.</span>
          </div>
        ) : auth.configured && auth.userId && auth.connectedPlatforms.length === 0 ? (
          <div className="hero-onboarding">
            <Link className="hero-onboarding-primary" href="/settings/connections">
              Connect X or DEV →
            </Link>
            <span>Local browser platforms are optional and available below.</span>
          </div>
        ) : null}
      </header>

      <PublisherForm
        platforms={platforms}
        connectedPlatforms={auth.connectedPlatforms}
        signedIn={Boolean(auth.userId)}
      />
      <LocalRunnerCard />

      <footer className="footer">
        <span>MVP 0.9 · X + DEV + 小红书 + 即刻 + 登链社区</span>
        <div className="footer-links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/refund">Billing & refunds</a>
          <a href="mailto:support@buttonpost.app">Support</a>
          <a href="https://github.com/3956ray/ButtonPost" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </main>
  )
}
