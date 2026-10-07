import Link from 'next/link'
import { LocalRunnerCard } from '@/components/local-runner-card'
import { PublisherForm } from '@/components/publisher-form'
import { getPlatformMetadata } from '@/lib/publishers/registry'
import { getSupabasePublicConfig } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

async function getAuthState() {
  if (!getSupabasePublicConfig()) {
    return { configured: false, email: null as string | null }
  }

  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getClaims()
    const claims = data?.claims as { email?: unknown } | undefined

    return {
      configured: true,
      email: typeof claims?.email === 'string' ? claims.email : null,
    }
  } catch {
    return { configured: true, email: null as string | null }
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
            ) : auth.email ? (
              <form action="/auth/signout" method="post" className="auth-form">
                <span className="auth-email" title={auth.email}>
                  {auth.email}
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
        </p>
      </header>

      <PublisherForm platforms={platforms} />
      <LocalRunnerCard />

      <footer className="footer">
        <span>MVP 0.9 · X + DEV + 小红书 + 即刻 + 登链社区</span>
        <a href="https://github.com/3956ray/ButtonPost" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </main>
  )
}
