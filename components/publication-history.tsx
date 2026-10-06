'use client'

import type {
  PublicationHistoryEntry,
  PublicationHistoryResult,
} from '@/lib/publication-history'

type Props = {
  entries: PublicationHistoryEntry[]
  onReuse: (entry: PublicationHistoryEntry) => void
  onClear: () => void
}

function platformLabel(platform: PublicationHistoryResult['platform']) {
  if (platform === 'devto') return 'DEV'
  if (platform === 'xiaohongshu') return '小红书'
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

export function PublicationHistory({ entries, onReuse, onClear }: Props) {
  return (
    <section className="history-card">
      <div className="history-heading">
        <div>
          <span className="eyebrow">Local history</span>
          <h2>Publication history</h2>
          <p>
            The latest publish attempts from this browser, including failures and per-platform results.
          </p>
        </div>
        {entries.length > 0 ? (
          <button type="button" className="history-clear" onClick={onClear}>
            Clear history
          </button>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <div className="history-empty">
          Your next publish attempt will appear here and remain after a page refresh.
        </div>
      ) : (
        <div className="history-list">
          {entries.map((entry) => (
            <article className="history-item" key={entry.id}>
              <div className="history-item-top">
                <div>
                  <div className="history-meta">
                    <span>{dateLabel(entry.createdAt)}</span>
                    <span>·</span>
                    <span>{overallStatus(entry)}</span>
                  </div>
                  <h3>{entry.title}</h3>
                </div>
                <button
                  type="button"
                  className="history-reuse"
                  onClick={() => onReuse(entry)}
                >
                  Reuse
                </button>
              </div>

              <p className="history-preview">
                {entry.content.length > 220
                  ? entry.content.slice(0, 220) + '…'
                  : entry.content}
              </p>

              {entry.imageNames.length > 0 ? (
                <p className="history-images">
                  {entry.imageNames.length} image{entry.imageNames.length === 1 ? '' : 's'} ·{' '}
                  {entry.imageNames.join(' · ')}
                </p>
              ) : null}

              <div className="history-results">
                {entry.results.map((result) => (
                  <div className="history-result" key={result.platform}>
                    <strong>{platformLabel(result.platform)}</strong>
                    <span className={'status ' + result.status}>{result.status}</span>
                    <span className="history-result-detail">
                      {result.externalUrl ? (
                        <a href={result.externalUrl} target="_blank" rel="noreferrer">
                          Open ↗
                        </a>
                      ) : (
                        result.error ?? result.externalId ?? '—'
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="history-privacy">
        Stored only in this browser for now. Secrets and runner credentials are never written to publication history.
      </p>
    </section>
  )
}
