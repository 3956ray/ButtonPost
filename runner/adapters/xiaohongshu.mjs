import { access, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'patchright'

const CREATOR_BASE_URL = 'https://creator.xiaohongshu.com'
const LOGIN_URL =
  CREATOR_BASE_URL +
  '/login?source=&redirectReason=401&lastUrl=%252Fnew%252Fnote-manager%253FroleType%253Dcreator'
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

export function isXiaohongshuLoginUrl(value) {
  try {
    const url = new URL(value)
    return url.origin === CREATOR_BASE_URL && url.pathname === '/login'
  } catch {
    return false
  }
}

const AUTHENTICATED_CREATOR_MARKERS = [
  '#publish-container',
  'input[type="file"][accept*="image"]',
  'div[class^="upload-content"] input[class="upload-input"]',
]

async function hasAuthenticatedCreatorMarker(page) {
  for (const selector of AUTHENTICATED_CREATOR_MARKERS) {
    try {
      const locator = page.locator(selector).first()
      if ((await locator.count()) > 0) return true
    } catch {
      // Keep checking other markers while the creator page is still rendering.
    }
  }
  return false
}

async function pageLooksAuthenticated(page) {
  if (isXiaohongshuLoginUrl(page.url())) return false
  if (await loginBoxVisible(page)) return false

  try {
    const url = new URL(page.url())
    return url.origin === CREATOR_BASE_URL && url.pathname !== '/login'
  } catch {
    return false
  }
}

async function waitForAuthenticatedCreatorPage(page, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (isXiaohongshuLoginUrl(page.url())) return false
    if (await loginBoxVisible(page)) return false
    if (await hasAuthenticatedCreatorMarker(page)) return true
    await page.waitForTimeout(500)
  }

  return false
}

async function verifyAuthenticated(page) {
  await page.goto(PUBLISH_CHECK_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })

  // Authentication must be positively proven by the creator publish page.
  // Merely not seeing the login UI is not enough because redirects/rendering
  // can lag behind navigation and previously caused false "Connected" states.
  return waitForAuthenticatedCreatorPage(page)
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


function xiaohongshuHeadless() {
  return process.env.BUTTONPOST_XHS_HEADLESS === 'true'
}

export async function publishXiaohongshuNote({
  account = 'default',
  title,
  content,
  imagePaths,
}) {
  const accountName = normalizeAccountName(account)
  const userDataDir = xiaohongshuProfileDir(accountName)
  const normalizedTitle = String(title || '').trim()
  const normalizedContent = String(content || '').trim()
  const normalizedImages = Array.isArray(imagePaths) ? imagePaths.filter(Boolean) : []

  if (!normalizedTitle) {
    return {
      ok: false,
      platform: 'xiaohongshu',
      status: 'failed',
      message: 'Xiaohongshu requires a title.',
    }
  }

  if (!normalizedContent) {
    return {
      ok: false,
      platform: 'xiaohongshu',
      status: 'failed',
      message: 'Xiaohongshu requires post content.',
    }
  }

  if (!normalizedImages.length) {
    return {
      ok: false,
      platform: 'xiaohongshu',
      status: 'failed',
      message: 'Xiaohongshu image-note publishing requires at least one image.',
    }
  }

  if (!(await profileExists(userDataDir))) {
    return {
      ok: false,
      platform: 'xiaohongshu',
      status: 'auth_required',
      message: 'Connect Xiaohongshu before publishing.',
    }
  }

  return withOperation('xiaohongshu note publishing', async () => {
    let context
    try {
      const headless = xiaohongshuHeadless()
      context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless,
        viewport: headless ? { width: 1280, height: 900 } : null,
      })

      const page = context.pages()[0] || (await context.newPage())
      const authenticated = await verifyAuthenticated(page)

      if (!authenticated) {
        return {
          ok: false,
          platform: 'xiaohongshu',
          status: 'auth_required',
          message: 'Xiaohongshu login is missing or expired. Reconnect the account and retry.',
        }
      }

      let uploadInput = page.locator('input[type="file"][accept*="image"]').first()
      if ((await uploadInput.count()) === 0) {
        uploadInput = page.locator('div[class^="upload-content"] input[class="upload-input"]').first()
      }

      await uploadInput.waitFor({ state: 'attached', timeout: 30_000 })
      await uploadInput.setInputFiles(normalizedImages)

      const titleInput = page.locator('input[placeholder*="填写标题"]').first()
      await titleInput.waitFor({ state: 'visible', timeout: 90_000 })
      await titleInput.fill(normalizedTitle.slice(0, 20))

      const description = page.locator('p[data-placeholder*="输入正文描述"]').first()
      await description.waitFor({ state: 'visible', timeout: 30_000 })
      await description.fill(normalizedContent)

      const publishButton = page.locator('button:has-text("发布")').first()
      await publishButton.waitFor({ state: 'visible', timeout: 30_000 })

      await Promise.all([
        page.waitForURL(
          (url) => url.origin === CREATOR_BASE_URL && url.pathname.includes('/publish/success'),
          { timeout: 60_000 },
        ),
        publishButton.click(),
      ])

      return {
        ok: true,
        platform: 'xiaohongshu',
        status: 'published',
        message: 'Xiaohongshu image note published successfully.',
      }
    } catch (cause) {
      throw chromeLaunchError(cause)
    } finally {
      await context?.close().catch(() => {})
    }
  })
}
