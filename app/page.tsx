import { HomeShell } from '@/components/home-shell'
import { getPlatformMetadata } from '@/lib/publishers/registry'
import type { PlatformId } from '@/lib/publishers/types'
import { getSupabasePublicConfig } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

async function getAuthState() {
  if (!getSupabasePublicConfig()) {
    return {
      configured: false,
      userId: null as string | null,
      email: null as string | null,
      connectedPlatforms: [] as PlatformId[],
    }
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        configured: true,
        userId: null as string | null,
        email: null as string | null,
        connectedPlatforms: [] as PlatformId[],
      }
    }

    const { data: connections } = await supabase
      .from('platform_connections')
      .select('platform')
      .eq('user_id', user.id)
      .eq('status', 'connected')

    const connectedPlatforms = (connections ?? []).flatMap((connection) =>
      connection.platform === 'x' || connection.platform === 'devto'
        ? [connection.platform]
        : [],
    ) as PlatformId[]

    return {
      configured: true,
      userId: user.id,
      email: user.email ?? null,
      connectedPlatforms,
    }
  } catch {
    return {
      configured: true,
      userId: null as string | null,
      email: null as string | null,
      connectedPlatforms: [] as PlatformId[],
    }
  }
}


export default async function HomePage() {
  const [platforms, auth] = await Promise.all([
    Promise.resolve(getPlatformMetadata()),
    getAuthState(),
  ])
  return <HomeShell auth={auth} platforms={platforms} />
}
