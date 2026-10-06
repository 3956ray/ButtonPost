import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
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
