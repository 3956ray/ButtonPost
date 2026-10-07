import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  extractJikePostId,
  isJikeLoginUrl,
  jikeProfileDir,
  normalizeJikeAccountName,
} from './jike.mjs'

test('normalizes Jike account names for local profiles', () => {
  assert.equal(normalizeJikeAccountName(' main account '), 'main-account')
  assert.equal(normalizeJikeAccountName(''), 'default')
})

test('keeps Jike profiles under the ButtonPost profile root', () => {
  assert.equal(
    jikeProfileDir('creator'),
    path.join(os.homedir(), '.buttonpost', 'profiles', 'jike', 'creator'),
  )
})

test('recognizes Jike login URLs', () => {
  assert.equal(isJikeLoginUrl('https://web.okjike.com/login'), true)
  assert.equal(isJikeLoginUrl('https://web.okjike.com/login/qr'), true)
  assert.equal(isJikeLoginUrl('https://web.okjike.com/recommend'), false)
})


test('extracts a Jike post id from common create response shapes', () => {
  assert.equal(extractJikePostId({ id: 'one' }), 'one')
  assert.equal(extractJikePostId({ data: { id: 'two' } }), 'two')
  assert.equal(extractJikePostId({ post: { id: 'three' } }), 'three')
  assert.equal(extractJikePostId({ data: { post: { id: 'four' } } }), 'four')
  assert.equal(extractJikePostId({ success: true }), null)
})
