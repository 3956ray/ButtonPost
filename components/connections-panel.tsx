'use client'

import { useState } from 'react'

type ConnectionView = {
  platform: 'x' | 'devto'
  status: string
  externalUsername: string | null
}

type Props = {
  initialConnections: ConnectionView[]
  notice?: string | null
}

function findConnection(
  connections: ConnectionView[],
  platform: ConnectionView['platform'],
) {
  return connections.find(
    (connection) =>
      connection.platform === platform && connection.status === 'connected',
  )
}

export function ConnectionsPanel({
  initialConnections,
  notice,
}: Props) {
  const [connections, setConnections] = useState(initialConnections)
  const [devApiKey, setDevApiKey] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState(notice ?? '')
  const [error, setError] = useState('')

  const x = findConnection(connections, 'x')
  const devto = findConnection(connections, 'devto')

  async function disconnect(platform: 'x' | 'devto') {
    setBusy(platform)
    setError('')
    setMessage('')

    try {
      const response = await fetch(`/api/connections/${platform}`, {
        method: 'DELETE',
      })
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error || `Could not disconnect ${platform}.`)
      }

      setConnections((current) =>
        current.filter((connection) => connection.platform !== platform),
      )
      setMessage(platform === 'x' ? 'X disconnected.' : 'DEV disconnected.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Disconnect failed.')
    } finally {
      setBusy(null)
    }
  }

  async function connectDev() {
    setBusy('devto')
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/connections/devto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: devApiKey }),
      })
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        connection?: ConnectionView
      }

      if (!response.ok || !data.connection) {
        throw new Error(data.error || 'Could not connect DEV.')
      }

      setConnections((current) => [
        ...current.filter((connection) => connection.platform !== 'devto'),
        data.connection!,
      ])
      setDevApiKey('')
      setMessage(`DEV connected as @${data.connection.externalUsername}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'DEV connection failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="connections-grid">
      {message ? <p className="connection-banner success">{message}</p> : null}
      {error ? <p className="connection-banner error">{error}</p> : null}

      <section className="connection-card">
        <div className="connection-card-head">
          <div>
            <span className="eyebrow">API connection</span>
            <h2>X</h2>
          </div>
          <span className={`connection-state ${x ? 'connected' : ''}`}>
            {x ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <p>
          OAuth authorization happens on X. ButtonPost stores only the resulting
          user access token and secret, encrypted at rest.
        </p>

        {x ? (
          <div className="connection-actions">
            <strong>@{x.externalUsername || 'connected account'}</strong>
            <button
              type="button"
              className="secondary-button"
              disabled={busy === 'x'}
              onClick={() => disconnect('x')}
            >
              {busy === 'x' ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <div className="connection-actions">
            <a className="connection-primary" href="/api/connections/x/start">
              Connect X
            </a>
          </div>
        )}
      </section>

      <section className="connection-card">
        <div className="connection-card-head">
          <div>
            <span className="eyebrow">API connection</span>
            <h2>DEV Community</h2>
          </div>
          <span className={`connection-state ${devto ? 'connected' : ''}`}>
            {devto ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <p>
          DEV currently authenticates publishing with a personal API key. The key
          is verified server-side, then encrypted before storage.
        </p>

        {devto ? (
          <div className="connection-actions">
            <strong>@{devto.externalUsername || 'connected account'}</strong>
            <button
              type="button"
              className="secondary-button"
              disabled={busy === 'devto'}
              onClick={() => disconnect('devto')}
            >
              {busy === 'devto' ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <>
            <label className="connection-field">
              <span>DEV API key</span>
              <input
                type="password"
                value={devApiKey}
                onChange={(event) => setDevApiKey(event.target.value)}
                autoComplete="off"
                placeholder="Paste your DEV Community API key"
              />
            </label>
            <div className="connection-actions">
              <button
                type="button"
                className="connection-primary"
                disabled={busy === 'devto' || !devApiKey.trim()}
                onClick={connectDev}
              >
                {busy === 'devto' ? 'Connecting…' : 'Connect DEV'}
              </button>
              <a
                className="connection-help"
                href="https://dev.to/settings/extensions"
                target="_blank"
                rel="noreferrer"
              >
                Create an API key ↗
              </a>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
