import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
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
