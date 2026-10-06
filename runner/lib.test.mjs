import assert from 'node:assert/strict'
import test from 'node:test'
import { corsHeaders, isAuthorized, isOriginAllowed, parseAllowedOrigins } from './lib.mjs'

test('allowed origins are parsed and enforced', () => {
  const origins = parseAllowedOrigins('https://buttonpost.vercel.app, http://localhost:3000')
  assert.equal(isOriginAllowed('https://buttonpost.vercel.app', origins), true)
  assert.equal(isOriginAllowed('https://example.com', origins), false)
  assert.equal(isOriginAllowed(undefined, origins), true)
})

test('runner token uses bearer authentication', () => {
  assert.equal(isAuthorized('Bearer secret-token', 'secret-token'), true)
  assert.equal(isAuthorized('Bearer wrong-token', 'secret-token'), false)
  assert.equal(isAuthorized(undefined, 'secret-token'), false)
})

test('cors headers expose the approved origin and private-network opt-in', () => {
  const origins = parseAllowedOrigins('https://buttonpost.vercel.app')
  const headers = corsHeaders('https://buttonpost.vercel.app', origins)
  assert.equal(headers['Access-Control-Allow-Origin'], 'https://buttonpost.vercel.app')
  assert.equal(headers['Access-Control-Allow-Private-Network'], 'true')
})
