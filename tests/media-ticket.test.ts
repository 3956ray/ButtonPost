import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMediaUploadTicket,
  verifyMediaUploadTicket,
} from '../lib/security/media-ticket.ts'

test('media upload tickets are short-lived scoped signatures', () => {
  const previous = process.env.BUTTONPOST_SECRET
  process.env.BUTTONPOST_SECRET = 'test-secret'

  try {
    const ticket = createMediaUploadTicket()
    assert.ok(ticket)
    assert.equal(verifyMediaUploadTicket(ticket), true)
    assert.equal(verifyMediaUploadTicket(ticket + 'tampered'), false)
    assert.equal(verifyMediaUploadTicket('not-a-ticket'), false)
  } finally {
    if (previous === undefined) {
      delete process.env.BUTTONPOST_SECRET
    } else {
      process.env.BUTTONPOST_SECRET = previous
    }
  }
})
