import { markdownToPlainText } from '@/lib/content/markdown-to-plain'
import type { PublishResult, PublisherAdapter, SourcePost, ValidationResult } from './types'

type XCreatePostResponse = {
  data?: { id?: string; text?: string }
  detail?: string
  title?: string
  errors?: Array<{ detail?: string; message?: string }>
}

function xMaxLength(): number {
  const configured = Number(process.env.X_MAX_LENGTH ?? '280')
  return Number.isFinite(configured) && configured > 0 ? configured : 280
}

export function formatForX(post: SourcePost): string {
  return markdownToPlainText(post.content)
}

export function validateForX(post: SourcePost): ValidationResult {
  const text = formatForX(post)
  if (!text) return { ok: false, error: 'X content is empty after Markdown normalization.' }

  const limit = xMaxLength()
  if (text.length > limit) {
    return { ok: false, error: `X content is ${text.length} characters; configured limit is ${limit}.` }
  }

  return { ok: true }
}

function errorMessage(body: XCreatePostResponse, status: number): string {
  return body.detail || body.errors?.[0]?.detail || body.errors?.[0]?.message || body.title || `X API returned HTTP ${status}.`
}

export const xPublisher: PublisherAdapter = {
  id: 'x',
  name: 'X',
  mode: 'API',
  requiredEnv: ['X_USER_ACCESS_TOKEN'],

  configured() {
    return Boolean(process.env.X_USER_ACCESS_TOKEN)
  },

  validate: validateForX,

  async publish(post): Promise<PublishResult> {
    const accessToken = process.env.X_USER_ACCESS_TOKEN
    if (!accessToken) {
      return { platform: 'x', status: 'skipped', error: 'X_USER_ACCESS_TOKEN is not configured.' }
    }

    const validation = validateForX(post)
    if (!validation.ok) return { platform: 'x', status: 'failed', error: validation.error }

    const response = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: formatForX(post) }),
      cache: 'no-store',
    })

    const body = (await response.json().catch(() => ({}))) as XCreatePostResponse
    if (!response.ok || !body.data?.id) {
      return { platform: 'x', status: 'failed', error: errorMessage(body, response.status) }
    }

    return {
      platform: 'x',
      status: 'published',
      externalId: body.data.id,
      externalUrl: `https://x.com/i/web/status/${body.data.id}`,
    }
  },
}
