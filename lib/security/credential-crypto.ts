import 'server-only'
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'

function encryptionKey(): Buffer {
  const encoded = process.env.BUTTONPOST_CREDENTIAL_ENCRYPTION_KEY?.trim()
  if (!encoded) {
    throw new Error('Credential encryption is not configured.')
  }

  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) {
    throw new Error('BUTTONPOST_CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes.')
  }

  return key
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

export function decryptJson<T>(payload: string): T {
  const [version, ivPart, tagPart, ciphertextPart, ...rest] = payload.split('.')

  if (
    version !== VERSION ||
    !ivPart ||
    !tagPart ||
    !ciphertextPart ||
    rest.length
  ) {
    throw new Error('Encrypted credential payload is invalid.')
  }

  const iv = Buffer.from(ivPart, 'base64url')
  const tag = Buffer.from(tagPart, 'base64url')
  const ciphertext = Buffer.from(ciphertextPart, 'base64url')

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv)
  decipher.setAuthTag(tag)

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return JSON.parse(plaintext.toString('utf8')) as T
}
