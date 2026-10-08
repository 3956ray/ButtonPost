import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import test from 'node:test'

async function freePort() {
  const listener = createServer()
  listener.listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const port = listener.address().port
  listener.close()
  await once(listener, 'close')
  return port
}

test('local runner serves health and accepts authenticated calls from production web origin', async () => {
  const port = await freePort()
  const token = 'q'.repeat(43)
  const processRunner = spawn(process.execPath, ['runner/server.mjs'], {
    env: {
      ...process.env,
      BUTTONPOST_RUNNER_PORT: String(port),
      BUTTONPOST_RUNNER_TOKEN: token,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const origin = 'https://buttonpost.app'
  const base = 'http://127.0.0.1:' + port

  try {
    let ready = false
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (processRunner.exitCode !== null) {
        throw new Error('Runner terminated before startup')
      }
      try {
        const response = await fetch(base + '/health', {
          headers: { Origin: origin },
        })
        const body = await response.json()
        if (response.ok && body.ok && body.name === 'ButtonPost Local Runner') {
          assert.equal(response.headers.get('access-control-allow-origin'), origin)
          ready = true
          break
        }
      } catch {
        // Still starting up.
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(ready, true, 'runner started')

    const preflight = await fetch(base + '/v1/echo', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Private-Network': 'true',
      },
    })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true')

    const echo = await fetch(base + '/v1/echo', {
      method: 'POST',
      headers: {
        Origin: origin,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Readiness check', content: '' }),
    })
    assert.equal(echo.status, 200)
    assert.equal((await echo.json()).ok, true)

    const forbiddenOrigin = await fetch(base + '/health', {
      headers: { Origin: 'https://untrusted.example' },
    })
    assert.equal(forbiddenOrigin.status, 403)

    const noToken = await fetch(base + '/v1/echo', {
      method: 'POST',
      headers: { Origin: origin },
    })
    assert.equal(noToken.status, 401)
  } finally {
    processRunner.kill('SIGTERM')
    if (processRunner.exitCode === null) await Promise.race([
      once(processRunner, 'exit'),
      new Promise(resolve => setTimeout(resolve, 1500)),
    ])
  }
})
