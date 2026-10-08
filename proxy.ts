import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

function productionCanonicalOrigin() {
  if (process.env.VERCEL_ENV !== 'production') return null

  const configured = process.env.BUTTONPOST_APP_URL?.trim()
  if (!configured) return null

  try {
    return new URL(configured).origin
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const canonicalOrigin = productionCanonicalOrigin()

  // Supabase falls back to the Site URL when an OAuth redirect URL is not
  // accepted by its allow-list. Recover that PKCE flow instead of rendering
  // the homepage with an unused ?code=... query parameter.
  if (request.nextUrl.pathname === '/') {
    const code = request.nextUrl.searchParams.get('code')

    if (
      code &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        code,
      )
    ) {
      const target = new URL('/auth/callback', canonicalOrigin ?? request.nextUrl.origin)
      target.searchParams.set('code', code)
      target.searchParams.set('next', '/')
      return NextResponse.redirect(target, 307)
    }
  }

  if (canonicalOrigin && request.nextUrl.origin !== canonicalOrigin) {
    const target = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      canonicalOrigin,
    )

    return NextResponse.redirect(target, 308)
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
