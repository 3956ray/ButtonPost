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
