'use client'

import { useEffect, useState } from 'react'
import { JikeRunnerCard } from '@/components/jike-runner-card'
import { LearnBlockchainRunnerCard } from '@/components/learnblockchain-runner-card'
import { IndieHackersRunnerCard } from '@/components/indie-hackers-runner-card'

const DEFAULT_RUNNER_URL = 'http://127.0.0.1:27123'
const STORAGE_URL = 'buttonpost.runner.url'
const STORAGE_TOKEN = 'buttonpost.runner.token'
const STORAGE_XHS_ACCOUNT = 'buttonpost.xiaohongshu.account'

type RunnerState = 'idle' | 'checking' | 'connected' | 'error'
type PlatformState = 'unknown' | 'checking' | 'login' | 'connected' | 'disconnected' | 'error'

type HealthResponse = {
  ok?: boolean
  version?: string
  capabilities?: string[]
}

type EchoResponse = {
  ok?: boolean
  error?: string
}

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

export function LocalRunnerCard() {
  const [runnerUrl, setRunnerUrl] = useState(DEFAULT_RUNNER_URL)
  const [runnerToken, setRunnerToken] = useState('')
  const [state, setState] = useState<RunnerState>('idle')
  const [message, setMessage] = useState('Not connected')
  const [version, setVersion] = useState('')
  const [capabilities, setCapabilities] = useState<string[]>([])

  const [xhsAccount, setXhsAccount] = useState('default')
  const [xhsState, setXhsState] = useState<PlatformState>('unknown')
  const [xhsMessage, setXhsMessage] = useState('Connect the runner, then check your Xiaohongshu login.')

  useEffect(() => {
    const savedUrl = window.localStorage.getItem(STORAGE_URL)
    const savedToken = window.localStorage.getItem(STORAGE_TOKEN)
    const savedXhsAccount = window.localStorage.getItem(STORAGE_XHS_ACCOUNT)
    if (savedUrl) setRunnerUrl(savedUrl)
    if (savedToken) setRunnerToken(savedToken)
    if (savedXhsAccount) setXhsAccount(savedXhsAccount)
  }, [])

  async function checkXiaohongshu(
    url = runnerUrl,
    token = runnerToken,
    account = xhsAccount,
  ) {
    if (!url.trim() || !token.trim()) {
      setXhsState('error')
      setXhsMessage('Connect the Local Runner first.')
      return
    }

    const normalizedAccount = account.trim() || 'default'
    setXhsState('checking')
    setXhsMessage('Checking Xiaohongshu login stored on this computer...')

    try {
      const response = await localRequest(
        url,
        token,
        '/v1/platforms/xiaohongshu/status?account=' +
          encodeURIComponent(normalizedAccount),
      )
      const data = (await response.json()) as PlatformAuthResponse

      if (response.ok && data.authenticated) {
        window.localStorage.setItem(STORAGE_XHS_ACCOUNT, normalizedAccount)
        setXhsAccount(normalizedAccount)
        setXhsState('connected')
        setXhsMessage(data.message || 'Xiaohongshu login is valid.')
        return
      }

      setXhsState(response.status >= 500 ? 'error' : 'disconnected')
      setXhsMessage(
        data.error || data.message || 'Xiaohongshu is not connected.',
      )
    } catch {
      setXhsState('error')
      setXhsMessage('Could not ask the Local Runner for Xiaohongshu status.')
    }
  }

  async function connectRunner() {
    setState('checking')
    setMessage('Checking local runner...')
    setVersion('')
    setCapabilities([])

    const url = runnerUrl.trim().replace(/\/$/, '')
    const token = runnerToken.trim()

    if (!url || !token) {
      setState('error')
      setMessage('Runner URL and token are required.')
      return
    }

    try {
      const healthResponse = await fetch(
        url + '/health',
        loopbackInit({ method: 'GET', cache: 'no-store' }),
      )
      const health = (await healthResponse.json()) as HealthResponse

      if (!healthResponse.ok || !health.ok) {
        setState('error')
        setMessage('A service answered on the port, but it is not a healthy ButtonPost runner.')
        return
      }

      const echoResponse = await localRequest(url, token, '/v1/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'ButtonPost pairing check', content: '' }),
      })
      const echo = (await echoResponse.json()) as EchoResponse

      if (!echoResponse.ok || !echo.ok) {
        setState('error')
        setMessage(echo.error || 'Runner found, but pairing failed.')
        return
      }

      window.localStorage.setItem(STORAGE_URL, url)
      window.localStorage.setItem(STORAGE_TOKEN, token)
      setRunnerUrl(url)
      setRunnerToken(token)
      setVersion(health.version || '')
      setCapabilities(
        Array.isArray(health.capabilities) ? health.capabilities : [],
      )
      setState('connected')
      setMessage('Connected. Local browser publishers are available.')
      void checkXiaohongshu(url, token, xhsAccount)
    } catch {
      setState('error')
      setMessage(
        'Runner unavailable. Start npm run runner on this computer and allow local/loopback network access if your browser asks.',
      )
    }
  }

  async function loginXiaohongshu() {
    const account = xhsAccount.trim() || 'default'

    if (state !== 'connected') {
      setXhsState('error')
      setXhsMessage('Connect the Local Runner first.')
      return
    }

    window.localStorage.setItem(STORAGE_XHS_ACCOUNT, account)
    setXhsAccount(account)
    setXhsState('login')
    setXhsMessage(
      'A local Chrome window is opening. Complete Xiaohongshu login there; ButtonPost is waiting for confirmation.',
    )

    try {
      const response = await localRequest(
        runnerUrl,
        runnerToken,
        '/v1/platforms/xiaohongshu/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account }),
        },
      )
      const data = (await response.json()) as PlatformAuthResponse

      if (response.ok && data.authenticated) {
        setXhsState('connected')
        setXhsMessage(data.message || 'Xiaohongshu is connected.')
        return
      }

      setXhsState(data.status === 'timeout' ? 'disconnected' : 'error')
      setXhsMessage(data.error || data.message || 'Xiaohongshu login did not complete.')
    } catch {
      setXhsState('error')
      setXhsMessage(
        'The Local Runner lost the Xiaohongshu login request. Check the runner terminal for details.',
      )
    }
  }

  function forgetRunner() {
    window.localStorage.removeItem(STORAGE_URL)
    window.localStorage.removeItem(STORAGE_TOKEN)
    setRunnerUrl(DEFAULT_RUNNER_URL)
    setRunnerToken('')
    setState('idle')
    setVersion('')
    setCapabilities([])
    setMessage('Not connected')
    setXhsState('unknown')
    setXhsMessage('Connect the runner, then check your Xiaohongshu login.')
  }

  const stateLabel =
    state === 'connected'
      ? 'Connected' + (version ? ' · v' + version : '')
      : state === 'checking'
        ? 'Checking'
        : 'Offline'

  const xhsLabel =
    xhsState === 'connected'
      ? 'Connected'
      : xhsState === 'login'
        ? 'Waiting for login'
        : xhsState === 'checking'
          ? 'Checking'
          : xhsState === 'disconnected'
            ? 'Not connected'
            : xhsState === 'error'
              ? 'Error'
              : 'Unknown'

  const xhsBusy = xhsState === 'login' || xhsState === 'checking'

  return (
    <section className="runner-card">
      <div className="runner-heading">
        <div>
          <span className="eyebrow">Phase 5</span>
          <h2>Local Runner</h2>
          <p>
            Connect ButtonPost to this computer for platforms that need your browser session, local media, or QR login.
          </p>
        </div>
        <span className={'runner-state ' + state}>
          <span className="runner-state-dot" />
          {stateLabel}
        </span>
      </div>

      <div className="runner-fields">
        <label>
          <span>Runner URL</span>
          <input
            value={runnerUrl}
            onChange={(event) => setRunnerUrl(event.target.value)}
            spellCheck={false}
            inputMode="url"
          />
        </label>
        <label>
          <span>Runner token</span>
          <input
            type="password"
            value={runnerToken}
            onChange={(event) => setRunnerToken(event.target.value)}
            placeholder="Paste the token printed by npm run runner"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="runner-actions">
        <button type="button" onClick={connectRunner} disabled={state === 'checking'}>
          {state === 'checking' ? 'Connecting...' : 'Connect runner'}
        </button>
        <button type="button" className="secondary-button" onClick={forgetRunner}>
          Forget
        </button>
        <code>npm run runner</code>
      </div>

      <p className={'runner-message ' + (state === 'error' ? 'error' : '')}>{message}</p>
      <p className="runner-privacy">
        The runner token stays in this browser local storage and is sent only to <code>127.0.0.1</code>, not to the ButtonPost server.
      </p>

      <div className="local-platform-card">
        <div className="local-platform-header">
          <div>
            <span className="eyebrow">Local platform</span>
            <h3>Xiaohongshu · 小红书</h3>
          </div>
          <span className={'local-platform-status ' + xhsState}>{xhsLabel}</span>
        </div>

        <div className="local-platform-controls">
          <label>
            <span>Account name</span>
            <input
              value={xhsAccount}
              onChange={(event) => setXhsAccount(event.target.value)}
              disabled={xhsBusy}
              placeholder="default"
            />
          </label>
          <div className="local-platform-buttons">
            <button
              type="button"
              className="secondary-button"
              disabled={state !== 'connected' || xhsBusy}
              onClick={() => checkXiaohongshu()}
            >
              Check login
            </button>
            <button
              type="button"
              disabled={state !== 'connected' || xhsBusy}
              onClick={loginXiaohongshu}
            >
              {xhsState === 'login'
                ? 'Waiting...'
                : xhsState === 'connected'
                  ? 'Reconnect'
                  : 'Connect Xiaohongshu'}
            </button>
          </div>
        </div>

        <p className={'local-platform-message ' + (xhsState === 'error' ? 'error' : '')}>
          {xhsMessage}
        </p>
        <p className="runner-privacy">
          Login runs in a local Chrome profile under <code>~/.buttonpost</code>. Nothing is published during this step.
        </p>
      </div>

      <JikeRunnerCard
        runnerUrl={runnerUrl}
        runnerToken={runnerToken}
        runnerConnected={state === 'connected'}
        runnerSupported={capabilities.includes('jike:auth')}
        runnerVersion={version}
      />

      <LearnBlockchainRunnerCard
        runnerUrl={runnerUrl}
        runnerToken={runnerToken}
        runnerConnected={state === 'connected'}
        runnerSupported={capabilities.includes('learnblockchain:auth')}
        runnerVersion={version}
      />

      <IndieHackersRunnerCard
        runnerUrl={runnerUrl}
        runnerToken={runnerToken}
        runnerConnected={state === 'connected'}
        runnerSupported={capabilities.includes('indiehackers:auth')}
        runnerVersion={version}
      />
    </section>
  )
}
