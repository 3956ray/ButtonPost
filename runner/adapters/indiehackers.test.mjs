import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  INDIE_HACKERS_NEW_POST_URL,
  INDIE_HACKERS_SIGN_IN_URL,
  indieHackersProfileDir,
  isIndieHackersNewPostUrl,
  isIndieHackersSignInUrl,
  isIndieHackersUrl,
  normalizeIndieHackersAccountName,
} from './indiehackers.mjs'

test('normalizes Indie Hackers account names', () => {
  assert.equal(
    normalizeIndieHackersAccountName(' main account '),
    'main-account',
  )
  assert.equal(normalizeIndieHackersAccountName(''), 'default')
})

test('keeps Indie Hackers profiles under the ButtonPost profile root', () => {
  assert.equal(
    indieHackersProfileDir('creator'),
    path.join(
      os.homedir(),
      '.buttonpost',
      'profiles',
      'indiehackers',
      'creator',
    ),
  )
})

test('recognizes Indie Hackers URLs', () => {
  assert.equal(isIndieHackersUrl('https://www.indiehackers.com/'), true)
  assert.equal(isIndieHackersUrl('https://indiehackers.com/post/new'), true)
  assert.equal(isIndieHackersUrl('https://example.com/post/new'), false)
})

test('recognizes sign-in and protected post URLs', () => {
  assert.equal(isIndieHackersSignInUrl(INDIE_HACKERS_SIGN_IN_URL), true)
  assert.equal(isIndieHackersSignInUrl('https://www.indiehackers.com/join'), true)
  assert.equal(isIndieHackersSignInUrl(INDIE_HACKERS_NEW_POST_URL), false)

  assert.equal(isIndieHackersNewPostUrl(INDIE_HACKERS_NEW_POST_URL), true)
  assert.equal(
    isIndieHackersNewPostUrl('https://www.indiehackers.com/post/example'),
    false,
  )
})
