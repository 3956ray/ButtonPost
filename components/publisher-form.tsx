'use client'

import { uploadPresigned } from '@vercel/blob/client'
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { markdownToPlainText } from '@/lib/content/markdown-to-plain'
import { PublicationHistory } from '@/components/publication-history'
import {
  PUBLICATION_HISTORY_KEY,
  parsePublicationHistory,
  prependHistoryEntry,
  updateHistoryResults,
  type PublicationHistoryEntry,
  type PublicationHistoryResult,
} from '@/lib/publication-history'
import type {
  PlatformId,
  PlatformMetadata,
  PublishResult,
  SourceMedia,
} from '@/lib/publishers/types'

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
  status: 'published' | 'reviewing' | 'failed' | 'skipped'
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

function safeUploadName(file: File, index: number) {
  const cleaned = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120)
  return `buttonpost/${Date.now()}-${index + 1}-${cleaned || 'image'}`
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
  const [mediaProgress, setMediaProgress] = useState('')
  const [history, setHistory] = useState<PublicationHistoryEntry[]>([])
  const historyRef = useRef<PublicationHistoryEntry[]>([])
  const [imageInputKey, setImageInputKey] = useState(0)

  useEffect(() => {
    const loaded = parsePublicationHistory(
      window.localStorage.getItem(PUBLICATION_HISTORY_KEY),
    )
    historyRef.current = loaded
    setHistory(loaded)
  }, [])

  const sourceLength = useMemo(() => content.trim().length, [content])

  function persistHistory(next: PublicationHistoryEntry[]) {
    historyRef.current = next
    setHistory(next)

    try {
      window.localStorage.setItem(PUBLICATION_HISTORY_KEY, JSON.stringify(next))
    } catch {
      // Publishing should keep working even if browser storage is unavailable.
    }
  }

  function addHistoryEntry(entry: PublicationHistoryEntry) {
    persistHistory(prependHistoryEntry(historyRef.current, entry))
  }

  function mergeHistoryResults(
    id: string,
    incoming: PublicationHistoryResult[],
  ) {
    persistHistory(updateHistoryResults(historyRef.current, id, incoming))
  }

  function clearHistory() {
    if (!window.confirm('Clear publication history from this browser?')) return

    historyRef.current = []
    setHistory([])
    window.localStorage.removeItem(PUBLICATION_HISTORY_KEY)
  }

  function reuseHistoryEntry(entry: PublicationHistoryEntry) {
    setTitle(entry.title)
    setContent(entry.content)
    setSelected([...entry.selected])
    setImages([])
    setImageInputKey((value) => value + 1)
    setResults([])
    setMediaProgress('')
    setError(
      entry.imageNames.length
        ? 'Text and destinations were restored. Browsers cannot restore local image files from history, so reselect the images before publishing again.'
        : '',
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function togglePlatform(id: DestinationId) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((platformId) => platformId !== id)
        : [...current, id],
    )
  }

  function upsertResults(next: DisplayPublishResult[]) {
    setResults((current) => {
      const map = new Map<DisplayPublishResult['platform'], DisplayPublishResult>()
      for (const result of current) map.set(result.platform, result)
      for (const result of next) map.set(result.platform, result)
      return [...map.values()]
    })
  }

  function onImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const next = Array.from(event.target.files ?? [])
    if (next.length > 9) {
      setImages(next.slice(0, 9))
      setError(
        'ButtonPost currently accepts at most 9 source images; the first 9 were kept.',
      )
      return
    }

    setError('')
    setImages(next)
  }

  async function uploadImagesForServerPlatforms(): Promise<SourceMedia[]> {
    if (!images.length) return []

    if (!secret.trim()) {
      throw new Error(
        'Publish key is required before ButtonPost can upload images for X or DEV.',
      )
    }

    setMediaProgress('Preparing media upload...')

    try {
      const ticketResponse = await fetch('/api/media/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      })
      const ticketData = (await ticketResponse.json().catch(() => ({}))) as {
        ticket?: string
        error?: string
      }

      if (!ticketResponse.ok || !ticketData.ticket) {
        throw new Error(
          ticketData.error ||
            'ButtonPost could not create a temporary media upload ticket.',
        )
      }

      setMediaProgress('Uploading source images for X / DEV...')

      return await Promise.all(
        images.map(async (image, index) => {
          const blob = await uploadPresigned(safeUploadName(image, index), image, {
            access: 'public',
            handleUploadUrl: '/api/media/upload',
            clientPayload: JSON.stringify({ ticket: ticketData.ticket }),
            multipart: image.size > 4 * 1024 * 1024,
          })

          return {
            url: blob.url,
            name: image.name,
            contentType: image.type || undefined,
          }
        }),
      )
    } catch (cause) {
      throw new Error(
        'Could not upload images for X / DEV. Connect a public Vercel Blob store to ButtonPost so BLOB_STORE_ID (OIDC) or BLOB_READ_WRITE_TOKEN is available. ' +
          (cause instanceof Error ? cause.message : ''),
      )
    } finally {
      setMediaProgress('')
    }
  }

  async function publishServerPlatforms(
    serverPlatforms: PlatformId[],
    media: SourceMedia[],
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
          media,
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

  async function publishServerFlow(
    serverPlatforms: PlatformId[],
  ): Promise<DisplayPublishResult[]> {
    if (!serverPlatforms.length) return []

    try {
      const media = images.length ? await uploadImagesForServerPlatforms() : []
      return await publishServerPlatforms(serverPlatforms, media)
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Could not prepare server media.'
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

    const runnerUrl = window.localStorage
      .getItem(RUNNER_URL_KEY)
      ?.replace(/\/$/, '')
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
    setMediaProgress('')

    const historyId =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`

    addHistoryEntry({
      id: historyId,
      createdAt: new Date().toISOString(),
      title: title.trim(),
      content,
      imageNames: images.map((image) => image.name),
      selected: [...selected],
      results: selected.map((platform) => ({
        platform,
        status: 'pending',
      })),
    })

    const serverPlatforms = selected.filter(
      (id): id is PlatformId => id !== 'xiaohongshu',
    )
    const wantsXiaohongshu = selected.includes('xiaohongshu')

    if (wantsXiaohongshu) {
      const reviewingResult: LocalPublishResult = {
        platform: 'xiaohongshu',
        status: 'reviewing',
        externalId:
          'ButtonPost filled the Xiaohongshu editor. Review it in Chrome and click Publish manually.',
      }
      upsertResults([reviewingResult])
      mergeHistoryResults(historyId, [reviewingResult])
    }

    const tasks: Promise<void>[] = []

    if (serverPlatforms.length) {
      tasks.push(
        publishServerFlow(serverPlatforms).then((serverResults) => {
          upsertResults(serverResults)
          mergeHistoryResults(historyId, serverResults)
        }),
      )
    }

    if (wantsXiaohongshu) {
      tasks.push(
        publishXiaohongshu().then((xiaohongshuResult) => {
          upsertResults([xiaohongshuResult])
          mergeHistoryResults(historyId, [xiaohongshuResult])
        }),
      )
    }

    try {
      await Promise.all(tasks)
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : 'Unexpected publish orchestration error.'
      setError(message)

      const attempt = historyRef.current.find((entry) => entry.id === historyId)
      const unresolved =
        attempt?.results
          .filter((result) => result.status === 'pending')
          .map((result) => ({
            ...result,
            status: 'failed' as const,
            error: message,
          })) ?? []

      if (unresolved.length) mergeHistoryResults(historyId, unresolved)
    } finally {
      setSubmitting(false)
      setMediaProgress('')
    }
  }
  return (
    <>
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
            key={imageInputKey}
            className="file-input"
            id="images"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={onImagesChange}
          />
          <p className="helper">
            One source image set. X attaches up to 4 images, DEV stores the images in the article, and Xiaohongshu sends them directly to your Local Runner. Up to 9 source images are accepted.
          </p>
          {mediaProgress ? <p className="media-progress">{mediaProgress}</p> : null}
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
              <span className="platform-note">Local Runner · review before publish</span>
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
            Used for X / DEV publishing and server media uploads. Xiaohongshu media goes only to your Local Runner.
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

      <PublicationHistory
        entries={history}
        onReuse={reuseHistoryEntry}
        onClear={clearHistory}
      />
    </>
  )
}
