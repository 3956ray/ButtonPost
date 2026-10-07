import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  isLearnBlockchainLoginUrl,
  isLearnBlockchainSiteUrl,
  learnBlockchainProfileDir,
  normalizeLearnBlockchainAccountName,
} from './learnblockchain.mjs'

test('normalizes LearnBlockchain account names', () => {
  assert.equal(
    normalizeLearnBlockchainAccountName(' main account '),
    'main-account',
  )
  assert.equal(normalizeLearnBlockchainAccountName(''), 'default')
})

test('keeps LearnBlockchain profiles under the ButtonPost profile root', () => {
  assert.equal(
    learnBlockchainProfileDir('creator'),
    path.join(
      os.homedir(),
      '.buttonpost',
      'profiles',
      'learnblockchain',
      'creator',
    ),
  )
})

test('recognizes LearnBlockchain login-style URLs', () => {
  assert.equal(
    isLearnBlockchainLoginUrl('https://learnblockchain.cn/login'),
    true,
  )
  assert.equal(
    isLearnBlockchainLoginUrl('https://www.learnblockchain.cn/auth/login'),
    true,
  )
  assert.equal(
    isLearnBlockchainLoginUrl('https://learnblockchain.cn/article/123'),
    false,
  )
})


test('recognizes LearnBlockchain site URLs without treating GitHub OAuth as local auth', () => {
  assert.equal(
    isLearnBlockchainSiteUrl('https://learnblockchain.cn/'),
    true,
  )
  assert.equal(
    isLearnBlockchainSiteUrl('https://www.learnblockchain.cn/article/1'),
    true,
  )
  assert.equal(
    isLearnBlockchainSiteUrl('https://github.com/login/oauth/authorize'),
    false,
  )
})
