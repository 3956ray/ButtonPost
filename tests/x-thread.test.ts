import assert from 'node:assert/strict'
import test from 'node:test'
import { splitForXThread } from '../lib/publishers/x-thread.ts'

test('keeps short X content as one post', () => {
  assert.deepEqual(splitForXThread('short post', 280), ['short post'])
})

test('splits long X content without rewriting it', () => {
  const source =
    'First paragraph has enough words to be useful.\n\n' +
    'Second paragraph should become the next post when the limit is small.'

  const chunks = splitForXThread(source, 60)

  assert.ok(chunks.length > 1)
  assert.ok(chunks.every((chunk) => chunk.length <= 60))
  assert.equal(chunks.join(' ').replace(/\s+/g, ' ').trim(), source.replace(/\s+/g, ' ').trim())
})

test('uses hard cuts when no natural boundary exists', () => {
  const source = '中'.repeat(25)
  const chunks = splitForXThread(source, 10)

  assert.deepEqual(chunks.map((chunk) => chunk.length), [10, 10, 5])
  assert.equal(chunks.join(''), source)
})
