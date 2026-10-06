import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PUBLICATION_HISTORY_LIMIT,
  parsePublicationHistory,
  prependHistoryEntry,
  updateHistoryResults,
  type PublicationHistoryEntry,
} from '../lib/publication-history.ts'

function entry(id: string): PublicationHistoryEntry {
  return {
    id,
    createdAt: '2026-10-07T00:00:00.000Z',
    title: 'Title ' + id,
    content: 'Post ' + id,
    imageNames: ['image.png'],
    selected: ['x', 'devto'],
    results: [
      { platform: 'x', status: 'pending' },
      { platform: 'devto', status: 'pending' },
    ],
  }
}

test('publication history parser ignores malformed storage', () => {
  assert.deepEqual(parsePublicationHistory(null), [])
  assert.deepEqual(parsePublicationHistory('{broken'), [])
  assert.deepEqual(parsePublicationHistory(JSON.stringify([{ nope: true }])), [])
})

test('publication history keeps newest entries first and capped', () => {
  let history: PublicationHistoryEntry[] = []
  for (let index = 0; index < PUBLICATION_HISTORY_LIMIT + 5; index += 1) {
    history = prependHistoryEntry(history, entry(String(index)))
  }

  assert.equal(history.length, PUBLICATION_HISTORY_LIMIT)
  assert.equal(history[0]?.id, String(PUBLICATION_HISTORY_LIMIT + 4))
})

test('publication results update independently by platform', () => {
  const history = [entry('one')]
  const updated = updateHistoryResults(history, 'one', [
    {
      platform: 'x',
      status: 'failed',
      error: 'too long',
    },
    {
      platform: 'devto',
      status: 'published',
      externalUrl: 'https://dev.to/example/post',
    },
  ])

  assert.deepEqual(updated[0]?.results, [
    { platform: 'x', status: 'failed', error: 'too long' },
    {
      platform: 'devto',
      status: 'published',
      externalUrl: 'https://dev.to/example/post',
    },
  ])
})
