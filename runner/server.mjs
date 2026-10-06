import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { corsHeaders, isAuthorized, isOriginAllowed, parseAllowedOrigins } from './lib.mjs'

const VERSION = '0.1.0'
const host = process.env.BUTTONPOST_RUNNER_HOST || '127.0.0.1'
const port = Number(process.env.BUTTONPOST_RUNNER_PORT || '27123')
const token = process.env.BUTTONPOST_RUNNER_TOKEN || randomBytes(24).toString('base64url')
const allowedOrigins = parseAllowedOrigins(
  process.env.BUTTONPOST_ALLOWED_ORIGINS ||
    'https://buttonpost.vercel.app,http://localhost:3000',
)

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  })
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  const chunks = []
  let size = 0

  for await (const chunk of req) {
    size += chunk.length
    if (size > 1024 * 1024) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }

  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  const cors = corsHeaders(origin, allowedOrigins)

  if (!isOriginAllowed(origin, allowedOrigins)) {
    return sendJson(res, 403, { error: 'Origin is not allowed by this ButtonPost runner.' }, cors)
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    return res.end()
  }

  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(
      res,
      200,
      {
        ok: true,
        name: 'ButtonPost Local Runner',
        version: VERSION,
        status: 'ready',
        capabilities: [],
      },
      cors,
    )
  }

  if (!isAuthorized(req.headers.authorization, token)) {
    return sendJson(res, 401, { error: 'Invalid runner token.' }, cors)
  }

  if (req.method === 'POST' && req.url === '/v1/echo') {
    try {
      const body = await readJson(req)
      return sendJson(
        res,
        200,
        {
          ok: true,
          runner: VERSION,
          received: {
            title: typeof body.title === 'string' ? body.title : '',
            contentLength: typeof body.content === 'string' ? body.content.length : 0,
          },
        },
        cors,
      )
    } catch (cause) {
      return sendJson(
        res,
        400,
        { error: cause instanceof Error ? cause.message : 'Invalid request body.' },
        cors,
      )
    }
  }

  if (req.method === 'POST' && req.url === '/v1/publish') {
    return sendJson(
      res,
      501,
      {
        error: 'No local publisher is installed yet. Xiaohongshu is the next adapter.',
      },
      cors,
    )
  }

  return sendJson(res, 404, { error: 'Not found.' }, cors)
})

server.listen(port, host, () => {
  console.log('')
  console.log('ButtonPost Local Runner')
  console.log(`  URL:   http://${host}:${port}`)
  console.log(`  Token: ${token}`)
  console.log(`  Allowed origins: ${[...allowedOrigins].join(', ')}`)
  console.log('')
  console.log('Keep this terminal open while ButtonPost uses local browser publishers.')
  console.log('The token stays on your machine; paste it into ButtonPost only when pairing.')
  console.log('')
})
