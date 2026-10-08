import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMediaUploadTicket,
  mediaPrefixForUser,
  verifyMediaUploadTicket,
} from '../lib/security/media-ticket.ts'

test('media upload tickets are short-lived and scoped to an opaque user namespace', () => {
  const previous = process.env.BUTTONPOST_SECRET
  process.env.BUTTONPOST_SECRET = 'test-secret'

  try {
    const userA = '00000000-0000-4000-8000-000000000001'
    const userB = '00000000-0000-4000-8000-000000000002'

    const ticketA = createMediaUploadTicket(userA)
    const ticketB = createMediaUploadTicket(userB)

    assert.ok(ticketA)
    assert.ok(ticketB)

    assert.match(ticketA.prefix, /^buttonpost\/users\/[A-Za-z0-9_-]{32}\/$/)
    assert.match(ticketB.prefix, /^buttonpost\/users\/[A-Za-z0-9_-]{32}\/$/)
    assert.notEqual(ticketA.prefix, ticketB.prefix)
    assert.equal(ticketA.prefix, mediaPrefixForUser(userA))

    const verified = verifyMediaUploadTicket(ticketA.ticket)
    assert.ok(verified)
    assert.equal(verified.prefix, ticketA.prefix)

    assert.equal(
      verifyMediaUploadTicket(ticketA.ticket + 'tampered'),
      null,
    )
    assert.equal(verifyMediaUploadTicket('not-a-ticket'), null)
  } finally {
    if (previous === undefined) {
      delete process.env.BUTTONPOST_SECRET
    } else {
      process.env.BUTTONPOST_SECRET = previous
    }
  }
})
