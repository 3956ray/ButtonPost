import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  extractLearnBlockchainArticleId,
  extractLearnBlockchainImageUrl,
  isLearnBlockchainArticleUrl,
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


test('recognizes published LearnBlockchain article URLs', () => {
  assert.equal(
    isLearnBlockchainArticleUrl('https://learnblockchain.cn/article/12345'),
    true,
  )
  assert.equal(
    isLearnBlockchainArticleUrl('https://www.learnblockchain.cn/article/12345/'),
    true,
  )
  assert.equal(
    isLearnBlockchainArticleUrl('https://learnblockchain.cn/article/create'),
    false,
  )
})

test('extracts LearnBlockchain article ids from publish responses', () => {
  assert.equal(extractLearnBlockchainArticleId({ article_id: 123 }), '123')
  assert.equal(
    extractLearnBlockchainArticleId({ data: { article_id: '456' } }),
    '456',
  )
  assert.equal(extractLearnBlockchainArticleId({ articleId: '789' }), '789')
  assert.equal(extractLearnBlockchainArticleId({ code: 0 }), null)
})


test('extracts LearnBlockchain CDN image URLs from upload responses', () => {
  assert.equal(
    extractLearnBlockchainImageUrl({
      url: 'https://img.learnblockchain.cn/attachments/2026/10/example.png',
    }),
    'https://img.learnblockchain.cn/attachments/2026/10/example.png',
  )
  assert.equal(
    extractLearnBlockchainImageUrl(
      '{"path":"attachments/2026/10/example.jpg"}',
    ),
    'https://img.learnblockchain.cn/attachments/2026/10/example.jpg',
  )
  assert.equal(
    extractLearnBlockchainImageUrl(
      'https://learnblockchain.cn/image/show/attachments-2026-10-example.png',
    ),
    'https://learnblockchain.cn/image/show/attachments-2026-10-example.png',
  )
  assert.equal(
    extractLearnBlockchainImageUrl(
      '/image/show/attachments-2026-10-example.png',
    ),
    'https://learnblockchain.cn/image/show/attachments-2026-10-example.png',
  )
  assert.equal(
    extractLearnBlockchainImageUrl('{"ok":true}'),
    null,
  )
})
