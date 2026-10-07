import type { PlatformId, PublishStatus } from '@/lib/publishers/types'

export const PUBLICATION_HISTORY_KEY = 'buttonpost.publication-history.v1'
export const PUBLICATION_HISTORY_LIMIT = 30

export type HistoryPlatformId = PlatformId | 'xiaohongshu' | 'jike' | 'learnblockchain'
export type HistoryPublishStatus = PublishStatus | 'reviewing' | 'pending'

export type PublicationHistoryResult = {
  platform: HistoryPlatformId
  status: HistoryPublishStatus
  externalId?: string
  externalUrl?: string
  error?: string
}

export type PublicationHistoryEntry = {
  id: string
  createdAt: string
  title: string
  content: string
  imageNames: string[]
  selected: HistoryPlatformId[]
  results: PublicationHistoryResult[]
}

function isPlatform(value: unknown): value is HistoryPlatformId {
  return value === 'x' || value === 'devto' || value === 'xiaohongshu' || value === 'jike' || value === 'learnblockchain'
}

function isStatus(value: unknown): value is HistoryPublishStatus {
  return (
    value === 'published' ||
    value === 'draft' ||
    value === 'failed' ||
    value === 'skipped' ||
    value === 'reviewing' ||
    value === 'pending'
  )
}

function isResult(value: unknown): value is PublicationHistoryResult {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>

  return (
    isPlatform(item.platform) &&
    isStatus(item.status) &&
    (item.externalId === undefined || typeof item.externalId === 'string') &&
    (item.externalUrl === undefined || typeof item.externalUrl === 'string') &&
    (item.error === undefined || typeof item.error === 'string')
  )
}

function isEntry(value: unknown): value is PublicationHistoryEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>

  return (
    typeof item.id === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.title === 'string' &&
    typeof item.content === 'string' &&
    Array.isArray(item.imageNames) &&
    item.imageNames.every((name) => typeof name === 'string') &&
    Array.isArray(item.selected) &&
    item.selected.every(isPlatform) &&
    Array.isArray(item.results) &&
    item.results.every(isResult)
  )
}

export function parsePublicationHistory(raw: string | null): PublicationHistoryEntry[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isEntry).slice(0, PUBLICATION_HISTORY_LIMIT)
  } catch {
    return []
  }
}

export function prependHistoryEntry(
  current: PublicationHistoryEntry[],
  entry: PublicationHistoryEntry,
): PublicationHistoryEntry[] {
  return [entry, ...current.filter((item) => item.id !== entry.id)].slice(
    0,
    PUBLICATION_HISTORY_LIMIT,
  )
}

export function updateHistoryResults(
  current: PublicationHistoryEntry[],
  id: string,
  incoming: PublicationHistoryResult[],
): PublicationHistoryEntry[] {
  return current.map((entry) => {
    if (entry.id !== id) return entry

    const byPlatform = new Map<HistoryPlatformId, PublicationHistoryResult>()
    for (const result of entry.results) byPlatform.set(result.platform, result)
    for (const result of incoming) byPlatform.set(result.platform, result)

    return {
      ...entry,
      results: entry.selected.map(
        (platform) =>
          byPlatform.get(platform) ?? {
            platform,
            status: 'pending' as const,
          },
      ),
    }
  })
}
