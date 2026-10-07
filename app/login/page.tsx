import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthButtons } from '@/components/auth-buttons'
import { getSupabasePublicConfig } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

export default async function LoginPage() {
  const configured = Boolean(getSupabasePublicConfig())

  if (configured) {
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getClaims()
      if (data?.claims) redirect('/')
    } catch {}
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="auth-home" href="/">← ButtonPost</Link>
        <h1>Sign in</h1>
        <p>
          Sign in to own your platform connections, subscription, and runner devices.
        </p>

        {configured ? (
          <AuthButtons />
        ) : (
          <p className="auth-error">Authentication is not configured on this deployment yet.</p>
        )}

        <p className="auth-note">
          During Phase 6A the existing Publish key remains required until per-user
          X and DEV connections replace the personal credentials.
        </p>
      </section>
    </main>
  )
}
