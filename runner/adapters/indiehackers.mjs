import { access, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'patchright'

const IH_HOME_URL = 'https://www.indiehackers.com/'
const IH_SIGN_IN_URL = 'https://www.indiehackers.com/sign-in'
const IH_NEW_POST_URL = 'https://www.indiehackers.com/post/new'

function indieHackersReviewTimeoutMs() {
  const minutes = Number(
    process.env.BUTTONPOST_IH_REVIEW_TIMEOUT_MINUTES || '30',
  )
  const normalized = Number.isFinite(minutes) && minutes > 0 ? minutes : 30
  return normalized * 60 * 1000
}

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

export function isIndieHackersPublishedPostUrl(value) {
  try {
    const url = new URL(value)

    if (!isIndieHackersUrl(value) || isIndieHackersNewPostUrl(value)) {
      return false
    }

    return (
      url.pathname.startsWith('/post/') &&
      url.pathname.split('/').filter(Boolean).length >= 2
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


function normalizeControlText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

async function visibleEditorCandidates(page) {
  const selectors = [
    'input:not([type="hidden"]):not([type="file"])',
    'textarea',
    '[contenteditable="true"]',
  ]
  const candidates = []

  for (const selector of selectors) {
    const locator = page.locator(selector)
    const count = await locator.count()

    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index)

      try {
        if (!(await item.isVisible())) continue

        const meta = await item.evaluate((element) => ({
          tagName: element.tagName.toLowerCase(),
          type: element.getAttribute('type') || '',
          name: element.getAttribute('name') || '',
          id: element.getAttribute('id') || '',
          placeholder: element.getAttribute('placeholder') || '',
          ariaLabel: element.getAttribute('aria-label') || '',
          role: element.getAttribute('role') || '',
          className:
            typeof element.className === 'string' ? element.className : '',
          text: element.textContent || '',
        }))

        candidates.push({ locator: item, meta })
      } catch {
        // Continue while the editor hydrates.
      }
    }
  }

  return candidates
}

function scoreIndieHackersTitleCandidate(meta) {
  const text = normalizeControlText(
    [
      meta.name,
      meta.id,
      meta.placeholder,
      meta.ariaLabel,
      meta.className,
    ].join(' '),
  )
  let score = 0

  if (/title|headline|subject/.test(text)) score += 30
  if (/post title|title your post|add a title/.test(text)) score += 20
  if (meta.tagName === 'input') score += 6
  if (/search|email|password|url|tag|topic|group/.test(text)) score -= 30

  return score
}

function scoreIndieHackersBodyCandidate(meta) {
  const text = normalizeControlText(
    [
      meta.name,
      meta.id,
      meta.placeholder,
      meta.ariaLabel,
      meta.className,
      meta.text,
    ].join(' '),
  )
  let score = 0

  if (/body|content|post|story|write|share|discussion|description/.test(text)) {
    score += 24
  }
  if (meta.tagName === 'textarea') score += 10
  if (meta.role === 'textbox' || meta.tagName === 'div') score += 4
  if (/title|headline|subject|search|email|password|tag|topic|group/.test(text)) {
    score -= 22
  }

  return score
}

async function findIndieHackersEditor(page) {
  const deadline = Date.now() + 20_000

  while (Date.now() < deadline) {
    if (isIndieHackersSignInUrl(page.url())) {
      throw new Error(
        'Indie Hackers login expired while opening the new-post editor.',
      )
    }

    const candidates = await visibleEditorCandidates(page)

    const rankedTitle = candidates
      .map((candidate) => ({
        ...candidate,
        score: scoreIndieHackersTitleCandidate(candidate.meta),
      }))
      .sort((left, right) => right.score - left.score)

    const title = rankedTitle.find((candidate) => candidate.score > 0)

    const rankedBody = candidates
      .filter(
        (candidate) =>
          !title ||
          candidate.locator.toString() !== title.locator.toString(),
      )
      .map((candidate) => ({
        ...candidate,
        score: scoreIndieHackersBodyCandidate(candidate.meta),
      }))
      .sort((left, right) => right.score - left.score)

    const body =
      rankedBody.find((candidate) => candidate.score > 0) ||
      (candidates.length === 1 ? candidates[0] : null)

    if (body) {
      return {
        title: title?.locator || null,
        body: body.locator,
      }
    }

    await sleep(500)
  }

  throw new Error(
    'ButtonPost could not find the Indie Hackers new-post editor fields.',
  )
}

async function fillIndieHackersText(page, locator, value) {
  const meta = await locator.evaluate((element) => ({
    tagName: element.tagName.toLowerCase(),
    contentEditable: element.getAttribute('contenteditable'),
  }))

  if (meta.tagName === 'input' || meta.tagName === 'textarea') {
    await locator.fill(value)
    return
  }

  if (meta.contentEditable === 'true') {
    await locator.click()
    await page.keyboard.press(
      process.platform === 'darwin' ? 'Meta+A' : 'Control+A',
    )

    const inserted = await locator
      .evaluate((element, text) => {
        const transfer = new DataTransfer()
        transfer.setData('text/plain', text)
        return element.dispatchEvent(
          new ClipboardEvent('paste', {
            clipboardData: transfer,
            bubbles: true,
            cancelable: true,
          }),
        )
      }, value)
      .catch(() => false)

    await sleep(250)
    const text = ((await locator.textContent().catch(() => '')) || '').trim()

    if (!text && !inserted) {
      await page.keyboard.insertText(value)
    }
    return
  }

  await locator.click()
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+A' : 'Control+A',
  )
  await page.keyboard.insertText(value)
}

async function uploadIndieHackersImages(page, imagePaths) {
  if (!imagePaths.length) {
    return { uploaded: 0, warning: null }
  }

  const inputs = page.locator(
    'input[type="file"][accept*="image" i], input[type="file"]',
  )
  const count = await inputs.count()

  if (!count) {
    return {
      uploaded: 0,
      warning:
        'Indie Hackers did not expose an image upload input in this editor. Add the selected images manually during review if needed.',
    }
  }

  const beforeImages = await page.locator('img').count().catch(() => 0)

  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index)

    try {
      const accept = normalizeControlText(await input.getAttribute('accept'))
      if (accept && !accept.includes('image')) continue

      const multiple = (await input.getAttribute('multiple')) !== null

      if (multiple) {
        await input.setInputFiles(imagePaths)
      } else {
        await input.setInputFiles(imagePaths[0])
      }

      await sleep(1_500)
      const afterImages = await page.locator('img').count().catch(() => 0)

      if (afterImages > beforeImages || multiple) {
        return {
          uploaded: multiple ? imagePaths.length : 1,
          warning:
            !multiple && imagePaths.length > 1
              ? 'Indie Hackers exposed a single-image upload control. Add the remaining images manually during review.'
              : null,
        }
      }
    } catch {
      // Try the next file input.
    }
  }

  return {
    uploaded: 0,
    warning:
      'ButtonPost found an Indie Hackers file input but could not verify that the selected image appeared. Review the editor and add images manually if needed.',
  }
}

async function waitForIndieHackersManualPublish(context, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const pages = context.pages().filter((page) => !page.isClosed())

    if (!pages.length) {
      return {
        ok: false,
        status: 'cancelled',
        message:
          'All Indie Hackers review windows were closed before publication was confirmed.',
      }
    }

    for (const page of pages) {
      const url = page.url()
      if (!isIndieHackersPublishedPostUrl(url)) continue

      return {
        ok: true,
        status: 'published',
        externalUrl: url,
        message: 'Indie Hackers navigated to the published post.',
      }
    }

    await sleep(750)
  }

  return {
    ok: false,
    status: 'timeout',
    message:
      'Timed out waiting for Indie Hackers publication confirmation. Check Indie Hackers before retrying to avoid a duplicate post.',
  }
}

export async function publishIndieHackersPost({
  account = 'default',
  title,
  content,
  imagePaths = [],
}) {
  const accountName = normalizeIndieHackersAccountName(account)
  const userDataDir = indieHackersProfileDir(accountName)
  const normalizedTitle = String(title || '').trim()
  const normalizedContent = String(content || '').trim()
  const normalizedImages = Array.isArray(imagePaths)
    ? imagePaths.filter(Boolean).slice(0, 9)
    : []

  if (!normalizedTitle || !normalizedContent) {
    return {
      ok: false,
      platform: 'indiehackers',
      status: 'failed',
      message: 'Indie Hackers requires both source title and content.',
    }
  }

  if (!(await profileExists(userDataDir))) {
    return {
      ok: false,
      platform: 'indiehackers',
      status: 'auth_required',
      message: 'Connect Indie Hackers before publishing.',
    }
  }

  return withOperation('Indie Hackers post publishing', async () => {
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
          platform: 'indiehackers',
          status: 'auth_required',
          message:
            'Indie Hackers login is missing or expired. Reconnect the account and retry.',
        }
      }

      await page.goto(IH_NEW_POST_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      })
      await page.waitForTimeout(1_500)

      const editor = await findIndieHackersEditor(page)

      if (editor.title) {
        await fillIndieHackersText(page, editor.title, normalizedTitle)
        await fillIndieHackersText(page, editor.body, normalizedContent)
      } else {
        // Mechanical field mapping for an editor that exposes only one body field.
        await fillIndieHackersText(
          page,
          editor.body,
          normalizedTitle + '\n\n' + normalizedContent,
        )
      }

      const media = await uploadIndieHackersImages(page, normalizedImages)
      const timeoutMs = indieHackersReviewTimeoutMs()

      console.log('')
      console.log('Indie Hackers review mode')
      console.log('  ButtonPost filled the new-post editor from the source post.')
      if (media.uploaded) {
        console.log('  Uploaded local images: ' + media.uploaded)
      }
      if (media.warning) {
        console.log('  Media warning: ' + media.warning)
      }
      console.log('  Review title/body, group/topic, links, images, and formatting.')
      console.log('  Click the final Post/Publish button manually when ready.')
      console.log(
        '  Waiting up to ' + Math.round(timeoutMs / 60000) + ' minutes...',
      )
      console.log('')

      const result = await waitForIndieHackersManualPublish(
        context,
        timeoutMs,
      )

      return {
        ...result,
        platform: 'indiehackers',
        ...(media.warning && result.ok
          ? {
              message:
                (result.message || 'Indie Hackers post published.') +
                ' ' +
                media.warning,
            }
          : {}),
      }
    } catch (cause) {
      throw chromeLaunchError(cause)
    } finally {
      await context?.close().catch(() => {})
    }
  })
}
