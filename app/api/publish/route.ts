import { publishEverywhere } from '@/lib/publishers/publish-everywhere'
import { PLATFORM_IDS, type PlatformId } from '@/lib/publishers/types'
import { authorizePublish } from '@/lib/security/publish-secret'

export const runtime = 'nodejs'

type PublishRequest = {
  title?: unknown
  content?: unknown
  platforms?: unknown
  secret?: unknown
  media?: unknown
}

function isSourceMedia(value: unknown): value is { url: string; name?: string; contentType?: string } {
  if (!value || typeof value !== 'object') return false
  const media = value as Record<string, unknown>

  if (typeof media.url !== 'string') return false

  try {
    const url = new URL(media.url)
    if (url.protocol !== 'https:') return false
  } catch {
    return false
  }

  return (
    (media.name === undefined || typeof media.name === 'string') &&
    (media.contentType === undefined || typeof media.contentType === 'string')
  )
}

function isPlatformId(value: unknown): value is PlatformId {
  return typeof value === 'string' && (PLATFORM_IDS as readonly string[]).includes(value)
}

export async function POST(request: Request) {
  let body: PublishRequest
  try {
    body = (await request.json()) as PublishRequest
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const auth = authorizePublish(body.secret)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  if (typeof body.title !== 'string' || !body.title.trim()) {
    return Response.json({ error: 'Title is required.' }, { status: 400 })
  }
  if (typeof body.content !== 'string' || !body.content.trim()) {
    return Response.json({ error: 'Content is required.' }, { status: 400 })
  }
  if (!Array.isArray(body.platforms) || body.platforms.length === 0 || !body.platforms.every(isPlatformId)) {
    return Response.json({ error: 'Choose at least one supported platform.' }, { status: 400 })
  }

  const media =
    body.media === undefined
      ? []
      : Array.isArray(body.media) && body.media.length <= 9 && body.media.every(isSourceMedia)
        ? body.media
        : null

  if (media === null) {
    return Response.json({ error: 'Media must be an array of up to 9 HTTPS image URLs.' }, { status: 400 })
  }

  const results = await publishEverywhere(
    { title: body.title.trim(), content: body.content, media },
    body.platforms,
  )

  return Response.json({ results })
}
