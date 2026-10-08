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
  getFailedHistoryPlatforms,
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
  connectedPlatforms: PlatformId[]
  signedIn: boolean
}

type ApiResponse = {
  results?: PublishResult[]
  error?: string
}

type DestinationId = PlatformId | 'xiaohongshu' | 'jike' | 'learnblockchain' | 'indiehackers'

type LocalPublishResult = {
  platform: 'xiaohongshu' | 'jike' | 'learnblockchain' | 'indiehackers'
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
  externalId?: string
  externalUrl?: string
}

type LoopbackRequestInit = RequestInit & {
  targetAddressSpace?: 'loopback'
}

const RUNNER_URL_KEY = 'buttonpost.runner.url'
const RUNNER_TOKEN_KEY = 'buttonpost.runner.token'
const XHS_ACCOUNT_KEY = 'buttonpost.xiaohongshu.account'
const JIKE_ACCOUNT_KEY = 'buttonpost.jike.account'
const LEARNBLOCKCHAIN_ACCOUNT_KEY = 'buttonpost.learnblockchain.account'
const INDIE_HACKERS_ACCOUNT_KEY = 'buttonpost.indiehackers.account'
const ACTIVE_LOCAL_DESTINATIONS = ['xiaohongshu', 'jike', 'learnblockchain'] as const
const ACTIVE_DESTINATION_SET = new Set<DestinationId>(ACTIVE_LOCAL_DESTINATIONS)

function loopbackInit(init: RequestInit = {}): LoopbackRequestInit {
  return { ...init, targetAddressSpace: 'loopback' }
}

function platformLabel(id: DisplayPublishResult['platform']) {
  if (id === 'devto') return 'DEV'
  if (id === 'xiaohongshu') return '小红书'
  if (id === 'jike') return '即刻'
  if (id === 'learnblockchain') return '登链社区'
  if (id === 'indiehackers') return 'Indie Hackers'
  return 'X'
}

function safeUploadName(prefix: string, file: File, index: number) {
  const cleaned = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120)
  return `${prefix}${Date.now()}-${index + 1}-${cleaned || 'image'}`
}

export function PublisherForm({
  platforms,
  connectedPlatforms,
  signedIn,
}: Props) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [selected, setSelected] = useState<DestinationId[]>(() => [
    ...platforms
      .filter(
        (platform) =>
          platform.configured && connectedPlatforms.includes(platform.id),
      )
      .map((platform) => platform.id),
  ])
  const [results, setResults] = useState<DisplayPublishResult[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mediaProgress, setMediaProgress] = useState('')
  const [history, setHistory] = useState<PublicationHistoryEntry[]>([])
  const historyRef = useRef<PublicationHistoryEntry[]>([])
  const [imageInputKey, setImageInputKey] = useState(0)
  const [localReady, setLocalReady] = useState<Record<string, boolean>>({})
  const [retryNotice, setRetryNotice] = useState('')
  const latestFiles = useRef<{ id: string; files: File[] } | null>(null)

  useEffect(() => {
    const loaded = parsePublicationHistory(
      window.localStorage.getItem(PUBLICATION_HISTORY_KEY),
    )
    historyRef.current = loaded
    setHistory(loaded)
  }, [])

  // Local destinations require a paired runner and verified platform authentication.
  useEffect(() => {
    let cancelled = false
    let requestId = 0
    async function refreshLocalReadiness() {
      const id = ++requestId
      const url = window.localStorage.getItem(RUNNER_URL_KEY)
      const token = window.localStorage.getItem(RUNNER_TOKEN_KEY)
      const ready: Record<string, boolean> = {}
      if (url && token) {
        const headers = { Authorization: 'Bearer ' + token }
        const base = url.replace(/\/$/, '')
        try {
          const parsed = new URL(base)
          if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
            throw new Error('Runner must bind to loopback')
          }
          const echo = await fetch(base + '/v1/echo', loopbackInit({
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Readiness check', content: '' }),
            cache: 'no-store',
          }))
          if (!echo.ok) throw new Error('Runner pairing invalid')
          await Promise.all(ACTIVE_LOCAL_DESTINATIONS.map(async platform => {
            const key = platform === 'xiaohongshu' ? XHS_ACCOUNT_KEY :
              platform === 'jike' ? JIKE_ACCOUNT_KEY : LEARNBLOCKCHAIN_ACCOUNT_KEY
            try {
              const account = window.localStorage.getItem(key) || 'default'
              const response = await fetch(base + '/v1/platforms/' + platform +
                '/status?account=' + encodeURIComponent(account),
                loopbackInit({ headers, cache: 'no-store' }))
              const data = await response.json() as { authenticated?: boolean }
              ready[platform] = response.ok && data.authenticated === true
            } catch {
              ready[platform] = false
            }
          }))
        } catch {
          // Cloud destinations stay usable even if the optional local runner is offline.
        }
      }
      if (!cancelled && id === requestId) {
        setLocalReady(ready)
        setSelected(current => current.filter(platform =>
          !ACTIVE_DESTINATION_SET.has(platform) || ready[platform]))
      }
    }
    const onRefresh = () => { void refreshLocalReadiness() }
    window.addEventListener('buttonpost:local-readiness-refresh', onRefresh)
    void refreshLocalReadiness()
    return () => {
      cancelled = true
      requestId += 1
      window.removeEventListener('buttonpost:local-readiness-refresh', onRefresh)
    }
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
    const serverPlatformIds = new Set<DestinationId>(
      platforms
        .filter(
          (platform) =>
            platform.configured && connectedPlatforms.includes(platform.id),
        )
        .map((platform) => platform.id),
    )
    setSelected(
      entry.selected.filter(
        (platform) =>
          serverPlatformIds.has(platform) || (ACTIVE_DESTINATION_SET.has(platform) && localReady[platform] === true),
      ),
    )
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

  // Explicit review before retry: remote timeouts can disguise a successful post.
  function retryFailed(entry: PublicationHistoryEntry) {
    const failed = getFailedHistoryPlatforms(entry)
    const available = failed.filter(platform => {
      if (ACTIVE_DESTINATION_SET.has(platform)) return localReady[platform] === true
      return connectedPlatforms.includes(platform as PlatformId)
    })
    const retained = latestFiles.current?.id === entry.id ? latestFiles.current.files : []
    const originalImagesMatch = retained.length === entry.imageNames.length &&
      entry.imageNames.every((name, index) => retained[index]?.name === name)

    setTitle(entry.title)
    setContent(entry.content)
    setSelected(available as DestinationId[])
    setImages(originalImagesMatch ? [...retained] : [])
    setImageInputKey(key => key + 1)
    setResults([])
    setRetryNotice(
      'Only failed destinations are selected. Verify whether a timed-out post actually went live before publishing again.' +
      (available.length < failed.length ? ' Reconnect unavailable destinations first.' : '') +
      (!originalImagesMatch && entry.imageNames.length > 0 ? ' Reattach original images before retrying.' : ''),
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

    setMediaProgress('Preparing media upload...')

    try {
      const ticketResponse = await fetch('/api/media/ticket', {
        method: 'POST',
      })
      const ticketData = (await ticketResponse.json().catch(() => ({}))) as {
        ticket?: string
        prefix?: string
        error?: string
      }

      if (!ticketResponse.ok || !ticketData.ticket || !ticketData.prefix) {
        throw new Error(
          ticketData.error ||
            'ButtonPost could not create a temporary media upload ticket.',
        )
      }

      setMediaProgress('Uploading source images for X / DEV...')

      return await Promise.all(
        images.map(async (image, index) => {
          const blob = await uploadPresigned(
            safeUploadName(ticketData.prefix!, image, index),
            image,
            {
            access: 'public',
            handleUploadUrl: '/api/media/upload',
            clientPayload: JSON.stringify({ ticket: ticketData.ticket }),
              multipart: image.size > 4 * 1024 * 1024,
            },
          )

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


  async function publishJike(): Promise<LocalPublishResult> {
    const unsupportedImage = images.find(
      (image) => !['image/jpeg', 'image/png'].includes(image.type),
    )

    if (unsupportedImage) {
      return {
        platform: 'jike',
        status: 'failed',
        error:
          'Jike currently accepts JPEG/PNG images in ButtonPost. Unsupported file: ' +
          unsupportedImage.name,
      }
    }

    const runnerUrl = window.localStorage
      .getItem(RUNNER_URL_KEY)
      ?.replace(/\/$/, '')
    const runnerToken = window.localStorage.getItem(RUNNER_TOKEN_KEY)
    const account = window.localStorage.getItem(JIKE_ACCOUNT_KEY) || 'default'

    if (!runnerUrl || !runnerToken) {
      return {
        platform: 'jike',
        status: 'failed',
        error: 'Connect the ButtonPost Local Runner before publishing to Jike.',
      }
    }

    const form = new FormData()
    form.append('account', account)
    form.append('content', markdownToPlainText(content))
    for (const image of images) form.append('images', image, image.name)

    try {
      const response = await fetch(
        runnerUrl + '/v1/platforms/jike/publish-post',
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
          platform: 'jike',
          status: 'failed',
          error:
            data.error ||
            data.message ||
            'The Local Runner could not publish the Jike post.',
        }
      }

      return {
        platform: 'jike',
        status: 'published',
        externalId: data.message || 'Published via Local Runner',
        externalUrl:
          typeof (data as LocalRunnerResponse & { externalUrl?: string }).externalUrl ===
          'string'
            ? (data as LocalRunnerResponse & { externalUrl?: string }).externalUrl
            : undefined,
      }
    } catch (cause) {
      return {
        platform: 'jike',
        status: 'failed',
        error:
          cause instanceof Error
            ? cause.message
            : 'Could not reach the Local Runner for Jike.',
      }
    }
  }


  async function publishLearnBlockchain(): Promise<LocalPublishResult> {
    const runnerUrl = window.localStorage
      .getItem(RUNNER_URL_KEY)
      ?.replace(/\/$/, '')
    const runnerToken = window.localStorage.getItem(RUNNER_TOKEN_KEY)
    const account =
      window.localStorage.getItem(LEARNBLOCKCHAIN_ACCOUNT_KEY) || 'default'

    if (!runnerUrl || !runnerToken) {
      return {
        platform: 'learnblockchain',
        status: 'failed',
        error:
          'Connect the ButtonPost Local Runner before publishing to LearnBlockchain.',
      }
    }

    const form = new FormData()
    form.append('account', account)
    form.append('title', title.trim())
    form.append('content', content)
    for (const image of images) form.append('images', image, image.name)

    try {
      const response = await fetch(
        runnerUrl + '/v1/platforms/learnblockchain/publish-article',
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
          platform: 'learnblockchain',
          status: 'failed',
          error:
            data.error ||
            data.message ||
            'The Local Runner could not publish the LearnBlockchain article.',
        }
      }

      return {
        platform: 'learnblockchain',
        status: 'published',
        externalId:
          data.externalId || data.message || 'Published via Local Runner',
        externalUrl: data.externalUrl,
      }
    } catch (cause) {
      return {
        platform: 'learnblockchain',
        status: 'failed',
        error:
          cause instanceof Error
            ? cause.message
            : 'Could not reach the Local Runner for LearnBlockchain.',
      }
    }
  }


  async function publishIndieHackers(): Promise<LocalPublishResult> {
    const runnerUrl = window.localStorage
      .getItem(RUNNER_URL_KEY)
      ?.replace(/\/$/, '')
    const runnerToken = window.localStorage.getItem(RUNNER_TOKEN_KEY)
    const account =
      window.localStorage.getItem(INDIE_HACKERS_ACCOUNT_KEY) || 'default'

    if (!runnerUrl || !runnerToken) {
      return {
        platform: 'indiehackers',
        status: 'failed',
        error:
          'Connect the ButtonPost Local Runner before publishing to Indie Hackers.',
      }
    }

    const form = new FormData()
    form.append('account', account)
    form.append('title', title.trim())
    form.append('content', content)
    for (const image of images) form.append('images', image, image.name)

    try {
      const response = await fetch(
        runnerUrl + '/v1/platforms/indiehackers/publish-post',
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
          platform: 'indiehackers',
          status: 'failed',
          error:
            data.error ||
            data.message ||
            'The Local Runner could not publish the Indie Hackers post.',
        }
      }

      return {
        platform: 'indiehackers',
        status: 'published',
        externalId:
          data.externalId || data.message || 'Published via Local Runner',
        externalUrl: data.externalUrl,
      }
    } catch (cause) {
      return {
        platform: 'indiehackers',
        status: 'failed',
        error:
          cause instanceof Error
            ? cause.message
            : 'Could not reach the Local Runner for Indie Hackers.',
      }
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSubmitting(true)
    setError('')
    setResults([])
    setMediaProgress('')
    setRetryNotice('')

    const historyId =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`

    latestFiles.current = { id: historyId, files: [...images] }
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
      (id): id is PlatformId =>
        id !== 'xiaohongshu' &&
        id !== 'jike' &&
        id !== 'learnblockchain' &&
        id !== 'indiehackers',
    )
    const wantsXiaohongshu = selected.includes('xiaohongshu')
    const wantsJike = selected.includes('jike')
    const wantsLearnBlockchain = selected.includes('learnblockchain')

    const tasks: Promise<void>[] = []

    if (serverPlatforms.length) {
      tasks.push(
        publishServerFlow(serverPlatforms).then((serverResults) => {
          upsertResults(serverResults)
          mergeHistoryResults(historyId, serverResults)
        }),
      )
    }

    tasks.push(
      (async () => {
        const localQueue: Array<{
          platform: LocalPublishResult['platform']
          message: string
          run: () => Promise<LocalPublishResult>
        }> = []

        if (wantsXiaohongshu) {
          localQueue.push({
            platform: 'xiaohongshu',
            message:
              'ButtonPost is opening Xiaohongshu. Review the filled editor in Chrome and click Publish manually.',
            run: publishXiaohongshu,
          })
        }

        if (wantsJike) {
          localQueue.push({
            platform: 'jike',
            message:
              'ButtonPost is opening Jike. Review circles, text, and images in Chrome, then click Send manually.',
            run: publishJike,
          })
        }

        if (wantsLearnBlockchain) {
          localQueue.push({
            platform: 'learnblockchain',
            message:
              'ButtonPost is opening LearnBlockchain. Review category, tags, cover, formatting, and images before publishing manually.',
            run: publishLearnBlockchain,
          })
        }

        for (const item of localQueue) {
          const reviewingResult: LocalPublishResult = {
            platform: item.platform,
            status: 'reviewing',
            externalId: item.message,
          }
          upsertResults([reviewingResult])
          mergeHistoryResults(historyId, [reviewingResult])

          const result = await item.run()
          upsertResults([result])
          mergeHistoryResults(historyId, [result])
        }
      })(),
    )

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
            One source image set. X attaches up to 4 images, DEV stores them in the article, and Xiaohongshu/Jike/LearnBlockchain send local files directly to your Local Runner. Up to 9 source images are accepted.
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
        <p className="helper">Cloud platforms work entirely in your browser. Local browser platforms require an optional helper installed on your computer.</p>
        <div className="platform-list">
          {platforms.map((platform) => {
            const connected =
              platform.configured &&
              connectedPlatforms.includes(platform.id)

            return (
              <label
                className={'platform ' + (connected ? '' : 'disabled')}
                key={platform.id}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(platform.id)}
                  disabled={!connected}
                  onChange={() => togglePlatform(platform.id)}
                />
                <span className="platform-copy">
                  <span className="platform-name">
                    <span className={'dot ' + (connected ? '' : 'off')} />
                    {platform.name}
                  </span>
                  <span className="platform-note">
                    {!platform.configured
                      ? 'Integration unavailable'
                      : connected
                        ? platform.mode
                        : signedIn
                          ? 'Connect in Settings'
                          : 'Sign in to connect'}
                  </span>
                </span>
              </label>
            )
          })}

          <label className={'platform ' + (localReady['xiaohongshu'] ? '' : 'disabled')}>
            <input
              type="checkbox"
              checked={selected.includes('xiaohongshu')}
              disabled={!localReady['xiaohongshu']}
              onChange={() => togglePlatform('xiaohongshu')}
            />
            <span className="platform-copy">
              <span className="platform-name">
                <span className={'dot ' + (localReady['xiaohongshu'] ? 'local' : 'off')} />
                Xiaohongshu · 小红书
              </span>
              <span className="platform-note">{localReady['xiaohongshu'] ? 'Local Runner · review before publish' : 'Needs optional Local Runner + login · see below'}</span>
            </span>
          </label>

          <label className={'platform ' + (localReady['jike'] ? '' : 'disabled')}>
            <input
              type="checkbox"
              checked={selected.includes('jike')}
              disabled={!localReady['jike']}
              onChange={() => togglePlatform('jike')}
            />
            <span className="platform-copy">
              <span className="platform-name">
                <span className={'dot ' + (localReady['jike'] ? 'local' : 'off')} />
                Jike · 即刻
              </span>
              <span className="platform-note">{localReady['jike'] ? 'Local Runner · review before send' : 'Needs optional Local Runner + login · see below'}</span>
            </span>
          </label>

          <label className={'platform ' + (localReady['learnblockchain'] ? '' : 'disabled')}>
            <input
              type="checkbox"
              checked={selected.includes('learnblockchain')}
              disabled={!localReady['learnblockchain']}
              onChange={() => togglePlatform('learnblockchain')}
            />
            <span className="platform-copy">
              <span className="platform-name">
                <span className={'dot ' + (localReady['learnblockchain'] ? 'local' : 'off')} />
                LearnBlockchain · 登链社区
              </span>
              <span className="platform-note">{localReady['learnblockchain'] ? 'Local Runner · article review before publish' : 'Needs optional Local Runner + login · see below'}</span>
            </span>
          </label>

        </div>

        {signedIn ? (
          <a className="connections-shortcut" href="/settings/connections">
            Manage X / DEV connections →
          </a>
        ) : null}

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

      {retryNotice ? <p className="selection-warning" role="status">{retryNotice}</p> : null}
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
          {!submitting && results.some((result) => result.status === 'failed') && (
            <div className="result-retry">
              <button
                type="button"
                className="history-reuse"
                onClick={() => {
                  const recordId = latestFiles.current?.id
                  const record = historyRef.current.find((entry) => entry.id === recordId)
                  if (record) retryFailed(record)
                }}
              >
                Retry failed platforms ({results.filter((result) => result.status === 'failed').length})
              </button>
              <span>Prepares only failed destinations. Review before publishing again.</span>
            </div>
          )}
        </section>
      ) : null}
      </form>

      <PublicationHistory
        entries={history}
        onReuse={reuseHistoryEntry}
        onRetryFailed={retryFailed}
        onClear={clearHistory}
      />
    </>
  )
}
