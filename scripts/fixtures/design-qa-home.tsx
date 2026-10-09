// CI-ONLY fixture copied into app/design-qa-fixture/page.tsx before a QA build.
// Never commit this route inside app/, and never point it at real credentials.
import { HomeShell } from '@/components/home-shell'
import type { PlatformId, PlatformMetadata } from '@/lib/publishers/types'

const platforms: PlatformMetadata[] = [
  { id: 'x', name: 'X', configured: true, mode: 'API', requiredEnv: [] },
  { id: 'devto', name: 'DEV Community', configured: true, mode: 'API', requiredEnv: [] },
]

export default async function DesignFixture({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const params = await searchParams
  const connectedPlatforms: PlatformId[] =
    params.mode === 'disconnected' ? [] : ['x', 'devto']

  return (
    <HomeShell
      auth={{
        configured: true,
        userId: 'design-qa-fixture',
        email: 'preview@example.test',
        connectedPlatforms,
      }}
      platforms={platforms}
    />
  )
}
