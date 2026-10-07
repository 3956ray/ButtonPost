import type {
  PlatformCredential,
  PublishResult,
  PublisherAdapter,
  SourcePost,
  ValidationResult,
} from './types'

type DevArticleResponse = {
  id?: number
  url?: string
  error?: string
  status?: number
}

export function validateForDevto(post: SourcePost): ValidationResult {
  if (!post.title.trim()) return { ok: false, error: 'DEV requires a title.' }
  if (!post.content.trim()) return { ok: false, error: 'DEV content cannot be empty.' }
  return { ok: true }
}

function withImages(post: SourcePost): string {
  if (!post.media?.length) return post.content

  const bodyImages = post.media.slice(1)
  if (!bodyImages.length) return post.content

  const imageMarkdown = bodyImages
    .map((media, index) => {
      const alt = (media.name || `Image ${index + 2}`)
        .replace(/[\[\]]/g, '')
        .trim()
      return `![${alt || `Image ${index + 2}`}](${media.url})`
    })
    .join('\n\n')

  return `${post.content.trim()}\n\n${imageMarkdown}`
}

function tags(): string | undefined {
  const value = process.env.DEVTO_TAGS?.trim()
  if (!value) return undefined
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(', ')
}

export const devtoPublisher: PublisherAdapter = {
  id: 'devto',
  name: 'DEV Community',
  mode: 'API',
  requiredEnv: [],

  configured() {
    return true
  },

  validate: validateForDevto,

  async publish(
    post,
    credential,
  ): Promise<PublishResult> {
    const apiKey =
      credential?.kind === 'devto-api-key' ? credential.apiKey : null

    if (!apiKey) {
      return {
        platform: 'devto',
        status: 'skipped',
        error: 'Connect your DEV account in ButtonPost Settings before publishing.',
      }
    }

    const validation = validateForDevto(post)
    if (!validation.ok) return { platform: 'devto', status: 'failed', error: validation.error }

    const draftOnly = process.env.DEVTO_DRAFT_ONLY === 'true'

    const response = await fetch('https://dev.to/api/articles', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.forem.api-v1+json',
      },
      body: JSON.stringify({
        article: {
          title: post.title.trim(),
          body_markdown: withImages(post),
          published: !draftOnly,
          ...(post.media?.[0]?.url ? { main_image: post.media[0].url } : {}),
          ...(tags() ? { tags: tags() } : {}),
        },
      }),
      cache: 'no-store',
    })

    const body = (await response.json().catch(() => ({}))) as DevArticleResponse
    if (!response.ok || !body.id) {
      return {
        platform: 'devto',
        status: 'failed',
        error: body.error || `DEV API returned HTTP ${response.status}.`,
      }
    }

    return {
      platform: 'devto',
      status: draftOnly ? 'draft' : 'published',
      externalId: String(body.id),
      externalUrl: body.url,
    }
  },
}
