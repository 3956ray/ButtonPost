import { access, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'patchright'

const JIKE_URL = 'https://web.okjike.com/'
const JIKE_COMPOSE_URL = 'https://web.okjike.com/following'

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


function jikeReviewTimeoutMs() {
  const minutes = Number(process.env.BUTTONPOST_JIKE_REVIEW_TIMEOUT_MINUTES || '30')
  const normalized = Number.isFinite(minutes) && minutes > 0 ? minutes : 30
  return normalized * 60 * 1000
}

async function findJikeComposer(page) {
  await page.goto(JIKE_COMPOSE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForTimeout(2_000)

  let form = page.locator('[class*="_postForm_"]').first()
  if ((await form.count()) === 0) {
    const editor = page.locator('[contenteditable="true"]').first()
    await editor.waitFor({ state: 'visible', timeout: 20_000 })
    form = page.locator('body')
  }

  const editor = form.locator('[contenteditable="true"]').first()
  await editor.waitFor({ state: 'visible', timeout: 20_000 })

  return { form, editor }
}

async function replaceJikeEditorText(editor, text) {
  await editor.evaluate((box, value) => {
    box.focus()

    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(box)
    selection?.removeAllRanges()
    selection?.addRange(range)

    box.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'deleteContentBackward',
        bubbles: true,
        cancelable: true,
      }),
    )

    const data = new DataTransfer()
    data.setData('text/plain', value)
    box.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    )
  }, text)

  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const current = ((await editor.textContent().catch(() => '')) || '').trim()
    if (current.length > 0) return
    await sleep(300)
  }

  throw new Error('Jike editor did not accept the source text.')
}

async function uploadJikeImages(form, imagePaths) {
  let uploaded = 0

  for (const imagePath of imagePaths) {
    const input = form.locator('input[type="file"]').first()
    await input.waitFor({ state: 'attached', timeout: 20_000 })
    await input.setInputFiles(imagePath)

    const deadline = Date.now() + 30_000
    let observed = false

    while (Date.now() < deadline) {
      const count = await form.locator('img[src^="blob:"]').count().catch(() => 0)
      if (count > uploaded) {
        uploaded = count
        observed = true
        break
      }
      await sleep(500)
    }

    if (!observed) {
      throw new Error('Jike image preview did not appear after upload.')
    }
  }
}

async function waitForJikeManualPublish(page, sourceText, timeoutMs) {
  const snippet = sourceText.replace(/\s+/g, ' ').trim().slice(0, 24)
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      return {
        ok: false,
        status: 'cancelled',
        message: 'The Jike review window was closed before publishing completed.',
      }
    }

    const editor = page
      .locator('[class*="_postForm_"] [contenteditable="true"]')
      .first()
    const editorText = (
      (await editor.textContent().catch(() => '')) || ''
    ).trim()

    if (!editorText) {
      const appeared =
        snippet.length < 8
          ? true
          : await page.evaluate((expected) => {
              const form = document.querySelector('[class*="_postForm_"]')
              const normalize = (value) =>
                String(value || '')
                  .replace(/\s+/g, ' ')
                  .trim()

              return Array.from(
                document.querySelectorAll('article, div, p'),
              ).some((element) => {
                if (form?.contains(element)) return false
                return normalize(element.textContent).includes(expected)
              })
            }, snippet)

      if (appeared) {
        const externalUrl = await page
          .evaluate((expected) => {
            const form = document.querySelector('[class*="_postForm_"]')
            const normalize = (value) =>
              String(value || '')
                .replace(/\s+/g, ' ')
                .trim()

            const links = Array.from(
              document.querySelectorAll('a[href*="/originalPost/"]'),
            )

            const match = links.find((link) => {
              if (form?.contains(link)) return false
              const container =
                link.closest('article') ||
                link.parentElement?.parentElement ||
                link.parentElement
              return normalize(container?.textContent).includes(expected)
            })

            return match instanceof HTMLAnchorElement ? match.href : null
          }, snippet)
          .catch(() => null)

        return {
          ok: true,
          status: 'published',
          message: 'Jike post published after manual review.',
          ...(externalUrl ? { externalUrl } : {}),
        }
      }
    }

    await sleep(1_000)
  }

  return {
    ok: false,
    status: 'timeout',
    message:
      'Timed out waiting for manual Jike publish confirmation. The editor was left open for review.',
  }
}

export async function publishJikePost({
  account = 'default',
  content,
  imagePaths = [],
}) {
  const accountName = normalizeJikeAccountName(account)
  const userDataDir = jikeProfileDir(accountName)
  const normalizedContent = String(content || '').trim()
  const normalizedImages = Array.isArray(imagePaths)
    ? imagePaths.filter(Boolean).slice(0, 9)
    : []

  if (!normalizedContent) {
    return {
      ok: false,
      platform: 'jike',
      status: 'failed',
      message: 'Jike requires post content.',
    }
  }

  if (!(await profileExists(userDataDir))) {
    return {
      ok: false,
      platform: 'jike',
      status: 'auth_required',
      message: 'Connect Jike before publishing.',
    }
  }

  return withOperation('Jike post publishing', async () => {
    let context

    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: false,
        viewport: null,
      })

      const page = context.pages()[0] || (await context.newPage())
      const authenticated = await verifyAuthenticated(page)

      if (!authenticated) {
        return {
          ok: false,
          platform: 'jike',
          status: 'auth_required',
          message: 'Jike login is missing or expired. Reconnect the account and retry.',
        }
      }

      const { form, editor } = await findJikeComposer(page)
      await replaceJikeEditorText(editor, normalizedContent)

      if (normalizedImages.length) {
        await uploadJikeImages(form, normalizedImages)
      }

      const sendButton = form.getByRole('button', { name: '发送', exact: true }).first()
      await sendButton.waitFor({ state: 'visible', timeout: 20_000 })

      const enableDeadline = Date.now() + 10_000
      while (Date.now() < enableDeadline && (await sendButton.isDisabled().catch(() => true))) {
        await sleep(300)
      }

      if (await sendButton.isDisabled().catch(() => true)) {
        throw new Error('Jike send button is still disabled after filling the post.')
      }

      const timeoutMs = jikeReviewTimeoutMs()
      console.log('')
      console.log('Jike review mode')
      console.log('  ButtonPost filled the text and selected images.')
      console.log('  Review circles, text, images, and formatting in Chrome.')
      console.log('  Click Send manually when ready.')
      console.log('  Waiting up to ' + Math.round(timeoutMs / 60000) + ' minutes...')
      console.log('')

      const result = await waitForJikeManualPublish(
        page,
        normalizedContent,
        timeoutMs,
      )

      return {
        ...result,
        platform: 'jike',
      }
    } catch (cause) {
      throw chromeLaunchError(cause)
    } finally {
      await context?.close().catch(() => {})
    }
  })
}
