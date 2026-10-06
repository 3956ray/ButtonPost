'use client'

import { FormEvent, useMemo, useState } from 'react'
import type { PlatformId, PlatformMetadata, PublishResult } from '@/lib/publishers/types'

type Props = {
  platforms: PlatformMetadata[]
}

type ApiResponse = {
  results?: PublishResult[]
  error?: string
}

export function PublisherForm({ platforms }: Props) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [secret, setSecret] = useState('')
  const [selected, setSelected] = useState<PlatformId[]>(platforms.map((platform) => platform.id))
  const [results, setResults] = useState<PublishResult[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const xLength = useMemo(() => content.trim().length, [content])

  function togglePlatform(id: PlatformId) {
    setSelected((current) =>
      current.includes(id) ? current.filter((platformId) => platformId !== id) : [...current, id],
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setResults([])

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, platforms: selected, secret }),
      })
      const data = (await response.json()) as ApiResponse

      if (!response.ok) {
        setError(data.error ?? 'Publish request failed.')
        return
      }

      setResults(data.results ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unexpected network error.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="composer" onSubmit={onSubmit}>
      <section className="editor-pane">
        <label className="label" htmlFor="title">Title</label>
        <input
          className="input"
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="A clear title for article-style platforms"
          maxLength={180}
          required
        />

        <label className="label" htmlFor="content">Post</label>
        <textarea
          className="textarea"
          id="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write once here. Markdown is preserved for DEV and normalized to plain text for X."
          required
        />
        <div className="editor-meta">
          <span>Markdown source</span>
          <span>{xLength} source characters</span>
        </div>
      </section>

      <aside className="side-pane">
        <h2 className="section-title">Publish to</h2>
        <div className="platform-list">
          {platforms.map((platform) => (
            <label className="platform" key={platform.id}>
              <input
                type="checkbox"
                checked={selected.includes(platform.id)}
                onChange={() => togglePlatform(platform.id)}
              />
              <span className="platform-copy">
                <span className="platform-name">
                  <span className={`dot ${platform.configured ? '' : 'off'}`} />
                  {platform.name}
                </span>
                <span className="platform-note">
                  {platform.configured ? platform.mode : `Needs ${platform.requiredEnv.join(' + ')}`}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="secret-wrap">
          <label className="label" htmlFor="secret">Publish key</label>
          <input
            className="secret-input"
            id="secret"
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            autoComplete="off"
            placeholder="BUTTONPOST_SECRET"
          />
          <p className="helper">The key is sent only to the server for this publish request and is not stored by ButtonPost.</p>
        </div>

        <button
          className="publish-button"
          type="submit"
          disabled={submitting || selected.length === 0 || !title.trim() || !content.trim()}
        >
          {submitting ? 'Publishing…' : `Publish everywhere (${selected.length})`}
        </button>
      </aside>

      {error ? <div className="error-banner">{error}</div> : null}

      {results.length > 0 ? (
        <section className="results" aria-live="polite">
          <h2>Publication results</h2>
          <div className="result-list">
            {results.map((result) => (
              <div className="result" key={result.platform}>
                <strong>{result.platform === 'devto' ? 'DEV' : 'X'}</strong>
                <span className={`status ${result.status}`}>{result.status}</span>
                <span className="result-detail">
                  {result.externalUrl ? (
                    <a href={result.externalUrl} target="_blank" rel="noreferrer">Open published post ↗</a>
                  ) : (
                    result.error ?? result.externalId ?? 'No additional details.'
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </form>
  )
}
