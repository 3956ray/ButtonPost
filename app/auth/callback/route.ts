import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { requireSupabasePublicConfig } from '@/lib/supabase/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

function canonicalOrigin() {
  const configured = process.env.BUTTONPOST_APP_URL?.trim()
  if (!configured) return null

  try {
    return new URL(configured).origin
  } catch {
    return null
  }
}

function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Pragma', 'no-cache')
  return response
}

export async function GET(request: NextRequest) {
  const canonical = canonicalOrigin()

  if (canonical && request.nextUrl.origin !== canonical) {
    const target = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      canonical,
    )
    return noStore(NextResponse.redirect(target, 307))
  }

  const code = request.nextUrl.searchParams.get('code')
  const next = safeNext(request.nextUrl.searchParams.get('next'))

  if (!code) {
    console.warn('[auth-callback] missing authorization code')
    return noStore(
      NextResponse.redirect(
        new URL('/login?error=oauth_callback_missing', request.nextUrl.origin),
      ),
    )
  }

  const successResponse = noStore(
    NextResponse.redirect(new URL(next, request.nextUrl.origin)),
  )

  const { url, publishableKey } = requireSupabasePublicConfig()
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          successResponse.cookies.set(name, value, options)
        })
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth-callback] code exchange failed', {
      errorName: error.name,
      status: error.status,
      code: error.code,
      message: error.message.slice(0, 240),
      cookieNames: request.cookies.getAll().map(({ name }) => name),
    })

    return noStore(
      NextResponse.redirect(
        new URL('/login?error=oauth_callback_exchange', request.nextUrl.origin),
      ),
    )
  }

  console.info('[auth-callback] code exchange succeeded', {
    next,
    setCookieCount: successResponse.cookies.getAll().length,
  })

  return successResponse
}
