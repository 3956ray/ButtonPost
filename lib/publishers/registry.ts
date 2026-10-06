import { devtoPublisher } from './devto'
import type { PlatformId, PlatformMetadata, PublisherAdapter } from './types'
import { xPublisher } from './x'

const publishers: Record<PlatformId, PublisherAdapter> = {
  x: xPublisher,
  devto: devtoPublisher,
}

export function getPublisher(id: PlatformId): PublisherAdapter {
  return publishers[id]
}

export function getPlatformMetadata(): PlatformMetadata[] {
  return Object.values(publishers).map((publisher) => ({
    id: publisher.id,
    name: publisher.name,
    mode: publisher.mode,
    configured: publisher.configured(),
    requiredEnv: publisher.requiredEnv,
  }))
}
