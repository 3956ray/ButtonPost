import { TwitterApi } from 'twitter-api-v2'
import { markdownToPlainText } from '@/lib/content/markdown-to-plain'
import { splitForXThread } from './x-thread'
import type {
  PublishResult,
  PublisherAdapter,
  SourceMedia,
  SourcePost,
  ValidationResult,
  PlatformCredential,
} from './types'

function xMaxLength(): number {
  const configured = Number(process.env.X_MAX_LENGTH ?? '280')
  return Number.isFinite(configured) && configured > 0 ? configured : 280
}

function xMaxThreadPosts(): number {
  const configured = Number(process.env.X_MAX_THREAD_POSTS ?? '25')
  return Number.isFinite(configured) && configured > 0 ? configured : 25
}

export function formatForX(post: SourcePost): string {
  return markdownToPlainText(post.content)
}

export function validateForX(post: SourcePost): ValidationResult {
  const text = formatForX(post)
  if (!text) return { ok: false, error: 'X content is empty after Markdown normalization.' }

  const chunks = splitForXThread(text, xMaxLength())
  const maxPosts = xMaxThreadPosts()

  if (chunks.length > maxPosts) {
    return {
      ok: false,
      error: `X content would require ${chunks.length} thread posts; configured maximum is ${maxPosts}.`,
    }
  }

  return { ok: true }
}

function createXClient(
  credential?: PlatformCredential,
): TwitterApi | null {
  if (
    credential?.kind !== 'x-oauth1' ||
    !process.env.X_API_KEY ||
    !process.env.X_API_SECRET
  ) {
    return null
  }

  return new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: credential.accessToken,
    accessSecret: credential.accessSecret,
  })
}

function appOnlyHint(message: string): string {
  if (message.includes('Application-Only') || message.includes('application-only')) {
    return 'X rejected the current user authorization. Reconnect X in ButtonPost Settings and retry.'
  }
  return message
}

function unknownError(cause: unknown): string {
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    Number((cause as { code?: unknown }).code) === 402
  ) {
    return 'X API returned 402 Payment Required. Your X Developer account likely has no available credits; add credits in the X Developer Console and retry.'
  }

  if (cause instanceof Error) {
    if (/code\s*402/i.test(cause.message)) {
      return 'X API returned 402 Payment Required. Your X Developer account likely has no available credits; add credits in the X Developer Console and retry.'
    }
    return appOnlyHint(cause.message)
  }

  return 'Unexpected X API error.'
}

async function downloadImage(media: SourceMedia): Promise<{
  buffer: Buffer
  contentType: string
}> {
  const response = await fetch(media.url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Could not read source image for X: HTTP ${response.status}.`)
  }

  const contentType =
    response.headers.get('content-type')?.split(';')[0]?.trim() ||
    media.contentType ||
    ''

  if (!contentType.startsWith('image/')) {
    throw new Error(`X media must be an image; received ${contentType || 'unknown content type'}.`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const maxImageBytes = 5 * 1024 * 1024
  if (buffer.length > maxImageBytes) {
    throw new Error(
      `X image ${media.name || media.url} is larger than the 5 MB ButtonPost X image limit.`,
    )
  }

  return {
    buffer,
    contentType,
  }
}

async function uploadImages(client: TwitterApi, post: SourcePost): Promise<string[]> {
  const images = (post.media ?? []).slice(0, 4)
  const mediaIds: string[] = []

  for (const media of images) {
    const { buffer, contentType } = await downloadImage(media)
    const mediaId = await client.v2.uploadMedia(buffer, {
      media_type: contentType as never,
      media_category: 'tweet_image' as never,
    })
    mediaIds.push(mediaId)
  }

  return mediaIds
}

async function publishWithClient(
  client: TwitterApi,
  post: SourcePost,
): Promise<PublishResult> {
  const chunks = splitForXThread(formatForX(post), xMaxLength())
  const postedIds: string[] = []

  try {
    const mediaIds = await uploadImages(client, post)

    for (let index = 0; index < chunks.length; index += 1) {
      const text = chunks[index]!
      const result =
        index === 0
          ? await client.v2.tweet({
              text,
              ...(mediaIds.length
                ? { media: { media_ids: mediaIds } }
                : {}),
            } as never)
          : await client.v2.reply(text, postedIds[index - 1]!)

      const id = result.data?.id
      if (!id) throw new Error('X API did not return a post id.')
      postedIds.push(id)
    }

    const firstId = postedIds[0]
    if (!firstId) {
      return {
        platform: 'x',
        status: 'failed',
        error: 'X API did not return a post id.',
      }
    }

    return {
      platform: 'x',
      status: 'published',
      externalId: firstId,
      externalUrl: `https://x.com/i/web/status/${firstId}`,
    }
  } catch (cause) {
    const partial =
      postedIds.length > 0
        ? `X published ${postedIds.length} of ${chunks.length} thread posts before failing. First post: https://x.com/i/web/status/${postedIds[0]}. `
        : ''

    return {
      platform: 'x',
      status: 'failed',
      error: partial + unknownError(cause),
    }
  }
}

export const xPublisher: PublisherAdapter = {
  id: 'x',
  name: 'X',
  mode: 'API',
  requiredEnv: ['X_API_KEY', 'X_API_SECRET'],

  configured() {
    return Boolean(process.env.X_API_KEY && process.env.X_API_SECRET)
  },

  validate: validateForX,

  async publish(
    post,
    credential,
  ): Promise<PublishResult> {
    const validation = validateForX(post)
    if (!validation.ok) return { platform: 'x', status: 'failed', error: validation.error }

    const client = createXClient(credential)
    if (!client) {
      return {
        platform: 'x',
        status: 'skipped',
        error:
          'Connect your X account in ButtonPost Settings before publishing.',
      }
    }

    return publishWithClient(client, post)
  },
}
