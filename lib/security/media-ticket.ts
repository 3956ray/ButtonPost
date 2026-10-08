import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const PURPOSE = 'buttonpost-media-upload'
const NAMESPACE_PURPOSE = 'buttonpost-media-namespace'
const TTL_MS = 5 * 60 * 1000

function signingSecret(): string | null {
  return process.env.BUTTONPOST_SECRET?.trim() || null
}

function mediaNamespace(userId: string, secret: string) {
  return createHmac('sha256', secret)
    .update(NAMESPACE_PURPOSE + ':' + userId)
    .digest('base64url')
    .slice(0, 32)
}

function signature(
  namespace: string,
  expiresAt: string,
  nonce: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(PURPOSE + ':' + namespace + ':' + expiresAt + ':' + nonce)
    .digest('base64url')
}

export type MediaUploadTicket = {
  ticket: string
  prefix: string
}

export type VerifiedMediaUploadTicket = {
  namespace: string
  prefix: string
}

export function mediaPrefixForUser(userId: string): string | null {
  const secret = signingSecret()
  if (!secret) return null

  const namespace = mediaNamespace(userId, secret)
  return `buttonpost/users/${namespace}/`
}

export function createMediaUploadTicket(
  userId: string,
): MediaUploadTicket | null {
  const secret = signingSecret()
  if (!secret) return null

  const namespace = mediaNamespace(userId, secret)
  const prefix = `buttonpost/users/${namespace}/`
  const expiresAt = String(Date.now() + TTL_MS)
  const nonce = randomBytes(12).toString('base64url')
  const sig = signature(namespace, expiresAt, nonce, secret)

  return {
    ticket: [namespace, expiresAt, nonce, sig].join('.'),
    prefix,
  }
}

export function verifyMediaUploadTicket(
  ticket: unknown,
): VerifiedMediaUploadTicket | null {
  if (typeof ticket !== 'string') return null

  const secret = signingSecret()
  if (!secret) return null

  const [namespace, expiresAt, nonce, suppliedSignature, ...rest] =
    ticket.split('.')

  if (
    !namespace ||
    !expiresAt ||
    !nonce ||
    !suppliedSignature ||
    rest.length
  ) {
    return null
  }

  if (!/^[A-Za-z0-9_-]{32}$/.test(namespace)) return null

  const expires = Number(expiresAt)
  if (!Number.isFinite(expires) || expires < Date.now()) return null

  const expectedSignature = signature(
    namespace,
    expiresAt,
    nonce,
    secret,
  )
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)

  if (supplied.length !== expected.length) return null
  if (!timingSafeEqual(supplied, expected)) return null

  return {
    namespace,
    prefix: `buttonpost/users/${namespace}/`,
  }
}
