'use client'

import { useState } from 'react'
import type { Provider } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

const providers: Array<{ id: Provider; label: string }> = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'github', label: 'Continue with GitHub' },
]

type Props = {
  nextPath?: string
}

export function AuthButtons({ nextPath = '/' }: Props) {
  const [busy, setBusy] = useState<Provider | null>(null)
  const [error, setError] = useState('')

  async function signIn(provider: Provider) {
    setBusy(provider)
    setError('')

    try {
      const supabase = createClient()
      const redirectTo = new URL('/auth/callback', window.location.origin)
      redirectTo.searchParams.set('next', nextPath)

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectTo.toString() },
      })

      if (signInError) {
        setError(signInError.message)
        setBusy(null)
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not start sign-in.',
      )
      setBusy(null)
    }
  }

  return (
    <>
      <div className="auth-provider-list">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            className="auth-provider"
            disabled={busy !== null}
            onClick={() => signIn(provider.id)}
          >
            <span className={'auth-provider-glyph ' + (provider.id === 'google' ? 'google' : 'github')} aria-hidden="true">
              {provider.id === 'google' ? 'G' : 'GH'}
            </span>
            <span className="auth-provider-label">{busy === provider.id ? 'Opening…' : provider.label}</span>
            <span className="auth-provider-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      {error ? <p className="auth-error">{error}</p> : null}
    </>
  )
}
