import { access, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'patchright'

const IH_HOME_URL = 'https://www.indiehackers.com/'
const IH_SIGN_IN_URL = 'https://www.indiehackers.com/sign-in'
const IH_NEW_POST_URL = 'https://www.indiehackers.com/post/new'

let activeOperation = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function normalizeIndieHackersAccountName(value) {
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

export function indieHackersProfileDir(account = 'default') {
  return path.join(
    profileRoot(),
    'indiehackers',
    normalizeIndieHackersAccountName(account),
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

export function isIndieHackersUrl(value) {
  try {
    const url = new URL(value)
    return ['indiehackers.com', 'www.indiehackers.com'].includes(url.hostname)
  } catch {
    return false
  }
}

export function isIndieHackersSignInUrl(value) {
  try {
    const url = new URL(value)
    return (
      isIndieHackersUrl(value) &&
      ['/sign-in', '/login', '/join'].some(
        (pathname) =>
          url.pathname === pathname || url.pathname.startsWith(pathname + '/'),
      )
    )
  } catch {
    return false
  }
}

export function isIndieHackersNewPostUrl(value) {
  try {
    const url = new URL(value)
    return (
      isIndieHackersUrl(value) &&
      (url.pathname === '/post/new' || url.pathname.startsWith('/post/new/'))
    )
  } catch {
    return false
  }
}

async function hasPostEditorMarker(page) {
  if (page.isClosed() || !isIndieHackersUrl(page.url())) return false

  const selectors = [
    'input[placeholder*="title" i]',
    'textarea[placeholder*="title" i]',
    'textarea[placeholder*="post" i]',
    'textarea[placeholder*="content" i]',
    '[contenteditable="true"]',
    'form textarea',
  ]

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first()
      if ((await locator.count()) > 0 && (await locator.isVisible())) {
        return true
      }
    } catch {
      // Continue while the client app hydrates.
    }
  }

  return false
}

async function signInFormVisible(page) {
  if (page.isClosed()) return false

  try {
    const email = page.locator('input[type="email"]').first()
    const password = page.locator('input[type="password"]').first()
    const signInButton = page
      .getByRole('button', { name: /sign in/i })
      .first()

    return (
      (await email.count()) > 0 &&
      (await password.count()) > 0 &&
      ((await signInButton.count()) === 0 || (await signInButton.isVisible()))
    )
  } catch {
    return false
  }
}

async function verifyAuthenticated(page) {
  await page.goto(IH_NEW_POST_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForTimeout(1_500)

  if (isIndieHackersSignInUrl(page.url())) return false
  if (await signInFormVisible(page)) return false
  if (await hasPostEditorMarker(page)) return true

  const deadline = Date.now() + 12_000
  while (Date.now() < deadline) {
    if (isIndieHackersSignInUrl(page.url())) return false
    if (await signInFormVisible(page)) return false
    if (await hasPostEditorMarker(page)) return true
    await sleep(500)
  }

  return isIndieHackersNewPostUrl(page.url())
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
      platform: 'indiehackers',
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

export async function getIndieHackersStatus(account = 'default') {
  const accountName = normalizeIndieHackersAccountName(account)
  const userDataDir = indieHackersProfileDir(accountName)

  if (!(await profileExists(userDataDir))) {
    return {
      ok: true,
      platform: 'indiehackers',
      account: accountName,
      authenticated: false,
      status: 'not_connected',
      message: 'No local Indie Hackers login is stored for this account.',
    }
  }

  return withOperation('Indie Hackers status check', async () => {
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
        platform: 'indiehackers',
        account: accountName,
        authenticated,
        status: authenticated ? 'connected' : 'expired',
        message: authenticated
          ? 'Indie Hackers login is valid.'
          : 'Indie Hackers login is missing or expired.',
      }
    } catch (cause) {
      throw chromeLaunchError(cause)
    } finally {
      await context?.close().catch(() => {})
    }
  })
}

export async function loginIndieHackers(
  account = 'default',
  { timeoutMs = 10 * 60_000 } = {},
) {
  const accountName = normalizeIndieHackersAccountName(account)
  const userDataDir = indieHackersProfileDir(accountName)
  await mkdir(userDataDir, { recursive: true })

  return withOperation('Indie Hackers login', async () => {
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
          platform: 'indiehackers',
          account: accountName,
          authenticated: true,
          status: 'connected',
          message: 'Indie Hackers was already connected.',
        }
      }

      await page.goto(IH_SIGN_IN_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      })
      await page.waitForTimeout(1_000)

      console.log('')
      console.log('Indie Hackers login')
      console.log('  Complete sign-in directly in the local Chrome window.')
      console.log('  ButtonPost never reads or stores your Indie Hackers password.')
      console.log('  After sign-in, ButtonPost checks the protected /post/new page.')
      console.log(
        '  Waiting up to ' + Math.round(timeoutMs / 60000) + ' minutes...',
      )
      console.log('')

      const deadline = Date.now() + timeoutMs

      while (Date.now() < deadline) {
        if (page.isClosed()) {
          return {
            ok: false,
            platform: 'indiehackers',
            account: accountName,
            authenticated: false,
            status: 'cancelled',
            message:
              'The Indie Hackers login window was closed before login completed.',
          }
        }

        const currentUrl = page.url()

        if (
          isIndieHackersUrl(currentUrl) &&
          !isIndieHackersSignInUrl(currentUrl) &&
          !(await signInFormVisible(page))
        ) {
          const authenticated = await verifyAuthenticated(page).catch(
            () => false,
          )

          if (authenticated) {
            await sleep(1_500)
            return {
              ok: true,
              platform: 'indiehackers',
              account: accountName,
              authenticated: true,
              status: 'connected',
              message:
                'Indie Hackers login completed and was saved locally.',
            }
          }

          await page.goto(IH_SIGN_IN_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
          }).catch(() => {})
        }

        await sleep(1_000)
      }

      return {
        ok: false,
        platform: 'indiehackers',
        account: accountName,
        authenticated: false,
        status: 'timeout',
        message: 'Timed out waiting for Indie Hackers login.',
      }
    } catch (cause) {
      throw chromeLaunchError(cause)
    } finally {
      await context?.close().catch(() => {})
    }
  })
}

export const INDIE_HACKERS_HOME_URL = IH_HOME_URL
export const INDIE_HACKERS_SIGN_IN_URL = IH_SIGN_IN_URL
export const INDIE_HACKERS_NEW_POST_URL = IH_NEW_POST_URL
