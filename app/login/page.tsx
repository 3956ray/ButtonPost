import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthButtons } from '@/components/auth-buttons'
import { getSupabasePublicConfig } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

type Props = {
  searchParams: Promise<{
    next?: string
  }>
}

function safeNext(value: string | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export default async function LoginPage({ searchParams }: Props) {
  const configured = Boolean(getSupabasePublicConfig())
  const params = await searchParams
  const nextPath = safeNext(params.next)
  let signedIn = false

  if (configured) {
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      signedIn = Boolean(user)
    } catch {
      signedIn = false
    }
  }

  if (signedIn) {
    redirect(nextPath)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="auth-home" href="/">← Back to ButtonPost</Link>
        <div className="auth-topline"><span>YOUR PUBLISHING SPACE</span><span>01 / SIGN IN</span></div>
        <h1>Less clicking.<br /><em>More sharing.</em></h1>
        <p>
          Sign in to connect your accounts and publish your ideas from one thoughtfully simple workspace.
        </p>

        {configured ? (
          <AuthButtons nextPath={nextPath} />
        ) : (
          <p className="auth-error">
            Authentication is not configured on this deployment yet.
          </p>
        )}

        <div className="auth-bottom-note">
          <span className="auth-note-symbol" aria-hidden="true">✳</span>
          Your words and accounts stay under your control. No local installation needed for X or DEV.
        </div>
      </section>
      <aside className="auth-side" aria-label="About ButtonPost">
        <span className="auth-side-kicker">BUTTONPOST — YOUR DISTRIBUTION DESK</span>
        <div className="auth-side-visual" aria-hidden="true">
          <div className="auth-side-post"><span>ONE ORIGINAL POST</span><strong>Your idea, in your own words.</strong></div>
          <div className="auth-side-connector"><i /><i /><i /></div>
          <div className="auth-side-destinations"><span>𝕏</span><span>D</span><span>XH</span><span>JK</span><span>LB</span></div>
        </div>
        <strong>Good ideas are meant to travel.</strong>
        <p>Write once. Publish everywhere.</p>
      </aside>
    </main>
  )
}
