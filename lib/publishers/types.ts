export const PLATFORM_IDS = ['x', 'devto'] as const

export type PlatformId = (typeof PLATFORM_IDS)[number]
export type PublishStatus = 'published' | 'draft' | 'failed' | 'skipped'

export type SourceMedia = {
  url: string
  name?: string
  contentType?: string
}

export type SourcePost = {
  title: string
  content: string
  media?: SourceMedia[]
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string }

export type PublishResult = {
  platform: PlatformId
  status: PublishStatus
  externalId?: string
  externalUrl?: string
  error?: string
}

export type PlatformMetadata = {
  id: PlatformId
  name: string
  mode: 'API' | 'Browser'
  configured: boolean
  requiredEnv: string[]
}

export type XOAuth1Credential = {
  kind: 'x-oauth1'
  accessToken: string
  accessSecret: string
}

export type DevtoApiKeyCredential = {
  kind: 'devto-api-key'
  apiKey: string
}

export type PlatformCredential =
  | XOAuth1Credential
  | DevtoApiKeyCredential

export type PlatformCredentialMap = Partial<
  Record<PlatformId, PlatformCredential>
>

export interface PublisherAdapter {
  readonly id: PlatformId
  readonly name: string
  readonly mode: PlatformMetadata['mode']
  readonly requiredEnv: string[]
  configured(): boolean
  validate(post: SourcePost): ValidationResult
  publish(
    post: SourcePost,
    credential?: PlatformCredential,
  ): Promise<PublishResult>
}
