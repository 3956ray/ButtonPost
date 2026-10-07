'use client'

import { useEffect, useState } from 'react'

const STORAGE_ACCOUNT = 'buttonpost.learnblockchain.account'

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

export function LearnBlockchainRunnerCard({
  runnerUrl,
  runnerToken,
  runnerConnected,
  runnerSupported,
  runnerVersion,
}: Props) {
  const [account, setAccount] = useState('default')
  const [state, setState] = useState<PlatformState>('unknown')
  const [message, setMessage] = useState(
    'Connect the runner, then check your LearnBlockchain login.',
  )

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_ACCOUNT)
    if (saved) setAccount(saved)
  }, [])

  useEffect(() => {
    if (runnerConnected && !runnerSupported) {
      setState('error')
      setMessage(
        'Local Runner' +
          (runnerVersion ? ' v' + runnerVersion : '') +
          ' does not support LearnBlockchain. Update ButtonPost, restart npm run runner, then reconnect.',
      )
    }
  }, [runnerConnected, runnerSupported, runnerVersion])

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
          ' is too old for LearnBlockchain. Update and restart the runner.',
      )
      return
    }

    const normalizedAccount = account.trim() || 'default'
    setState('checking')
    setMessage('Checking LearnBlockchain login stored on this computer...')

    try {
      const response = await localRequest(
        runnerUrl,
        runnerToken,
        '/v1/platforms/learnblockchain/status?account=' +
          encodeURIComponent(normalizedAccount),
      )
      const data = (await response.json()) as PlatformAuthResponse

      if (response.ok && data.authenticated) {
        window.localStorage.setItem(STORAGE_ACCOUNT, normalizedAccount)
        setAccount(normalizedAccount)
        setState('connected')
        setMessage(data.message || 'LearnBlockchain login is valid.')
        return
      }

      setState(response.status >= 500 ? 'error' : 'disconnected')
      setMessage(
        data.error || data.message || 'LearnBlockchain is not connected.',
      )
    } catch {
      setState('error')
      setMessage(
        'Could not ask the Local Runner for LearnBlockchain status.',
      )
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
          ' is too old for LearnBlockchain. Update and restart the runner.',
      )
      return
    }

    window.localStorage.setItem(STORAGE_ACCOUNT, normalizedAccount)
    setAccount(normalizedAccount)
    setState('login')
    setMessage(
      'A local Chrome window is opening. Choose GitHub, MetaMask, email/password, phone, or WeChat login there; ButtonPost will wait for the final LearnBlockchain session.',
    )

    try {
      const response = await localRequest(
        runnerUrl,
        runnerToken,
        '/v1/platforms/learnblockchain/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: normalizedAccount }),
        },
      )
      const data = (await response.json()) as PlatformAuthResponse

      if (response.ok && data.authenticated) {
        setState('connected')
        setMessage(data.message || 'LearnBlockchain is connected.')
        return
      }

      setState(data.status === 'timeout' ? 'disconnected' : 'error')
      setMessage(
        data.error ||
          data.message ||
          'LearnBlockchain login did not complete.',
      )
    } catch {
      setState('error')
      setMessage(
        'The Local Runner lost the LearnBlockchain login request. Check the runner terminal for details.',
      )
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
          <h3>LearnBlockchain · 登链社区</h3>
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
                : 'Connect LearnBlockchain'}
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
        GitHub, email/password, phone and WeChat can be completed directly there. MetaMask
        requires MetaMask to be installed/unlocked in this dedicated profile once. ButtonPost
        never reads passwords, verification codes, seed phrases, private keys, or wallet signatures.
        Nothing is published during this step.
      </p>
    </div>
  )
}
