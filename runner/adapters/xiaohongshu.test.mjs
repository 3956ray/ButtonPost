import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  isXiaohongshuLoginUrl,
  normalizeAccountName,
  xiaohongshuProfileDir,
} from './xiaohongshu.mjs'

test('normalizes Xiaohongshu account names for local profile paths', () => {
  assert.equal(normalizeAccountName(' main account '), 'main-account')
  assert.equal(normalizeAccountName('../../oops'), '..-..-oops')
  assert.equal(normalizeAccountName(''), 'default')
})

test('keeps Xiaohongshu profiles under the ButtonPost profile root', () => {
  const expected = path.join(
    os.homedir(),
    '.buttonpost',
    'profiles',
    'xiaohongshu',
    'creator',
  )
  assert.equal(xiaohongshuProfileDir('creator'), expected)
})

test('recognizes Xiaohongshu creator login URLs regardless of query string', () => {
  assert.equal(
    isXiaohongshuLoginUrl(
      'https://creator.xiaohongshu.com/login?source=&redirectReason=401&lastUrl=%252Fnew%252Fnote-manager%253FroleType%253Dcreator',
    ),
    true,
  )
  assert.equal(
    isXiaohongshuLoginUrl('https://creator.xiaohongshu.com/login?foo=bar'),
    true,
  )
  assert.equal(
    isXiaohongshuLoginUrl(
      'https://creator.xiaohongshu.com/publish/publish?from=homepage&target=image',
    ),
    false,
  )
})
