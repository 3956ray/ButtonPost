import { canUseCloudPublishing } from '@/lib/billing/entitlement'
import { createMediaUploadTicket } from '@/lib/security/media-ticket'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Sign in is required.' }, { status: 401 })
  }

  try {
    const allowed = await canUseCloudPublishing(supabase, user.id)
    if (!allowed) {
      return Response.json(
        {
          error: 'ButtonPost Pro is required for cloud media uploads.',
          code: 'subscription_required',
        },
        { status: 402 },
      )
    }
  } catch {
    return Response.json(
      { error: 'Could not verify ButtonPost subscription status.' },
      { status: 503 },
    )
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    return Response.json(
      {
        error:
          'Server media storage is not configured. Connect a public Vercel Blob store to ButtonPost so BLOB_STORE_ID (OIDC) or BLOB_READ_WRITE_TOKEN is available.',
      },
      { status: 503 },
    )
  }

  const ticket = createMediaUploadTicket()
  if (!ticket) {
    return Response.json(
      { error: 'Server media ticket signing is not configured.' },
      { status: 503 },
    )
  }

  return Response.json({ ticket })
}
