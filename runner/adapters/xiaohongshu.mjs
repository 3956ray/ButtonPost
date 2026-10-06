import { access, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'patchright'

const CREATOR_BASE_URL = 'https://creator.xiaohongshu.com'
const LOGIN_URL = CREATOR_BASE_URL + '/login'
const PUBLISH_CHECK_URL =
  CREATOR_BASE_URL + '/publish/publish?from=homepage&target=image'

let activeOperation = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function normalizeAccountName(value) {
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

export function xiaohongshuProfileDir(account = 'default') {
  return path.join(profileRoot(), 'xiaohongshu', normalizeAccountName(account))
}

async function profileExists(profileDir) {
  try {
    await access(profileDir)
    return true
  } catch {
    return false
  }
}

async function loginBoxVisible(page) {
  const loginBox = page.locator('div[class*="login-box"]').first()
  if ((await loginBox.count()) === 0) return false
  try {
    return await loginBox.isVisible()
  } catch {
    return false
  }
}

async function pageLooksAuthenticated(page) {
  if (page.url().startsWith(LOGIN_URL)) return false
  return !(await loginBoxVisible(page))
}

async function verifyAuthenticated(page) {
  await page.goto(PUBLISH_CHECK_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForTimeout(1_500)
  return pageLooksAuthenticated(page)
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

export async function getXiaohongshuStatus(account = 'default') {
  const accountName = normalizeAccountName(account)
  const userDataDir = xiaohongshuProfileDir(accountName)

  if (!(await profileExists(userDataDir))) {
    return {
      ok: true,
      platform: 'xiaohongshu',
      account: accountName,
      authenticated: false,
      status: 'not_connected',
      message: 'No local Xiaohongshu login is stored for this account.',
    }
  }

  return withOperation('xiaohongshu status check', async () => {
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
        platform: 'xiaohongshu',
        account: accountName,
        authenticated,
        status: authenticated ? 'connected' : 'expired',
        message: authenticated
          ? 'Xiaohongshu login is valid.'
          : 'Xiaohongshu login is missing or expired.',
      }
    } catch (cause) {
      throw chromeLaunchError(cause)
    } finally {
      await context?.close().catch(() => {})
    }
  })
}

export async function loginXiaohongshu(
  account = 'default',
  { timeoutMs = 5 * 60_000 } = {},
) {
  const accountName = normalizeAccountName(account)
  const userDataDir = xiaohongshuProfileDir(accountName)
  await mkdir(userDataDir, { recursive: true })

  return withOperation('xiaohongshu login', async () => {
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
          platform: 'xiaohongshu',
          account: accountName,
          authenticated: true,
          status: 'connected',
          message: 'Xiaohongshu was already connected.',
        }
      }

      await page.goto(LOGIN_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      })

      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        if (page.isClosed()) {
          return {
            ok: false,
            platform: 'xiaohongshu',
            account: accountName,
            authenticated: false,
            status: 'cancelled',
            message: 'The Xiaohongshu login window was closed before login completed.',
          }
        }

        if (await pageLooksAuthenticated(page)) {
          const authenticated = await verifyAuthenticated(page).catch(() => false)
          if (authenticated) {
            return {
              ok: true,
              platform: 'xiaohongshu',
              account: accountName,
              authenticated: true,
              status: 'connected',
              message: 'Xiaohongshu login completed and was saved locally.',
            }
          }

          await page.goto(LOGIN_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
          })
        }

        await sleep(2_000)
      }

      return {
        ok: false,
        platform: 'xiaohongshu',
        account: accountName,
        authenticated: false,
        status: 'timeout',
        message: 'Timed out waiting for Xiaohongshu login.',
      }
    } catch (cause) {
      throw chromeLaunchError(cause)
    } finally {
      await context?.close().catch(() => {})
    }
  })
}
