'use client'

import { useEffect, useState } from 'react'

const STORAGE_JIKE_ACCOUNT = 'buttonpost.jike.account'

type PlatformState =
  | 'unknown'
  | 'checking'
  | 'login'
  | 'connected'
  | 'disconnected'
  | 'error'

type PlatformAuthResponse = {
  ok?: boolean
  authenticated?: boolean
  status?: string
  message?: string
  error?: string
}

type LoopbackRequestInit = RequestInit & {
  targetAddressSpace?: 'loopback'
}

type Props = {
  runnerUrl: string
  runnerToken: string
  runnerConnected: boolean
  runnerSupported: boolean
  runnerVersion: string
}

function loopbackInit(init: RequestInit = {}): LoopbackRequestInit {
  return { ...init, targetAddressSpace: 'loopback' }
}

async function localRequest(
  runnerUrl: string,
  runnerToken: string,
  pathname: string,
  init: RequestInit = {},
) {
  const url = runnerUrl.trim().replace(/\/$/, '')
  const headers = new Headers(init.headers)
  headers.set('Authorization', 'Bearer ' + runnerToken.trim())

  return fetch(
    url + pathname,
    loopbackInit({
      ...init,
      headers,
      cache: 'no-store',
    }),
  )
}

export function JikeRunnerCard({
  runnerUrl,
  runnerToken,
  runnerConnected,
  runnerSupported,
  runnerVersion,
}: Props) {
  const [account, setAccount] = useState('default')
  const [state, setState] = useState<PlatformState>('unknown')
  const [message, setMessage] = useState(
    'Connect the runner, then check your Jike login.',
  )

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_JIKE_ACCOUNT)
    if (saved) setAccount(saved)
  }, [])

  useEffect(() => {
    if (runnerConnected && !runnerSupported) {
      setState('error')
      setMessage(
        'Local Runner' +
          (runnerVersion ? ' v' + runnerVersion : '') +
          ' does not support Jike. Update ButtonPost, restart npm run runner, then reconnect.',
      )
    }
  }, [runnerConnected, runnerSupported, runnerVersion])

  useEffect(() => {
    if (!runnerConnected || !runnerSupported) return

    const onReadiness = (event: Event) => {
      const details = (event as CustomEvent<Record<string, boolean>>).detail
      if (typeof details?.jike !== 'boolean') return
      if (state === 'checking' || state === 'login') return

      const authenticated = details.jike
      setState(authenticated ? 'connected' : 'disconnected')
      setMessage(
        authenticated
          ? 'Jike login verified on this computer.'
          : 'Jike is not signed in. Connect the account below.',
      )
    }

    window.addEventListener('buttonpost:local-readiness-update', onReadiness)
    return () =>
      window.removeEventListener('buttonpost:local-readiness-update', onReadiness)
  }, [runnerConnected, runnerSupported, state])

  async function checkLogin() {
    if (!runnerConnected || !runnerUrl.trim() || !runnerToken.trim()) {
      setState('error')
      setMessage('Connect the Local Runner first.')
      return
    }

    if (!runnerSupported) {
      setState('error')
      setMessage(
        'Local Runner' +
          (runnerVersion ? ' v' + runnerVersion : '') +
          ' is too old for Jike. Update and restart the runner.',
      )
      return
    }

    const normalizedAccount = account.trim() || 'default'
    setState('checking')
    setMessage('Checking Jike login stored on this computer...')

    try {
      const response = await localRequest(
        runnerUrl,
        runnerToken,
        '/v1/platforms/jike/status?account=' +
          encodeURIComponent(normalizedAccount),
      )
      const data = (await response.json()) as PlatformAuthResponse

      if (response.ok && data.authenticated) {
        window.localStorage.setItem(STORAGE_JIKE_ACCOUNT, normalizedAccount)
        setAccount(normalizedAccount)
        setState('connected')
        setMessage(data.message || 'Jike login is valid.')
        return
      }

      setState(response.status >= 500 ? 'error' : 'disconnected')
      setMessage(data.error || data.message || 'Jike is not connected.')
    } catch {
      setState('error')
      setMessage('Could not ask the Local Runner for Jike status.')
    } finally {
      window.dispatchEvent(new Event('buttonpost:local-readiness-refresh'))
    }
  }

  async function login() {
    const normalizedAccount = account.trim() || 'default'

    if (!runnerConnected) {
      setState('error')
      setMessage('Connect the Local Runner first.')
      return
    }

    if (!runnerSupported) {
      setState('error')
      setMessage(
        'Local Runner' +
          (runnerVersion ? ' v' + runnerVersion : '') +
          ' is too old for Jike. Update and restart the runner.',
      )
      return
    }

    window.localStorage.setItem(STORAGE_JIKE_ACCOUNT, normalizedAccount)
    setAccount(normalizedAccount)
    setState('login')
    setMessage(
      'A local Chrome window is opening. Complete Jike login there; ButtonPost is waiting for confirmation.',
    )

    try {
      const response = await localRequest(
        runnerUrl,
        runnerToken,
        '/v1/platforms/jike/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: normalizedAccount }),
        },
      )
      const data = (await response.json()) as PlatformAuthResponse

      if (response.ok && data.authenticated) {
        setState('connected')
        setMessage(data.message || 'Jike is connected.')
        return
      }

      setState(data.status === 'timeout' ? 'disconnected' : 'error')
      setMessage(data.error || data.message || 'Jike login did not complete.')
    } catch {
      setState('error')
      setMessage(
        'The Local Runner lost the Jike login request. Check the runner terminal for details.',
      )
    } finally {
      window.dispatchEvent(new Event('buttonpost:local-readiness-refresh'))
    }
  }

  const label =
    runnerConnected && !runnerSupported
      ? 'Update runner'
      : state === 'connected'
      ? 'Connected'
      : state === 'login'
        ? 'Waiting for login'
        : state === 'checking'
          ? 'Checking'
          : state === 'disconnected'
            ? 'Not connected'
            : state === 'error'
              ? 'Error'
              : 'Unknown'

  const busy = state === 'login' || state === 'checking'

  return (
    <div className="local-platform-card">
      <div className="local-platform-header">
        <div>
          <span className="eyebrow">Local platform</span>
          <h3>Jike</h3>
        </div>
        <span className={'local-platform-status ' + state}>{label}</span>
      </div>

      <div className="local-platform-controls">
        <label>
          <span>Account name</span>
          <input
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            disabled={busy}
            placeholder="default"
          />
        </label>

        <div className="local-platform-buttons">
          <button
            type="button"
            className="secondary-button"
            disabled={!runnerConnected || !runnerSupported || busy}
            onClick={checkLogin}
          >
            Check login
          </button>
          <button
            type="button"
            disabled={!runnerConnected || !runnerSupported || busy}
            onClick={login}
          >
            {state === 'login'
              ? 'Waiting...'
              : state === 'connected'
                ? 'Reconnect'
                : 'Connect Jike'}
          </button>
        </div>
      </div>

      <p
        className={
          'local-platform-message ' + (state === 'error' ? 'error' : '')
        }
      >
        {message}
      </p>
      <p className="runner-privacy">
        Login runs in a dedicated local Chrome profile under <code>~/.buttonpost</code>.
        Nothing is published during this step.
      </p>
    </div>
  )
}
