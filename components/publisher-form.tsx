'use client'

import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { markdownToPlainText } from '@/lib/content/markdown-to-plain'
import type { PlatformId, PlatformMetadata, PublishResult } from '@/lib/publishers/types'

type Props = {
  platforms: PlatformMetadata[]
}

type ApiResponse = {
  results?: PublishResult[]
  error?: string
}

type DestinationId = PlatformId | 'xiaohongshu'

type LocalPublishResult = {
  platform: 'xiaohongshu'
  status: 'published' | 'failed' | 'skipped'
  externalId?: string
  externalUrl?: string
  error?: string
}

type DisplayPublishResult = PublishResult | LocalPublishResult

type LocalRunnerResponse = {
  ok?: boolean
  status?: string
  message?: string
  error?: string
}

type LoopbackRequestInit = RequestInit & {
  targetAddressSpace?: 'loopback'
}

const RUNNER_URL_KEY = 'buttonpost.runner.url'
const RUNNER_TOKEN_KEY = 'buttonpost.runner.token'
const XHS_ACCOUNT_KEY = 'buttonpost.xiaohongshu.account'

function loopbackInit(init: RequestInit = {}): LoopbackRequestInit {
  return { ...init, targetAddressSpace: 'loopback' }
}

function platformLabel(id: DisplayPublishResult['platform']) {
  if (id === 'devto') return 'DEV'
  if (id === 'xiaohongshu') return '小红书'
  return 'X'
}

export function PublisherForm({ platforms }: Props) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [secret, setSecret] = useState('')
  const [selected, setSelected] = useState<DestinationId[]>(
    platforms.map((platform) => platform.id),
  )
  const [results, setResults] = useState<DisplayPublishResult[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const sourceLength = useMemo(() => content.trim().length, [content])

  function togglePlatform(id: DestinationId) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((platformId) => platformId !== id)
        : [...current, id],
    )
  }

  function onImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const next = Array.from(event.target.files ?? [])
    if (next.length > 9) {
      setImages(next.slice(0, 9))
      setError('ButtonPost currently sends at most 9 images to Xiaohongshu; the first 9 were kept.')
      return
    }
    setError('')
    setImages(next)
  }

  async function publishServerPlatforms(
    serverPlatforms: PlatformId[],
  ): Promise<DisplayPublishResult[]> {
    if (!serverPlatforms.length) return []

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          platforms: serverPlatforms,
          secret,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as ApiResponse

      if (!response.ok) {
        const message = data.error ?? 'ButtonPost server publish request failed.'
        return serverPlatforms.map((platform) => ({
          platform,
          status: 'failed',
          error: message,
        }))
      }

      return data.results ?? []
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Unexpected ButtonPost server error.'
      return serverPlatforms.map((platform) => ({
        platform,
        status: 'failed',
        error: message,
      }))
    }
  }

  async function publishXiaohongshu(): Promise<LocalPublishResult> {
    if (!images.length) {
      return {
        platform: 'xiaohongshu',
        status: 'failed',
        error: 'Xiaohongshu image-note publishing requires at least one image.',
      }
    }

    const runnerUrl = window.localStorage.getItem(RUNNER_URL_KEY)?.replace(/\/$/, '')
    const runnerToken = window.localStorage.getItem(RUNNER_TOKEN_KEY)
    const account = window.localStorage.getItem(XHS_ACCOUNT_KEY) || 'default'

    if (!runnerUrl || !runnerToken) {
      return {
        platform: 'xiaohongshu',
        status: 'failed',
        error: 'Connect the ButtonPost Local Runner before publishing to Xiaohongshu.',
      }
    }

    const form = new FormData()
    form.append('account', account)
    form.append('title', title.trim())
    form.append('content', markdownToPlainText(content))
    for (const image of images) form.append('images', image, image.name)

    try {
      const response = await fetch(
        runnerUrl + '/v1/platforms/xiaohongshu/publish-note',
        loopbackInit({
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + runnerToken,
          },
          body: form,
          cache: 'no-store',
        }),
      )
      const data = (await response.json().catch(() => ({}))) as LocalRunnerResponse

      if (!response.ok || !data.ok || data.status !== 'published') {
        return {
          platform: 'xiaohongshu',
          status: 'failed',
          error:
            data.error ||
            data.message ||
            'The Local Runner could not publish the Xiaohongshu image note.',
        }
      }

      return {
        platform: 'xiaohongshu',
        status: 'published',
        externalId: data.message || 'Published via Local Runner',
      }
    } catch (cause) {
      return {
        platform: 'xiaohongshu',
        status: 'failed',
        error:
          cause instanceof Error
            ? cause.message
            : 'Could not reach the Local Runner for Xiaohongshu.',
      }
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setResults([])

    try {
      const serverPlatforms = selected.filter(
        (id): id is PlatformId => id !== 'xiaohongshu',
      )
      const wantsXiaohongshu = selected.includes('xiaohongshu')

      const [serverResults, xiaohongshuResult] = await Promise.all([
        publishServerPlatforms(serverPlatforms),
        wantsXiaohongshu ? publishXiaohongshu() : Promise.resolve(null),
      ])

      setResults(
        xiaohongshuResult
          ? [...serverResults, xiaohongshuResult]
          : serverResults,
      )
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unexpected publish orchestration error.',
      )
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
          placeholder="Write once here. Markdown is preserved for DEV and mechanically normalized for plain-text platforms."
          required
        />
        <div className="editor-meta">
          <span>Markdown source</span>
          <span>{sourceLength} source characters</span>
        </div>

        <div className="media-field">
          <label className="label" htmlFor="images">Images</label>
          <input
            className="file-input"
            id="images"
            type="file"
            accept="image/*"
            multiple
            onChange={onImagesChange}
          />
          <p className="helper">
            Optional for X / DEV in this MVP. Required when Xiaohongshu is selected. Images sent to Xiaohongshu go directly from this browser to your Local Runner.
          </p>
          {images.length > 0 ? (
            <div className="media-summary">
              <strong>{images.length} image{images.length === 1 ? '' : 's'} selected</strong>
              <span>{images.map((image) => image.name).join(' · ')}</span>
            </div>
          ) : null}
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
                  <span className={'dot ' + (platform.configured ? '' : 'off')} />
                  {platform.name}
                </span>
                <span className="platform-note">
                  {platform.configured
                    ? platform.mode
                    : 'Needs ' + platform.requiredEnv.join(' + ')}
                </span>
              </span>
            </label>
          ))}

          <label className="platform">
            <input
              type="checkbox"
              checked={selected.includes('xiaohongshu')}
              onChange={() => togglePlatform('xiaohongshu')}
            />
            <span className="platform-copy">
              <span className="platform-name">
                <span className="dot local" />
                Xiaohongshu · 小红书
              </span>
              <span className="platform-note">Local Runner · image note</span>
            </span>
          </label>
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
          <p className="helper">
            Used only for server publishers such as X and DEV. Local Runner publishing does not send this key to Xiaohongshu.
          </p>
        </div>

        {selected.includes('xiaohongshu') && images.length === 0 ? (
          <p className="selection-warning">
            Xiaohongshu is selected but no image is attached. X / DEV can still publish; Xiaohongshu will report a separate failure.
          </p>
        ) : null}

        <button
          className="publish-button"
          type="submit"
          disabled={
            submitting ||
            selected.length === 0 ||
            !title.trim() ||
            !content.trim()
          }
        >
          {submitting ? 'Publishing…' : 'Publish everywhere (' + selected.length + ')'}
        </button>
      </aside>

      {error ? <div className="error-banner">{error}</div> : null}

      {results.length > 0 ? (
        <section className="results" aria-live="polite">
          <h2>Publication results</h2>
          <div className="result-list">
            {results.map((result) => (
              <div className="result" key={result.platform}>
                <strong>{platformLabel(result.platform)}</strong>
                <span className={'status ' + result.status}>{result.status}</span>
                <span className="result-detail">
                  {result.externalUrl ? (
                    <a href={result.externalUrl} target="_blank" rel="noreferrer">
                      Open published post ↗
                    </a>
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
