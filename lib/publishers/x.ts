import { TwitterApi } from 'twitter-api-v2'
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

function hasOAuth1UserContext(): boolean {
  return Boolean(
    process.env.X_API_KEY &&
      process.env.X_API_SECRET &&
      process.env.X_ACCESS_TOKEN &&
      process.env.X_ACCESS_TOKEN_SECRET,
  )
}

function appOnlyHint(message: string): string {
  if (message.includes('Application-Only') || message.includes('application-only')) {
    return 'X rejected an application-only Bearer Token. Configure OAuth 1.0a user-context credentials (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET) or provide an OAuth 2.0 user access token.'
  }
  return message
}

function errorMessage(body: XCreatePostResponse, status: number): string {
  const message =
    body.detail ||
    body.errors?.[0]?.detail ||
    body.errors?.[0]?.message ||
    body.title ||
    `X API returned HTTP ${status}.`
  return appOnlyHint(message)
}

function unknownError(cause: unknown): string {
  if (cause instanceof Error) return appOnlyHint(cause.message)
  return 'Unexpected X API error.'
}

async function publishWithOAuth1(post: SourcePost): Promise<PublishResult> {
  try {
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN!,
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
    })

    const result = await client.v2.tweet(formatForX(post))
    const id = result.data?.id
    if (!id) return { platform: 'x', status: 'failed', error: 'X API did not return a post id.' }

    return {
      platform: 'x',
      status: 'published',
      externalId: id,
      externalUrl: `https://x.com/i/web/status/${id}`,
    }
  } catch (cause) {
    return { platform: 'x', status: 'failed', error: unknownError(cause) }
  }
}

async function publishWithOAuth2UserToken(post: SourcePost, accessToken: string): Promise<PublishResult> {
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
}

export const xPublisher: PublisherAdapter = {
  id: 'x',
  name: 'X',
  mode: 'API',
  requiredEnv: ['X user-context auth'],

  configured() {
    return hasOAuth1UserContext() || Boolean(process.env.X_USER_ACCESS_TOKEN)
  },

  validate: validateForX,

  async publish(post): Promise<PublishResult> {
    const validation = validateForX(post)
    if (!validation.ok) return { platform: 'x', status: 'failed', error: validation.error }

    if (hasOAuth1UserContext()) return publishWithOAuth1(post)

    const accessToken = process.env.X_USER_ACCESS_TOKEN
    if (accessToken) return publishWithOAuth2UserToken(post, accessToken)

    return {
      platform: 'x',
      status: 'skipped',
      error:
        'X user-context auth is not configured. Set OAuth 1.0a credentials or X_USER_ACCESS_TOKEN.',
    }
  },
}
