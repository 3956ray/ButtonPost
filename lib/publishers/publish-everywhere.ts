import { getPublisher } from './registry'
import type { PlatformId, PublishResult, SourcePost } from './types'

export async function publishEverywhere(post: SourcePost, platforms: PlatformId[]): Promise<PublishResult[]> {
  const uniquePlatforms = [...new Set(platforms)]

  return Promise.all(
    uniquePlatforms.map(async (platform) => {
      try {
        return await getPublisher(platform).publish(post)
      } catch (cause) {
        return {
          platform,
          status: 'failed' as const,
          error: cause instanceof Error ? cause.message : 'Unexpected publisher error.',
        }
      }
    }),
  )
}
