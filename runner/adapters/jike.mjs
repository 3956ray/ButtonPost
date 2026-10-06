import { access, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'patchright'

const JIKE_URL = 'https://web.okjike.com/'

const AUTH_MARKERS = [
  'button[class*="compose"]',
  'a[href*="compose"]',
  'div[class*="ComposeButton"]',
  'img[class*="avatar"]',
  'div[class*="Avatar"]',
]

let activeOperation = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function normalizeJikeAccountName(value) {
  const normalized = String(value || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)

  return normalized || 'default'
}

function profileRoot() {
  return (
    process.env.BUTTONPOST_PROFILE_DIR ||
    path.join(os.homedir(), '.buttonpost', 'profiles')
  )
}

export function jikeProfileDir(account = 'default') {
  return path.join(profileRoot(), 'jike', normalizeJikeAccountName(account))
}

async function profileExists(profileDir) {
  try {
    await access(profileDir)
    return true
  } catch {
    return false
  }
}

export function isJikeLoginUrl(value) {
  try {
    const url = new URL(value)
    return (
      url.hostname === 'web.okjike.com' &&
      (url.pathname === '/login' || url.pathname.startsWith('/login/'))
    )
  } catch {
    return false
  }
}

async function hasAuthenticatedMarker(page) {
  for (const selector of AUTH_MARKERS) {
    try {
      const locator = page.locator(selector).first()
      if ((await locator.count()) > 0 && (await locator.isVisible())) return true
    } catch {
      // Keep checking while the app hydrates.
    }
  }
  return false
}

async function loginPromptVisible(page) {
  try {
    const loginText = page.getByText('登录', { exact: true }).first()
    return (await loginText.count()) > 0 && (await loginText.isVisible())
  } catch {
    return false
  }
}

async function waitForAuthenticatedPage(page, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (isJikeLoginUrl(page.url())) return false
    if (await hasAuthenticatedMarker(page)) return true

    if (await loginPromptVisible(page)) {
      await page.waitForTimeout(750)
      if (!(await hasAuthenticatedMarker(page))) return false
    }

    await page.waitForTimeout(500)
  }

  return false
}

async function verifyAuthenticated(page) {
  await page.goto(JIKE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })

  return waitForAuthenticatedPage(page)
}

function chromeLaunchError(cause) {
  const message = cause instanceof Error ? cause.message : String(cause)

  if (
    /executable|browser.*not found|chrome.*not found|failed to launch/i.test(
      message,
    )
  ) {
    return new Error(
      'ButtonPost could not launch Google Chrome. Install Chrome locally and retry.',
    )
  }

  return cause instanceof Error ? cause : new Error(message)
}

async function withOperation(name, fn) {
  if (activeOperation) {
    return {
      ok: false,
      platform: 'jike',
      status: 'busy',
      authenticated: false,
      message: 'Local browser is busy with ' + activeOperation + '.',
    }
  }

  activeOperation = name
  try {
    return await fn()
  } finally {
    activeOperation = null
  }
}

export async function getJikeStatus(account = 'default') {
  const accountName = normalizeJikeAccountName(account)
  const userDataDir = jikeProfileDir(accountName)

  if (!(await profileExists(userDataDir))) {
    return {
      ok: true,
      platform: 'jike',
      account: accountName,
      authenticated: false,
      status: 'not_connected',
      message: 'No local Jike login is stored for this account.',
    }
  }

  return withOperation('Jike status check', async () => {
    let context

    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: true,
        viewport: { width: 1280, height: 900 },
      })

      const page = context.pages()[0] || (await context.newPage())
      const authenticated = await verifyAuthenticated(page)

      return {
        ok: true,
        platform: 'jike',
        account: accountName,
        authenticated,
        status: authenticated ? 'connected' : 'expired',
        message: authenticated
          ? 'Jike login is valid.'
          : 'Jike login is missing or expired.',
      }
    } catch (cause) {
      throw chromeLaunchError(cause)
    } finally {
      await context?.close().catch(() => {})
    }
  })
}

export async function loginJike(
  account = 'default',
  { timeoutMs = 5 * 60_000 } = {},
) {
  const accountName = normalizeJikeAccountName(account)
  const userDataDir = jikeProfileDir(accountName)
  await mkdir(userDataDir, { recursive: true })

  return withOperation('Jike login', async () => {
    let context

    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: false,
        viewport: null,
      })

      const page = context.pages()[0] || (await context.newPage())

      if (await verifyAuthenticated(page).catch(() => false)) {
        return {
          ok: true,
          platform: 'jike',
          account: accountName,
          authenticated: true,
          status: 'connected',
          message: 'Jike was already connected.',
        }
      }

      await page.goto(JIKE_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      })

      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        if (page.isClosed()) {
          return {
            ok: false,
            platform: 'jike',
            account: accountName,
            authenticated: false,
            status: 'cancelled',
            message: 'The Jike login window was closed before login completed.',
          }
        }

        if (await hasAuthenticatedMarker(page)) {
          return {
            ok: true,
            platform: 'jike',
            account: accountName,
            authenticated: true,
            status: 'connected',
            message: 'Jike login completed and was saved locally.',
          }
        }

        await sleep(2_000)
      }

      return {
        ok: false,
        platform: 'jike',
        account: accountName,
        authenticated: false,
        status: 'timeout',
        message: 'Timed out waiting for Jike login.',
      }
    } catch (cause) {
      throw chromeLaunchError(cause)
    } finally {
      await context?.close().catch(() => {})
    }
  })
}
