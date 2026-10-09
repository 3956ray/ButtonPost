'use client'

import { useMemo, useState } from 'react'
import {
  filterHistoryByPlatform,
  getHistoryPlatformResult,
  getFailedHistoryPlatforms,
  listHistoryPlatforms,
  type HistoryPlatformId,
  type PublicationHistoryEntry,
  type PublicationHistoryResult,
} from '@/lib/publication-history'

type Props = {
  entries: PublicationHistoryEntry[]
  onReuse: (entry: PublicationHistoryEntry) => void
  onRetryFailed: (entry: PublicationHistoryEntry) => void
  onClear: () => void
}

function platformLabel(platform: PublicationHistoryResult['platform']) {
  if (platform === 'devto') return 'DEV'
  if (platform === 'xiaohongshu') return '小红书'
  if (platform === 'jike') return '即刻'
  if (platform === 'learnblockchain') return '登链社区'
  if (platform === 'indiehackers') return 'Indie Hackers'
  return 'X'
}

function overallStatus(entry: PublicationHistoryEntry) {
  const statuses = entry.results.map((result) => result.status)

  if (statuses.some((status) => status === 'pending' || status === 'reviewing')) {
    return 'In progress'
  }

  if (statuses.every((status) => status === 'published' || status === 'draft')) {
    return 'Completed'
  }

  if (statuses.some((status) => status === 'published' || status === 'draft')) {
    return 'Partial'
  }

  return 'Failed'
}

function dateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function platformStatusLabel(
  entry: PublicationHistoryEntry,
  platform: HistoryPlatformId,
) {
  return getHistoryPlatformResult(entry, platform)?.status ?? 'pending'
}

export function PublicationHistory({ entries, onReuse, onRetryFailed, onClear }: Props) {
  const [activePlatform, setActivePlatform] = useState<HistoryPlatformId | null>(
    null,
  )
  const [expandedIds, setExpandedIds] = useState<string[]>([])

  const availablePlatforms = useMemo(
    () => listHistoryPlatforms(entries),
    [entries],
  )
  const visibleEntries = useMemo(
    () => filterHistoryByPlatform(entries, activePlatform),
    [entries, activePlatform],
  )

  function toggleExpanded(id: string) {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((entryId) => entryId !== id)
        : [...current, id],
    )
  }

  function platformCount(platform: HistoryPlatformId) {
    return entries.filter((entry) => entry.selected.includes(platform)).length
  }

  return (
    <section className="history-card">
      <div className="history-heading">
        <div>
          <span className="eyebrow">YOUR PRIVATE ACTIVITY</span>
          <h2>Post history</h2>
          <p>
            See where each post went, which platform needs attention, and reuse
            a post without starting over. Filter your activity by destination.
          </p>
        </div>
        {entries.length > 0 ? (
          <button type="button" className="history-clear" onClick={onClear}>
            Clear history
          </button>
        ) : null}
      </div>

      {entries.length > 0 ? (
        <div className="history-filters" aria-label="Post history platform">
          <button
            type="button"
            className={'history-filter ' + (!activePlatform ? 'active' : '')}
            aria-pressed={!activePlatform}
            onClick={() => setActivePlatform(null)}
          >
            <span>All posts</span>
            <strong>{entries.length}</strong>
          </button>

          {availablePlatforms.map((platform) => (
            <button
              type="button"
              className={
                'history-filter ' +
                (activePlatform === platform ? 'active' : '')
              }
              aria-pressed={activePlatform === platform}
              key={platform}
              onClick={() => setActivePlatform(platform)}
            >
              <span>{platformLabel(platform)}</span>
              <strong>{platformCount(platform)}</strong>
            </button>
          ))}
        </div>
      ) : null}

      {activePlatform ? (
        <div className="history-view-context">
          <span className="eyebrow">Platform history</span>
          <strong>{platformLabel(activePlatform)}</strong>
          <span>
            {visibleEntries.length} post
            {visibleEntries.length === 1 ? '' : 's'}
          </span>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <div className="history-empty">
          Nothing here yet. Your first post will appear here.
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="history-empty">
          No posts for this platform yet.
        </div>
      ) : (
        <div className="history-list">
          {visibleEntries.map((entry) => {
            const failedCount = getFailedHistoryPlatforms(entry).length
            const expanded = expandedIds.includes(entry.id)
            const filteredResult = activePlatform
              ? getHistoryPlatformResult(entry, activePlatform)
              : undefined
            const detailResults = activePlatform
              ? filteredResult
                ? [filteredResult]
                : []
              : entry.results

            return (
              <article className="history-item" key={entry.id}>
                <div className="history-item-top">
                  <div>
                    <div className="history-meta">
                      <span>{dateLabel(entry.createdAt)}</span>
                      <span>·</span>
                      <span>
                        {activePlatform
                          ? filteredResult?.status ?? 'pending'
                          : overallStatus(entry)}
                      </span>
                    </div>
                    <h3>{entry.title}</h3>
                  </div>

                  <div className="history-item-actions">
                    {!activePlatform ? (
                      <button
                        type="button"
                        className="history-details"
                        aria-expanded={expanded}
                        onClick={() => toggleExpanded(entry.id)}
                      >
                        {expanded ? 'Hide details' : 'Details'}
                      </button>
                    ) : null}
                    {failedCount > 0 ? (
                      <button
                        type="button"
                        className="history-reuse"
                        title="Prepares only failed platforms. Review and click Post to retry."
                        onClick={() => onRetryFailed(entry)}
                      >
                        Retry failed ({failedCount})
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="history-reuse"
                      onClick={() => onReuse(entry)}
                    >
                      Reuse
                    </button>
                  </div>
                </div>

                <div className="history-platforms">
                  <span className="history-platforms-label">Destinations</span>
                  <div className="history-platform-chips">
                    {entry.selected.map((platform) => {
                      const status = platformStatusLabel(entry, platform)

                      return (
                        <button
                          type="button"
                          key={platform}
                          className={
                            'history-platform-chip ' +
                            status +
                            (activePlatform === platform ? ' active' : '')
                          }
                          aria-label={
                            'View ' +
                            platformLabel(platform) +
                            ' post history'
                          }
                          onClick={() => setActivePlatform(platform)}
                        >
                          <span>{platformLabel(platform)}</span>
                          <span className="history-platform-chip-dot" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <p className="history-preview">
                  {entry.content.length > 220
                    ? entry.content.slice(0, 220) + '…'
                    : entry.content}
                </p>

                {entry.imageNames.length > 0 ? (
                  <p className="history-images">
                    {entry.imageNames.length} image
                    {entry.imageNames.length === 1 ? '' : 's'} ·{' '}
                    {entry.imageNames.join(' · ')}
                  </p>
                ) : null}

                {activePlatform || expanded ? (
                  <div className="history-detail-panel">
                    <div className="history-detail-heading">
                      <span className="eyebrow">
                        {activePlatform ? 'Platform result' : 'Post results'}
                      </span>
                      {!activePlatform ? (
                        <span>{entry.selected.length} destinations</span>
                      ) : null}
                    </div>

                    <div className="history-results">
                      {detailResults.map((result) => (
                        <div className="history-result" key={result.platform}>
                          <strong>{platformLabel(result.platform)}</strong>
                          <span className={'status ' + result.status}>
                            {result.status}
                          </span>
                          <span className="history-result-detail">
                            {result.externalUrl ? (
                              <a
                                href={result.externalUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View post ↗
                              </a>
                            ) : (
                              result.error ??
                              result.externalId ??
                              'No additional details.'
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      <p className="history-privacy">
        Stored only in this browser for now. Secrets and runner credentials are never
        written to post history.
      </p>
    </section>
  )
}
