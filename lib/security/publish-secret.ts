import { timingSafeEqual } from 'node:crypto'

function equalSecret(input: string, expected: string): boolean {
  const left = Buffer.from(input)
  const right = Buffer.from(expected)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function authorizePublish(input: unknown): { ok: true } | { ok: false; error: string; status: number } {
  const expected = process.env.BUTTONPOST_SECRET

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, status: 503, error: 'BUTTONPOST_SECRET must be configured in production.' }
    }
    return { ok: true }
  }

  if (typeof input !== 'string' || !equalSecret(input, expected)) {
    return { ok: false, status: 401, error: 'Invalid publish key.' }
  }

  return { ok: true }
}
