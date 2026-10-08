'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function clearButtonPostLocalData() {
  const keys: string[] = []

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith('buttonpost.')) keys.push(key)
  }

  for (const key of keys) {
    window.localStorage.removeItem(key)
  }
}

export function DeleteAccountPanel() {
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function deleteAccount() {
    if (confirmation !== 'DELETE') return

    const approved = window.confirm(
      'Delete your ButtonPost account permanently? Any active Paddle subscription will be canceled immediately.',
    )

    if (!approved) return

    setBusy(true)
    setError('')

    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmation }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error || 'Could not delete the account.')
      }

      clearButtonPostLocalData()

      try {
        const supabase = createClient()
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // The server has already deleted the Auth user. Local sign-out is
        // best-effort cleanup only.
      }

      window.location.assign('/')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not delete the account.',
      )
      setBusy(false)
    }
  }

  return (
    <section className="danger-card">
      <span className="eyebrow">Danger zone</span>
      <h2>Delete account</h2>
      <p>
        This permanently removes your ButtonPost account and server-side user
        data, including stored platform connections, encrypted credentials,
        runner device records, and subscription entitlement. Any active Paddle
        subscription is canceled immediately first.
      </p>
      <p>
        ButtonPost also clears its browser localStorage after deletion. Local
        Runner browser profiles under <code>~/.buttonpost</code> stay on your
        computer and must be removed locally if you no longer want them.
      </p>

      <label className="delete-confirmation">
        <span>Type DELETE to confirm</span>
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="DELETE"
        />
      </label>

      {error ? <p className="danger-error">{error}</p> : null}

      <button
        type="button"
        className="danger-button"
        disabled={busy || confirmation !== 'DELETE'}
        onClick={deleteAccount}
      >
        {busy ? 'Deleting account…' : 'Delete account permanently'}
      </button>
    </section>
  )
}
