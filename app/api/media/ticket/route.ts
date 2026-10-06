import { createMediaUploadTicket } from '@/lib/security/media-ticket'
import { authorizePublish } from '@/lib/security/publish-secret'

export const runtime = 'nodejs'

type TicketRequest = {
  secret?: unknown
}

export async function POST(request: Request) {
  let body: TicketRequest

  try {
    body = (await request.json()) as TicketRequest
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const auth = authorizePublish(body.secret)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      {
        error:
          'Server media storage is not configured. Connect a public Vercel Blob store to ButtonPost first.',
      },
      { status: 503 },
    )
  }

  const ticket = createMediaUploadTicket()
  if (!ticket) {
    return Response.json({ error: 'BUTTONPOST_SECRET is not configured.' }, { status: 503 })
  }

  return Response.json({ ticket })
}
