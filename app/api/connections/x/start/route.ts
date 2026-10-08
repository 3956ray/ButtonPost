import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { encryptJson } from '@/lib/security/credential-crypto'
import { consumeRateLimit } from '@/lib/security/rate-limit'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const COOKIE_NAME = 'buttonpost_x_oauth'
const OAUTH_TTL_MS = 10 * 60 * 1000

function canonicalAppUrl(): URL | null {
  const configured = process.env.BUTTONPOST_APP_URL?.trim()
  if (!configured) return null

  try {
    return new URL(configured)
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const canonical = canonicalAppUrl()

  // OAuth state cookies are host-scoped. In production, always start the X
  // authorization flow on ButtonPost's canonical hostname so the callback
  // returns to the same host that created the state cookie.
  if (canonical && requestUrl.origin !== canonical.origin) {
    return NextResponse.redirect(
      new URL('/api/connections/x/start', canonical),
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL('/login', canonical ?? requestUrl),
    )
  }

  try {
    const rateLimit = await consumeRateLimit(supabase, 'x_oauth_start')
    if (!rateLimit.allowed) {
      return NextResponse.redirect(
        new URL(
          '/settings/connections?error=x_rate_limited',
          canonical ?? requestUrl,
        ),
      )
    }
  } catch {
    return NextResponse.redirect(
      new URL(
        '/settings/connections?error=x_rate_limit_failed',
        canonical ?? requestUrl,
      ),
    )
  }

  const appKey = process.env.X_API_KEY?.trim()
  const appSecret = process.env.X_API_SECRET?.trim()

  if (!appKey || !appSecret) {
    return NextResponse.redirect(
      new URL(
        '/settings/connections?error=x_app_not_configured',
        canonical ?? requestUrl,
      ),
    )
  }

  try {
    const callbackUrl = new URL(
      '/api/connections/x/callback',
      canonical ?? requestUrl,
    ).toString()

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
        secure: (canonical ?? requestUrl).protocol === 'https:',
        sameSite: 'lax',
        path: '/',
        maxAge: Math.floor(OAUTH_TTL_MS / 1000),
      },
    )

    return NextResponse.redirect(link.url)
  } catch {
    return NextResponse.redirect(
      new URL(
        '/settings/connections?error=x_start_failed',
        canonical ?? requestUrl,
      ),
    )
  }
}
