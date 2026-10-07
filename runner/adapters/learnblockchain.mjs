import { access, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'patchright'

const LBC_URL = 'https://learnblockchain.cn/'

const AUTH_MARKERS = [
  'a:has-text("写文章")',
  'button:has-text("写文章")',
  'a[href*="/people/"]',
  'img[class*="avatar"]',
  '[class*="avatar"]',
]

let activeOperation = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function normalizeLearnBlockchainAccountName(value) {
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

export function learnBlockchainProfileDir(account = 'default') {
  return path.join(
    profileRoot(),
    'learnblockchain',
    normalizeLearnBlockchainAccountName(account),
  )
}

async function profileExists(profileDir) {
  try {
    await access(profileDir)
    return true
  } catch {
    return false
  }
}

export function isLearnBlockchainLoginUrl(value) {
  try {
    const url = new URL(value)
    return (
      ['learnblockchain.cn', 'www.learnblockchain.cn'].includes(url.hostname) &&
      (
        url.pathname.includes('/login') ||
        url.pathname.includes('/signin') ||
        url.pathname.includes('/auth')
      )
    )
  } catch {
    return false
  }
}

async function hasAuthenticatedMarker(page) {
  for (const selector of AUTH_MARKERS) {
    try {
      const locator = page.locator(selector).first()
      if ((await locator.count()) > 0 && (await locator.isVisible())) {
        return true
      }
    } catch {
      // Continue while the page hydrates.
    }
  }

  return false
}

async function loginPromptVisible(page) {
  for (const text of ['登录', '登陆']) {
    try {
      const locator = page.getByText(text, { exact: true }).first()
      if ((await locator.count()) > 0 && (await locator.isVisible())) return true
    } catch {
      // Try the next login label.
    }
  }

  return false
}

async function verifyAuthenticated(page) {
  await page.goto(LBC_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForTimeout(1_500)

  if (isLearnBlockchainLoginUrl(page.url())) return false
  if (await hasAuthenticatedMarker(page)) return true
  if (await loginPromptVisible(page)) return false

  // Some layouts hide the account controls behind a compact header. A visible
  // "写文章" action is the strongest positive marker, so wait briefly for SPA hydration.
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (await hasAuthenticatedMarker(page)) return true
    if (await loginPromptVisible(page)) return false
    await sleep(500)
  }

  return false
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
      platform: 'learnblockchain',
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

export async function getLearnBlockchainStatus(account = 'default') {
  const accountName = normalizeLearnBlockchainAccountName(account)
  const userDataDir = learnBlockchainProfileDir(accountName)

  if (!(await profileExists(userDataDir))) {
    return {
      ok: true,
      platform: 'learnblockchain',
      account: accountName,
      authenticated: false,
      status: 'not_connected',
      message: 'No local LearnBlockchain login is stored for this account.',
    }
  }

  return withOperation('LearnBlockchain status check', async () => {
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
        platform: 'learnblockchain',
        account: accountName,
        authenticated,
        status: authenticated ? 'connected' : 'expired',
        message: authenticated
          ? 'LearnBlockchain login is valid.'
          : 'LearnBlockchain login is missing or expired.',
      }
    } catch (cause) {
      throw chromeLaunchError(cause)
    } finally {
      await context?.close().catch(() => {})
    }
  })
}

async function clickLoginIfAvailable(page) {
  for (const text of ['登录', '登陆']) {
    try {
      const locator = page.getByText(text, { exact: true }).first()
      if ((await locator.count()) > 0 && (await locator.isVisible())) {
        await locator.click()
        return true
      }
    } catch {
      // Try the next candidate.
    }
  }

  return false
}

export async function loginLearnBlockchain(
  account = 'default',
  { timeoutMs = 8 * 60_000 } = {},
) {
  const accountName = normalizeLearnBlockchainAccountName(account)
  const userDataDir = learnBlockchainProfileDir(accountName)
  await mkdir(userDataDir, { recursive: true })

  return withOperation('LearnBlockchain login', async () => {
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
          platform: 'learnblockchain',
          account: accountName,
          authenticated: true,
          status: 'connected',
          message: 'LearnBlockchain was already connected.',
        }
      }

      await page.goto(LBC_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      })
      await page.waitForTimeout(1_000)
      await clickLoginIfAvailable(page).catch(() => false)

      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        if (page.isClosed()) {
          return {
            ok: false,
            platform: 'learnblockchain',
            account: accountName,
            authenticated: false,
            status: 'cancelled',
            message:
              'The LearnBlockchain login window was closed before login completed.',
          }
        }

        if (await hasAuthenticatedMarker(page)) {
          return {
            ok: true,
            platform: 'learnblockchain',
            account: accountName,
            authenticated: true,
            status: 'connected',
            message:
              'LearnBlockchain login completed and was saved locally.',
          }
        }

        await sleep(1_500)
      }

      return {
        ok: false,
        platform: 'learnblockchain',
        account: accountName,
        authenticated: false,
        status: 'timeout',
        message: 'Timed out waiting for LearnBlockchain login.',
      }
    } catch (cause) {
      throw chromeLaunchError(cause)
    } finally {
      await context?.close().catch(() => {})
    }
  })
}
