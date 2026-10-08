import { loadOrCreateRunnerToken } from './token.mjs'
import { createServer } from 'node:http'
import { corsHeaders, isAuthorized, isOriginAllowed, parseAllowedOrigins } from './lib.mjs'
import {
  getXiaohongshuStatus,
  loginXiaohongshu,
  publishXiaohongshuNote,
} from './adapters/xiaohongshu.mjs'
import {
  readIndieHackersPostMultipart,
  readJikePostMultipart,
  readLearnBlockchainArticleMultipart,
  readXiaohongshuNoteMultipart,
} from './multipart.mjs'
import { getJikeStatus, loginJike, publishJikePost } from './adapters/jike.mjs'
import {
  getLearnBlockchainStatus,
  loginLearnBlockchain,
  publishLearnBlockchainArticle,
} from './adapters/learnblockchain.mjs'
import {
  getIndieHackersStatus,
  loginIndieHackers,
  publishIndieHackersPost,
} from './adapters/indiehackers.mjs'

const VERSION = '0.8.1'
const host = process.env.BUTTONPOST_RUNNER_HOST || '127.0.0.1'
const port = Number(process.env.BUTTONPOST_RUNNER_PORT || '27123')
const { token } = await loadOrCreateRunnerToken()
const allowedOrigins = parseAllowedOrigins(
  process.env.BUTTONPOST_ALLOWED_ORIGINS ||
    'https://buttonpost.app,https://www.buttonpost.app,https://buttonpost.vercel.app,http://localhost:3000',
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

function errorBody(cause) {
  return {
    error: cause instanceof Error ? cause.message : 'Unexpected local runner error.',
  }
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  const cors = corsHeaders(origin, allowedOrigins)
  const requestUrl = new URL(req.url || '/', 'http://' + host + ':' + port)

  if (!isOriginAllowed(origin, allowedOrigins)) {
    return sendJson(res, 403, { error: 'Origin is not allowed by this ButtonPost runner.' }, cors)
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    return res.end()
  }

  if (req.method === 'GET' && requestUrl.pathname === '/health') {
    return sendJson(
      res,
      200,
      {
        ok: true,
        name: 'ButtonPost Local Runner',
        version: VERSION,
        status: 'ready',
        capabilities: ['xiaohongshu:auth', 'xiaohongshu:note', 'jike:auth', 'jike:post', 'learnblockchain:auth', 'learnblockchain:article', 'indiehackers:auth', 'indiehackers:post'],
      },
      cors,
    )
  }

  if (!isAuthorized(req.headers.authorization, token)) {
    return sendJson(res, 401, { error: 'Invalid runner token.' }, cors)
  }

  if (req.method === 'POST' && requestUrl.pathname === '/v1/echo') {
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
      return sendJson(res, 400, errorBody(cause), cors)
    }
  }

  if (
    req.method === 'GET' &&
    requestUrl.pathname === '/v1/platforms/xiaohongshu/status'
  ) {
    try {
      const result = await getXiaohongshuStatus(
        requestUrl.searchParams.get('account') || 'default',
      )
      return sendJson(res, result.ok ? 200 : 409, result, cors)
    } catch (cause) {
      return sendJson(res, 500, errorBody(cause), cors)
    }
  }

  if (
    req.method === 'POST' &&
    requestUrl.pathname === '/v1/platforms/xiaohongshu/login'
  ) {
    try {
      const body = await readJson(req)
      const result = await loginXiaohongshu(
        typeof body.account === 'string' ? body.account : 'default',
      )
      return sendJson(res, result.ok ? 200 : 409, result, cors)
    } catch (cause) {
      return sendJson(res, 500, errorBody(cause), cors)
    }
  }

  if (
    req.method === 'POST' &&
    requestUrl.pathname === '/v1/platforms/xiaohongshu/publish-note'
  ) {
    let upload
    try {
      upload = await readXiaohongshuNoteMultipart(req)
      const result = await publishXiaohongshuNote({
        account: upload.fields.account || 'default',
        title: upload.fields.title || '',
        content: upload.fields.content || '',
        imagePaths: upload.imagePaths,
      })
      return sendJson(res, result.ok ? 200 : 409, result, cors)
    } catch (cause) {
      return sendJson(res, 500, errorBody(cause), cors)
    } finally {
      await upload?.cleanup().catch(() => {})
    }
  }


  if (
    req.method === 'GET' &&
    requestUrl.pathname === '/v1/platforms/jike/status'
  ) {
    try {
      const result = await getJikeStatus(
        requestUrl.searchParams.get('account') || 'default',
      )
      return sendJson(res, result.ok ? 200 : 409, result, cors)
    } catch (cause) {
      return sendJson(res, 500, errorBody(cause), cors)
    }
  }

  if (
    req.method === 'POST' &&
    requestUrl.pathname === '/v1/platforms/jike/login'
  ) {
    try {
      const body = await readJson(req)
      const result = await loginJike(
        typeof body.account === 'string' ? body.account : 'default',
      )
      return sendJson(res, result.ok ? 200 : 409, result, cors)
    } catch (cause) {
      return sendJson(res, 500, errorBody(cause), cors)
    }
  }


  if (
    req.method === 'POST' &&
    requestUrl.pathname === '/v1/platforms/jike/publish-post'
  ) {
    let upload
    try {
      upload = await readJikePostMultipart(req)
      const result = await publishJikePost({
        account: upload.fields.account || 'default',
        content: upload.fields.content || '',
        imagePaths: upload.imagePaths,
      })
      return sendJson(res, result.ok ? 200 : 409, result, cors)
    } catch (cause) {
      return sendJson(res, 500, errorBody(cause), cors)
    } finally {
      await upload?.cleanup().catch(() => {})
    }
  }


  if (
    req.method === 'GET' &&
    requestUrl.pathname === '/v1/platforms/learnblockchain/status'
  ) {
    try {
      const result = await getLearnBlockchainStatus(
        requestUrl.searchParams.get('account') || 'default',
      )
      return sendJson(res, result.ok ? 200 : 409, result, cors)
    } catch (cause) {
      return sendJson(res, 500, errorBody(cause), cors)
    }
  }

  if (
    req.method === 'POST' &&
    requestUrl.pathname === '/v1/platforms/learnblockchain/login'
  ) {
    try {
      const body = await readJson(req)
      const result = await loginLearnBlockchain(
        typeof body.account === 'string' ? body.account : 'default',
      )
      return sendJson(res, result.ok ? 200 : 409, result, cors)
    } catch (cause) {
      return sendJson(res, 500, errorBody(cause), cors)
    }
  }

  if (
    req.method === 'POST' &&
    requestUrl.pathname === '/v1/platforms/learnblockchain/publish-article'
  ) {
    let upload
    try {
      upload = await readLearnBlockchainArticleMultipart(req)
      const result = await publishLearnBlockchainArticle({
        account: upload.fields.account || 'default',
        title: upload.fields.title || '',
        content: upload.fields.content || '',
        imagePaths: upload.imagePaths,
      })
      return sendJson(res, result.ok ? 200 : 409, result, cors)
    } catch (cause) {
      return sendJson(res, 500, errorBody(cause), cors)
    } finally {
      await upload?.cleanup().catch(() => {})
    }
  }

  if (
    req.method === 'GET' &&
    requestUrl.pathname === '/v1/platforms/indiehackers/status'
  ) {
    try {
      const result = await getIndieHackersStatus(
        requestUrl.searchParams.get('account') || 'default',
      )
      return sendJson(res, result.ok ? 200 : 409, result, cors)
    } catch (cause) {
      return sendJson(res, 500, errorBody(cause), cors)
    }
  }

  if (
    req.method === 'POST' &&
    requestUrl.pathname === '/v1/platforms/indiehackers/login'
  ) {
    try {
      const body = await readJson(req)
      const result = await loginIndieHackers(
        typeof body.account === 'string' ? body.account : 'default',
      )
      return sendJson(res, result.ok ? 200 : 409, result, cors)
    } catch (cause) {
      return sendJson(res, 500, errorBody(cause), cors)
    }
  }

  if (
    req.method === 'POST' &&
    requestUrl.pathname === '/v1/platforms/indiehackers/publish-post'
  ) {
    let upload
    try {
      upload = await readIndieHackersPostMultipart(req)
      const result = await publishIndieHackersPost({
        account: upload.fields.account || 'default',
        title: upload.fields.title || '',
        content: upload.fields.content || '',
        imagePaths: upload.imagePaths,
      })
      return sendJson(res, result.ok ? 200 : 409, result, cors)
    } catch (cause) {
      return sendJson(res, 500, errorBody(cause), cors)
    } finally {
      await upload?.cleanup().catch(() => {})
    }
  }

  if (req.method === 'POST' && requestUrl.pathname === '/v1/publish') {
    return sendJson(
      res,
      501,
      {
        error: 'Use a platform-specific Local Runner publish endpoint.',
      },
      cors,
    )
  }

  return sendJson(res, 404, { error: 'Not found.' }, cors)
})

server.listen(port, host, () => {
  console.log('')
  console.log('ButtonPost Local Runner')
  console.log('  Version: ' + VERSION)
  console.log('  URL:     http://' + host + ':' + port)
  console.log('  Token:   ' + token + ' (private; never share)')
  console.log('  Allowed origins: ' + [...allowedOrigins].join(', '))
  console.log('  Capabilities: Xiaohongshu auth + image-note publishing; Jike auth + review publishing; LearnBlockchain auth + article review publishing; Indie Hackers auth + review publishing')
  console.log('')
  console.log('Keep this window open only while using local browser publishers.')
  console.log('The token stays on your machine; paste it into ButtonPost only when pairing.')
  console.log('')
})
