import { access, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'patchright'

const LBC_URL = 'https://learnblockchain.cn/'

function learnBlockchainLoginTimeoutMs() {
  const minutes = Number(
    process.env.BUTTONPOST_LBC_LOGIN_TIMEOUT_MINUTES || '15',
  )
  const normalized = Number.isFinite(minutes) && minutes > 0 ? minutes : 15
  return normalized * 60 * 1000
}

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

export function isLearnBlockchainSiteUrl(value) {
  try {
    const url = new URL(value)
    return ['learnblockchain.cn', 'www.learnblockchain.cn'].includes(url.hostname)
  } catch {
    return false
  }
}

export function isLearnBlockchainLoginUrl(value) {
  try {
    const url = new URL(value)
    return (
      isLearnBlockchainSiteUrl(value) &&
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
  if (page.isClosed() || !isLearnBlockchainSiteUrl(page.url())) return false

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
  if (page.isClosed() || !isLearnBlockchainSiteUrl(page.url())) return false

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

async function findAuthenticatedLearnBlockchainPage(context) {
  for (const candidate of context.pages()) {
    if (candidate.isClosed() || !isLearnBlockchainSiteUrl(candidate.url())) {
      continue
    }

    if (await hasAuthenticatedMarker(candidate)) return candidate
  }

  return null
}

function activePages(context) {
  return context.pages().filter((candidate) => !candidate.isClosed())
}

export async function loginLearnBlockchain(
  account = 'default',
  { timeoutMs = learnBlockchainLoginTimeoutMs() } = {},
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

      let page = context.pages()[0] || (await context.newPage())

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

      if (page.isClosed()) {
        page = activePages(context)[0] || (await context.newPage())
      }

      await page.goto(LBC_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      })
      await page.waitForTimeout(1_000)
      await clickLoginIfAvailable(page).catch(() => false)

      console.log('')
      console.log('LearnBlockchain login')
      console.log('  Complete the full GitHub OAuth / verification flow in Chrome.')
      console.log('  ButtonPost will keep every OAuth tab/window open until the')
      console.log('  browser returns to learnblockchain.cn and login is confirmed.')
      console.log(
        '  Waiting up to ' + Math.round(timeoutMs / 60000) + ' minutes...',
      )
      console.log('')

      const deadline = Date.now() + timeoutMs
      let emptySince = null

      while (Date.now() < deadline) {
        const pages = activePages(context)

        if (pages.length === 0) {
          emptySince ??= Date.now()
          if (Date.now() - emptySince > 3_000) {
            return {
              ok: false,
              platform: 'learnblockchain',
              account: accountName,
              authenticated: false,
              status: 'cancelled',
              message:
                'All LearnBlockchain/GitHub login windows were closed before login completed.',
            }
          }
        } else {
          emptySince = null
        }

        const authenticatedPage =
          await findAuthenticatedLearnBlockchainPage(context)

        if (authenticatedPage) {
          // Give the OAuth callback/session storage a moment to settle before
          // persisting and closing the browser context.
          await sleep(2_000)

          if (await hasAuthenticatedMarker(authenticatedPage)) {
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
        }

        await sleep(1_000)
      }

      return {
        ok: false,
        platform: 'learnblockchain',
        account: accountName,
        authenticated: false,
        status: 'timeout',
        message:
          'Timed out waiting for the GitHub OAuth flow to return to LearnBlockchain. The browser was kept open for the full login window.',
      }
    } catch (cause) {
      throw chromeLaunchError(cause)
    } finally {
      await context?.close().catch(() => {})
    }
  })
}
