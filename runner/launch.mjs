// Portable GUI-friendly launcher. Runs only the local Node server and opens
// a one-time pairing link in the default browser on first installation.
// The bearer token is in the URL fragment and never sent with the HTTP request.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadOrCreateRunnerToken } from './token.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const { token, created } = await loadOrCreateRunnerToken()

const allowedSites = new Set([
  'https://buttonpost.app',
  'https://www.buttonpost.app',
  'https://buttonpost.vercel.app',
  'http://localhost:3000',
])
const site = new URL(process.env.BUTTONPOST_WEB_URL || 'https://buttonpost.app')
if (!allowedSites.has(site.origin)) {
  throw new Error('BUTTONPOST_WEB_URL must be a trusted ButtonPost origin.')
}
site.pathname = '/'
site.search = ''
site.hash = 'buttonpost-runner=' + token

const child = spawn(process.execPath, [path.join(root, 'server.mjs')], {
  env: process.env,
  stdio: 'inherit',
})
child.on('exit', (code) => { process.exitCode = code || 0 })

async function waitUntilReady() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (child.exitCode !== null) return false
    try {
      const response = await fetch('http://127.0.0.1:27123/health')
      const health = await response.json()
      if (response.ok && health.ok && health.name === 'ButtonPost Local Runner') return true
    } catch {
      // Server startup not finished.
    }
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  return false
}

function openBrowser(url) {
  if (process.platform === 'darwin') {
    return spawn('open', [url], { detached: true, stdio: 'ignore' })
  }
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
  }
  return spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
}

if (await waitUntilReady()) {
  console.log('Runner ready. To pair manually, open this link in your browser:')
  console.log(site.toString())
  console.log('The link contains a local-only secret; do not share it.')
  if (created) {
    try {
      const opener = openBrowser(site.toString())
      opener.on('error', cause => console.error('Could not open a browser:', cause.message))
      opener.unref()
    } catch (cause) {
      console.error('Could not open a browser:', cause.message)
    }
  }
} else {
  console.error('Runner did not start. Is port 27123 already in use?')
}

process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
