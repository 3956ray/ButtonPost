import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { authorizePublish } from '@/lib/security/publish-secret'

export const runtime = 'nodejs'

type ClientPayload = {
  secret?: unknown
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      {
        error:
          'Server media storage is not configured. Connect a public Vercel Blob store so X and DEV can publish selected images.',
      },
      { status: 503 },
    )
  }

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return Response.json({ error: 'Invalid Vercel Blob upload request.' }, { status: 400 })
  }

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let payload: ClientPayload = {}
        if (clientPayload) {
          try {
            payload = JSON.parse(clientPayload) as ClientPayload
          } catch {
            throw new Error('Invalid media upload authorization payload.')
          }
        }

        const auth = authorizePublish(payload.secret)
        if (!auth.ok) throw new Error(auth.error)

        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async () => {
        // Blob URLs are persisted because DEV articles reference them directly.
      },
    })

    return Response.json(response)
  } catch (cause) {
    return Response.json(
      {
        error:
          cause instanceof Error ? cause.message : 'Could not authorize media upload.',
      },
      { status: 400 },
    )
  }
}
