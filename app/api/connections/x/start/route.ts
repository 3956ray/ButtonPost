import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { encryptJson } from '@/lib/security/credential-crypto'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const COOKIE_NAME = 'buttonpost_x_oauth'
const OAUTH_TTL_MS = 10 * 60 * 1000

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const appKey = process.env.X_API_KEY?.trim()
  const appSecret = process.env.X_API_SECRET?.trim()

  if (!appKey || !appSecret) {
    return NextResponse.redirect(
      new URL('/settings/connections?error=x_app_not_configured', request.url),
    )
  }

  try {
    const callbackUrl = new URL('/api/connections/x/callback', request.url).toString()
    const client = new TwitterApi({ appKey, appSecret })
    const link = await client.generateAuthLink(callbackUrl, {
      linkMode: 'authorize',
    })

    const cookieStore = await cookies()
    cookieStore.set(
      COOKIE_NAME,
      encryptJson({
        userId: user.id,
        oauthToken: link.oauth_token,
        oauthTokenSecret: link.oauth_token_secret,
        expiresAt: Date.now() + OAUTH_TTL_MS,
      }),
      {
        httpOnly: true,
        secure: new URL(request.url).protocol === 'https:',
        sameSite: 'lax',
        path: '/',
        maxAge: Math.floor(OAUTH_TTL_MS / 1000),
      },
    )

    return NextResponse.redirect(link.url)
  } catch {
    return NextResponse.redirect(
      new URL('/settings/connections?error=x_start_failed', request.url),
    )
  }
}
