import type { PublishResult, PublisherAdapter, SourcePost, ValidationResult } from './types'

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
  requiredEnv: ['DEVTO_API_KEY'],

  configured() {
    return Boolean(process.env.DEVTO_API_KEY)
  },

  validate: validateForDevto,

  async publish(post): Promise<PublishResult> {
    const apiKey = process.env.DEVTO_API_KEY
    if (!apiKey) {
      return { platform: 'devto', status: 'skipped', error: 'DEVTO_API_KEY is not configured.' }
    }

    const validation = validateForDevto(post)
    if (!validation.ok) return { platform: 'devto', status: 'failed', error: validation.error }

    const draftOnly = process.env.DEVTO_DRAFT_ONLY === 'true'

    const response = await fetch('https://dev.to/api/articles', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        article: {
          title: post.title.trim(),
          body_markdown: post.content,
          published: !draftOnly,
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
