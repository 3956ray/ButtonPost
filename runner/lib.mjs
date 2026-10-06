import { timingSafeEqual } from 'node:crypto'

export function parseAllowedOrigins(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
}

export function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return true
  return allowedOrigins.has(origin)
}

export function isAuthorized(authorization, token) {
  if (!token || typeof authorization !== 'string') return false
  const prefix = 'Bearer '
  if (!authorization.startsWith(prefix)) return false

  const supplied = Buffer.from(authorization.slice(prefix.length))
  const expected = Buffer.from(token)
  if (supplied.length !== expected.length) return false
  return timingSafeEqual(supplied, expected)
}

export function corsHeaders(origin, allowedOrigins) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  }

  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}
