import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { loadOrCreateRunnerToken } from './token.mjs'

test('runner token persists across restarts and can be paired once', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'buttonpost-token-test-'))
  try {
    const first = await loadOrCreateRunnerToken({ directory, override: '' })
    const next = await loadOrCreateRunnerToken({ directory, override: '' })
    assert.equal(first.created, true)
    assert.equal(next.created, false)
    assert.match(first.token, /^[A-Za-z0-9_-]{32,}$/)
    assert.equal(first.token, next.token)
    assert.equal((await readFile(path.join(directory, 'runner-token'), 'utf8')).trim(), first.token)
    if (process.platform !== 'win32') {
      const info = await stat(path.join(directory, 'runner-token'))
      assert.equal(info.mode & 0o077, 0)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('runner token accepts sufficiently strong explicit override', async () => {
  const token = 'q'.repeat(43)
  assert.deepEqual(await loadOrCreateRunnerToken({ override: token }), { token, created: false })
  await assert.rejects(loadOrCreateRunnerToken({ override: 'weak' }), /at least 32/)
})
