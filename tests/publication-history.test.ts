import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PUBLICATION_HISTORY_LIMIT,
  filterHistoryByPlatform,
  getHistoryPlatformResult,
  getFailedHistoryPlatforms,
  listHistoryPlatforms,
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


test('publication history can be drilled down by platform without splitting publish attempts', () => {
  const first = entry('first')
  const second: PublicationHistoryEntry = {
    ...entry('second'),
    selected: ['x'],
    results: [{ platform: 'x', status: 'published' }],
  }

  const all = [second, first]

  assert.deepEqual(listHistoryPlatforms(all), ['x', 'devto'])
  assert.deepEqual(
    filterHistoryByPlatform(all, 'devto').map((item) => item.id),
    ['first'],
  )
  assert.equal(
    getHistoryPlatformResult(first, 'devto')?.status,
    'pending',
  )
})

test('retry selects only failed destinations from an attempt', () => {
  const attempt: PublicationHistoryEntry = {
    ...entry('retry'),
    selected: ['x', 'devto', 'jike', 'xiaohongshu'],
    results: [
      { platform: 'x', status: 'published' },
      { platform: 'devto', status: 'failed', error: 'rate limited' },
      { platform: 'jike', status: 'reviewing' },
      { platform: 'xiaohongshu', status: 'failed', error: 'timeout' },
      { platform: 'learnblockchain', status: 'failed', error: 'not selected' },
    ],
  }
  assert.deepEqual(getFailedHistoryPlatforms(attempt), ['devto', 'xiaohongshu'])
  assert.deepEqual(getFailedHistoryPlatforms(entry('none')), [])
})
