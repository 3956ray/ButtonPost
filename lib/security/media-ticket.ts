import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const PURPOSE = 'buttonpost-media-upload'
const TTL_MS = 5 * 60 * 1000

function signingSecret(): string | null {
  return process.env.BUTTONPOST_SECRET?.trim() || null
}

function signature(expiresAt: string, nonce: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(PURPOSE + ':' + expiresAt + ':' + nonce)
    .digest('base64url')
}

export function createMediaUploadTicket(): string | null {
  const secret = signingSecret()
  if (!secret) return null

  const expiresAt = String(Date.now() + TTL_MS)
  const nonce = randomBytes(12).toString('base64url')
  const sig = signature(expiresAt, nonce, secret)

  return [expiresAt, nonce, sig].join('.')
}

export function verifyMediaUploadTicket(ticket: unknown): boolean {
  if (typeof ticket !== 'string') return false

  const secret = signingSecret()
  if (!secret) return false

  const [expiresAt, nonce, suppliedSignature, ...rest] = ticket.split('.')
  if (!expiresAt || !nonce || !suppliedSignature || rest.length) return false

  const expires = Number(expiresAt)
  if (!Number.isFinite(expires) || expires < Date.now()) return false

  const expectedSignature = signature(expiresAt, nonce, secret)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)

  if (supplied.length !== expected.length) return false
  return timingSafeEqual(supplied, expected)
}
