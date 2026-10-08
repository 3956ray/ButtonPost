import { issueSignedToken } from '@vercel/blob'
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from '@vercel/blob/client'
import { verifyMediaUploadTicket } from '@/lib/security/media-ticket'

export const runtime = 'nodejs'

type ClientPayload = {
  ticket?: unknown
}

function blobStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)
}

export async function POST(request: Request) {
  if (!blobStorageConfigured()) {
    return Response.json(
      {
        error:
          'Server media storage is not configured. Connect a public Vercel Blob store to ButtonPost so BLOB_STORE_ID (OIDC) or BLOB_READ_WRITE_TOKEN is available.',
      },
      { status: 503 },
    )
  }

  let body: HandleUploadPresignedBody
  try {
    body = (await request.json()) as HandleUploadPresignedBody
  } catch {
    return Response.json({ error: 'Invalid Vercel Blob upload request.' }, { status: 400 })
  }

  try {
    const response = await handleUploadPresigned({
      body,
      request,
      // No upload-completed callback is registered, so this key is never used
      // for the generation path. A non-empty value avoids requiring a webhook
      // key solely for presigned URL issuance.
      webhookPublicKey:
        process.env.BLOB_WEBHOOK_PUBLIC_KEY || 'buttonpost-no-callback',
      getSignedToken: async (pathname, clientPayload) => {
        let payload: ClientPayload = {}

        if (clientPayload) {
          try {
            payload = JSON.parse(clientPayload) as ClientPayload
          } catch {
            throw new Error('Invalid media upload authorization payload.')
          }
        }

        const verified = verifyMediaUploadTicket(payload.ticket)
        if (!verified) {
          throw new Error('Media upload ticket is invalid or expired.')
        }

        if (
          !pathname.startsWith(verified.prefix) ||
          pathname.includes('..')
        ) {
          throw new Error('Media upload pathname is outside the authorized user namespace.')
        }

        const validUntil = Date.now() + 5 * 60 * 1000
        const allowedContentTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
        ]
        const maximumSizeInBytes = 25 * 1024 * 1024

        const token = await issueSignedToken({
          pathname,
          operations: ['put'],
          validUntil,
          allowedContentTypes,
          maximumSizeInBytes,
        })

        return {
          token,
          urlOptions: {
            validUntil,
            allowedContentTypes,
            maximumSizeInBytes,
            addRandomSuffix: true,
            allowOverwrite: false,
          },
        }
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
