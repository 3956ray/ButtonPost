import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptJson, encryptJson } from '@/lib/security/credential-crypto'
import type {
  PlatformCredential,
  PlatformId,
} from '@/lib/publishers/types'

export type ConnectionSummary = {
  platform: PlatformId
  status: string
  externalAccountId: string | null
  externalUsername: string | null
}

function isPlatformCredential(
  platform: PlatformId,
  value: unknown,
): value is PlatformCredential {
  if (!value || typeof value !== 'object') return false
  const credential = value as Record<string, unknown>

  if (platform === 'x') {
    return (
      credential.kind === 'x-oauth1' &&
      typeof credential.accessToken === 'string' &&
      typeof credential.accessSecret === 'string'
    )
  }

  return (
    credential.kind === 'devto-api-key' &&
    typeof credential.apiKey === 'string'
  )
}

export async function listConnections(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConnectionSummary[]> {
  const { data, error } = await supabase
    .from('platform_connections')
    .select('platform,status,external_account_id,external_username')
    .eq('user_id', userId)
    .order('platform')

  if (error) throw error

  return (data ?? []).flatMap((row) => {
    if (row.platform !== 'x' && row.platform !== 'devto') return []

    return [{
      platform: row.platform,
      status: row.status,
      externalAccountId: row.external_account_id,
      externalUsername: row.external_username,
    }]
  })
}

export async function saveConnection(
  supabase: SupabaseClient,
  userId: string,
  platform: PlatformId,
  credential: PlatformCredential,
  metadata: {
    externalAccountId?: string | null
    externalUsername?: string | null
  } = {},
) {
  const now = new Date().toISOString()
  const { data: connection, error: connectionError } = await supabase
    .from('platform_connections')
    .upsert(
      {
        user_id: userId,
        platform,
        status: 'connected',
        external_account_id: metadata.externalAccountId ?? null,
        external_username: metadata.externalUsername ?? null,
        updated_at: now,
      },
      { onConflict: 'user_id,platform' },
    )
    .select('id')
    .single()

  if (connectionError) throw connectionError

  const { error: secretError } = await supabase
    .from('platform_secrets')
    .upsert(
      {
        connection_id: connection.id,
        encrypted_payload: encryptJson(credential),
        key_version: 1,
        updated_at: now,
      },
      { onConflict: 'connection_id' },
    )

  if (secretError) throw secretError
}

export async function loadCredential(
  supabase: SupabaseClient,
  userId: string,
  platform: PlatformId,
): Promise<PlatformCredential | null> {
  const { data: connection, error: connectionError } = await supabase
    .from('platform_connections')
    .select('id,status')
    .eq('user_id', userId)
    .eq('platform', platform)
    .maybeSingle()

  if (connectionError) throw connectionError
  if (!connection || connection.status !== 'connected') return null

  const { data: secret, error: secretError } = await supabase
    .from('platform_secrets')
    .select('encrypted_payload')
    .eq('connection_id', connection.id)
    .maybeSingle()

  if (secretError) throw secretError
  if (!secret?.encrypted_payload) return null

  const credential = decryptJson<unknown>(secret.encrypted_payload)
  if (!isPlatformCredential(platform, credential)) {
    throw new Error('Stored platform credential has an unexpected format.')
  }

  return credential
}

export async function deleteConnection(
  supabase: SupabaseClient,
  userId: string,
  platform: PlatformId,
) {
  const { error } = await supabase
    .from('platform_connections')
    .delete()
    .eq('user_id', userId)
    .eq('platform', platform)

  if (error) throw error
}
