import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { verifyMediaUploadTicket } from '@/lib/security/media-ticket'

export const runtime = 'nodejs'

type ClientPayload = {
  ticket?: unknown
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

        if (!verifyMediaUploadTicket(payload.ticket)) {
          throw new Error('Media upload ticket is invalid or expired.')
        }

        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async () => {
        // Blob URLs remain public because DEV articles reference them directly.
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
