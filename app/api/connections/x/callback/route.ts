import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { saveConnection } from '@/lib/connections/store'
import { decryptJson } from '@/lib/security/credential-crypto'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const COOKIE_NAME = 'buttonpost_x_oauth'

type OAuthState = {
  userId: string
  oauthToken: string
  oauthTokenSecret: string
  expiresAt: number
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const oauthToken = url.searchParams.get('oauth_token')
  const oauthVerifier = url.searchParams.get('oauth_verifier')
  const cookieStore = await cookies()
  const sealedState = cookieStore.get(COOKIE_NAME)?.value

  cookieStore.delete(COOKIE_NAME)

  if (!oauthToken || !oauthVerifier || !sealedState) {
    return NextResponse.redirect(
      new URL('/settings/connections?error=x_callback_missing', url.origin),
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', url.origin))
  }

  const appKey = process.env.X_API_KEY?.trim()
  const appSecret = process.env.X_API_SECRET?.trim()

  if (!appKey || !appSecret) {
    return NextResponse.redirect(
      new URL('/settings/connections?error=x_app_not_configured', url.origin),
    )
  }

  try {
    const state = decryptJson<OAuthState>(sealedState)

    if (
      state.userId !== user.id ||
      state.oauthToken !== oauthToken ||
      state.expiresAt < Date.now()
    ) {
      throw new Error('X OAuth state is invalid or expired.')
    }

    const requestClient = new TwitterApi({
      appKey,
      appSecret,
      accessToken: oauthToken,
      accessSecret: state.oauthTokenSecret,
    })

    const {
      client: loggedClient,
      accessToken,
      accessSecret,
    } = await requestClient.login(oauthVerifier)

    const me = await loggedClient.v2.me()

    await saveConnection(
      supabase,
      user.id,
      'x',
      {
        kind: 'x-oauth1',
        accessToken,
        accessSecret,
      },
      {
        externalAccountId: me.data.id,
        externalUsername: me.data.username,
      },
    )

    return NextResponse.redirect(
      new URL('/settings/connections?connected=x', url.origin),
    )
  } catch {
    return NextResponse.redirect(
      new URL('/settings/connections?error=x_callback_failed', url.origin),
    )
  }
}
