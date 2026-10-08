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
        <Link className="auth-home" href="/">← ButtonPost</Link>
        <h1>Sign in</h1>
        <p>
          Sign in to own your platform connections, subscription, and runner devices.
        </p>

        {configured ? (
          <AuthButtons nextPath={nextPath} />
        ) : (
          <p className="auth-error">
            Authentication is not configured on this deployment yet.
          </p>
        )}
      </section>
    </main>
  )
}
