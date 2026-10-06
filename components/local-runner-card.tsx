'use client'

import { useEffect, useState } from 'react'

const DEFAULT_RUNNER_URL = 'http://127.0.0.1:27123'
const STORAGE_URL = 'buttonpost.runner.url'
const STORAGE_TOKEN = 'buttonpost.runner.token'

type RunnerState = 'idle' | 'checking' | 'connected' | 'error'

type HealthResponse = {
  ok?: boolean
  version?: string
}

type EchoResponse = {
  ok?: boolean
  error?: string
}

type LoopbackRequestInit = RequestInit & {
  targetAddressSpace?: 'loopback'
}

function loopbackInit(init: RequestInit = {}): LoopbackRequestInit {
  return { ...init, targetAddressSpace: 'loopback' }
}

export function LocalRunnerCard() {
  const [runnerUrl, setRunnerUrl] = useState(DEFAULT_RUNNER_URL)
  const [runnerToken, setRunnerToken] = useState('')
  const [state, setState] = useState<RunnerState>('idle')
  const [message, setMessage] = useState('Not connected')
  const [version, setVersion] = useState('')

  useEffect(() => {
    const savedUrl = window.localStorage.getItem(STORAGE_URL)
    const savedToken = window.localStorage.getItem(STORAGE_TOKEN)
    if (savedUrl) setRunnerUrl(savedUrl)
    if (savedToken) setRunnerToken(savedToken)
  }, [])

  async function connectRunner() {
    setState('checking')
    setMessage('Checking local runner...')
    setVersion('')

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

      const echoResponse = await fetch(
        url + '/v1/echo',
        loopbackInit({
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: 'ButtonPost pairing check', content: '' }),
          cache: 'no-store',
        }),
      )
      const echo = (await echoResponse.json()) as EchoResponse

      if (!echoResponse.ok || !echo.ok) {
        setState('error')
        setMessage(echo.error || 'Runner found, but pairing failed.')
        return
      }

      window.localStorage.setItem(STORAGE_URL, url)
      window.localStorage.setItem(STORAGE_TOKEN, token)
      setRunnerUrl(url)
      setVersion(health.version || '')
      setState('connected')
      setMessage('Connected. Local browser publishers can be added next.')
    } catch {
      setState('error')
      setMessage(
        'Runner unavailable. Start npm run runner on this computer and allow local/loopback network access if your browser asks.',
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
    setMessage('Not connected')
  }

  const stateLabel =
    state === 'connected'
      ? 'Connected' + (version ? ' · v' + version : '')
      : state === 'checking'
        ? 'Checking'
        : 'Offline'

  return (
    <section className="runner-card">
      <div className="runner-heading">
        <div>
          <span className="eyebrow">Phase 2</span>
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
    </section>
  )
}
