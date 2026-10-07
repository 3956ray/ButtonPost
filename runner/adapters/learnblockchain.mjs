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

function learnBlockchainReviewTimeoutMs() {
  const minutes = Number(
    process.env.BUTTONPOST_LBC_REVIEW_TIMEOUT_MINUTES || '30',
  )
  const normalized = Number.isFinite(minutes) && minutes > 0 ? minutes : 30
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

async function hasInjectedWallet(page) {
  if (page.isClosed() || !isLearnBlockchainSiteUrl(page.url())) return false

  try {
    return await page.evaluate(() => Boolean(globalThis.ethereum))
  } catch {
    return false
  }
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

      const walletDetected = await hasInjectedWallet(page)

      console.log('')
      console.log('LearnBlockchain login')
      console.log('  Choose any supported login method in Chrome:')
      console.log('  GitHub / MetaMask / email-password / phone / WeChat.')
      console.log('  ButtonPost never reads your password, verification code,')
      console.log('  wallet seed phrase, private key, or approval signature.')
      if (walletDetected) {
        console.log('  Injected Web3 wallet detected in this local browser profile.')
      } else {
        console.log('  No injected Web3 wallet detected in this local profile.')
        console.log('  For MetaMask login, install/unlock MetaMask in this')
        console.log('  dedicated ButtonPost Chrome profile once, then retry.')
      }
      console.log('  All provider tabs/windows stay open until the browser')
      console.log('  returns to learnblockchain.cn and login is confirmed.')
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


const WRITE_LABELS = ['写文章', '发布文章', '投稿']

export function isLearnBlockchainArticleUrl(value) {
  try {
    const url = new URL(value)
    return (
      isLearnBlockchainSiteUrl(value) &&
      /^\/article\/\d+(?:\/)?$/.test(url.pathname)
    )
  } catch {
    return false
  }
}

export function extractLearnBlockchainArticleId(body) {
  if (!body || typeof body !== 'object') return null

  for (const candidate of [
    body.article_id,
    body.articleId,
    body.id,
    body.data?.article_id,
    body.data?.articleId,
    body.data?.id,
  ]) {
    if (
      (typeof candidate === 'string' || typeof candidate === 'number') &&
      String(candidate).trim()
    ) {
      return String(candidate).trim()
    }
  }

  return null
}

async function firstVisible(page, selectors, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first()
      try {
        if ((await locator.count()) > 0 && (await locator.isVisible())) {
          return locator
        }
      } catch {
        // Continue while the editor hydrates.
      }
    }

    await sleep(300)
  }

  return null
}

async function clickWriteArticle(page, context) {
  await page.goto(LBC_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForTimeout(1_500)

  for (const label of WRITE_LABELS) {
    const locator = page.getByText(label, { exact: true }).first()
    try {
      if ((await locator.count()) === 0 || !(await locator.isVisible())) continue

      const href = await locator.getAttribute('href').catch(() => null)
      if (href) {
        await page.goto(new URL(href, page.url()).toString(), {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        })
        return page
      }

      const before = new Set(context.pages())
      await locator.click()
      await sleep(1_200)

      const opened = context
        .pages()
        .find((candidate) => !before.has(candidate) && !candidate.isClosed())

      return opened || page
    } catch {
      // Try the next visible label.
    }
  }

  throw new Error(
    'ButtonPost could not find the LearnBlockchain "写文章" action. Open the site once and confirm the signed-in account can create articles.',
  )
}

async function findArticleEditorPage(context, preferredPage) {
  const deadline = Date.now() + 20_000

  while (Date.now() < deadline) {
    const pages = [
      preferredPage,
      ...context.pages().filter((page) => page !== preferredPage),
    ].filter((page) => page && !page.isClosed() && isLearnBlockchainSiteUrl(page.url()))

    for (const page of pages) {
      const title = await firstVisible(
        page,
        [
          'input[name="title"]',
          'input[placeholder*="标题"]',
          'textarea[placeholder*="标题"]',
          'input[id*="title" i]',
        ],
        500,
      )

      const content = await firstVisible(
        page,
        [
          'textarea[name="content"]',
          'textarea[placeholder*="Markdown" i]',
          'textarea[placeholder*="正文"]',
          'textarea[placeholder*="内容"]',
          '.cm-content[contenteditable="true"]',
          '.CodeMirror textarea',
          '[contenteditable="true"]',
        ],
        500,
      )

      if (title && content) return { page, title, content }
    }

    await sleep(500)
  }

  throw new Error(
    'LearnBlockchain article editor opened, but ButtonPost could not find both the title and Markdown body fields.',
  )
}

async function fillEditorLocator(locator, value) {
  const tagName = await locator.evaluate((element) =>
    element.tagName.toLowerCase(),
  )
  const contentEditable = await locator
    .getAttribute('contenteditable')
    .catch(() => null)

  if (
    tagName === 'input' ||
    tagName === 'textarea' ||
    contentEditable === 'true'
  ) {
    await locator.fill(value)
    return
  }

  await locator.click()
  await locator.page().keyboard.press(
    process.platform === 'darwin' ? 'Meta+A' : 'Control+A',
  )
  await locator.page().keyboard.insertText(value)
}

async function uploadLearnBlockchainImages(page, imagePaths) {
  if (!imagePaths.length) return { uploaded: 0, warning: null }

  const imageInput = page
    .locator(
      'input[type="file"][accept*="image"], input[type="file"]',
    )
    .first()

  if ((await imageInput.count()) === 0) {
    return {
      uploaded: 0,
      warning:
        'ButtonPost filled the article text, but could not detect LearnBlockchain image upload controls. Add the selected images manually before publishing.',
    }
  }

  let uploaded = 0
  const multiple = (await imageInput.getAttribute('multiple')) !== null

  try {
    if (multiple) {
      await imageInput.setInputFiles(imagePaths)
      uploaded = imagePaths.length
      await sleep(2_000)
    } else {
      for (const imagePath of imagePaths) {
        await imageInput.setInputFiles(imagePath)
        uploaded += 1
        await sleep(1_000)
      }
    }

    return { uploaded, warning: null }
  } catch {
    return {
      uploaded,
      warning:
        'LearnBlockchain image upload controls changed while filling the article. Review the editor and add any missing images manually.',
    }
  }
}

async function waitForLearnBlockchainPublishResponse(page, timeoutMs) {
  try {
    const response = await page.waitForResponse(
      (candidate) => {
        try {
          const request = candidate.request()
          const url = new URL(candidate.url())
          return (
            request.method() === 'POST' &&
            isLearnBlockchainSiteUrl(candidate.url()) &&
            url.pathname === '/api/post/article'
          )
        } catch {
          return false
        }
      },
      { timeout: timeoutMs },
    )

    let body = null
    try {
      body = await response.json()
    } catch {
      // Fall through to URL-based confirmation when the response shape changes.
    }

    const articleId = extractLearnBlockchainArticleId(body)
    const businessOk =
      body === null ||
      body.code === undefined ||
      Number(body.code) === 0

    if (!response.ok() || !businessOk) {
      return {
        ok: false,
        status: 'failed',
        message:
          body?.message ||
          body?.error ||
          'LearnBlockchain rejected the article publish request.',
      }
    }

    if (articleId) {
      return {
        ok: true,
        status: 'published',
        externalId: articleId,
        externalUrl: `https://learnblockchain.cn/article/${articleId}`,
        message: 'LearnBlockchain confirmed the article publish request.',
      }
    }

    return {
      ok: true,
      status: 'published',
      message:
        'LearnBlockchain accepted the article publish request. No article id was present in the response.',
    }
  } catch {
    return null
  }
}

async function waitForLearnBlockchainArticleUrl(context, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    for (const page of activePages(context)) {
      const url = page.url()
      if (!isLearnBlockchainArticleUrl(url)) continue

      const match = new URL(url).pathname.match(/^\/article\/(\d+)/)
      const articleId = match?.[1]

      return {
        ok: true,
        status: 'published',
        ...(articleId ? { externalId: articleId } : {}),
        externalUrl: url,
        message: 'LearnBlockchain navigated to the published article.',
      }
    }

    if (activePages(context).length === 0) {
      return {
        ok: false,
        status: 'cancelled',
        message:
          'All LearnBlockchain review windows were closed before publication was confirmed.',
      }
    }

    await sleep(750)
  }

  return {
    ok: false,
    status: 'timeout',
    message:
      'Timed out waiting for LearnBlockchain publication confirmation. The article may still be open or already published; check the site before retrying to avoid duplicates.',
  }
}

export async function publishLearnBlockchainArticle({
  account = 'default',
  title,
  content,
  imagePaths = [],
}) {
  const accountName = normalizeLearnBlockchainAccountName(account)
  const userDataDir = learnBlockchainProfileDir(accountName)
  const normalizedTitle = String(title || '').trim()
  const normalizedContent = String(content || '').trim()
  const normalizedImages = Array.isArray(imagePaths)
    ? imagePaths.filter(Boolean).slice(0, 9)
    : []

  if (!normalizedTitle || !normalizedContent) {
    return {
      ok: false,
      platform: 'learnblockchain',
      status: 'failed',
      message: 'LearnBlockchain requires both a title and article body.',
    }
  }

  if (!(await profileExists(userDataDir))) {
    return {
      ok: false,
      platform: 'learnblockchain',
      status: 'auth_required',
      message: 'Connect LearnBlockchain before publishing.',
    }
  }

  return withOperation('LearnBlockchain article publishing', async () => {
    let context

    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: false,
        viewport: null,
      })

      let page = context.pages()[0] || (await context.newPage())
      const authenticated = await verifyAuthenticated(page)

      if (!authenticated) {
        return {
          ok: false,
          platform: 'learnblockchain',
          status: 'auth_required',
          message:
            'LearnBlockchain login is missing or expired. Reconnect the account and retry.',
        }
      }

      page = await clickWriteArticle(page, context)
      const editor = await findArticleEditorPage(context, page)
      page = editor.page

      await fillEditorLocator(editor.title, normalizedTitle)
      await fillEditorLocator(editor.content, normalizedContent)

      const media = await uploadLearnBlockchainImages(
        page,
        normalizedImages,
      )

      const timeoutMs = learnBlockchainReviewTimeoutMs()
      console.log('')
      console.log('LearnBlockchain review mode')
      console.log('  ButtonPost filled the article title and Markdown body.')
      if (media.uploaded) {
        console.log('  Uploaded local images: ' + media.uploaded)
      }
      if (media.warning) {
        console.log('  Media warning: ' + media.warning)
      }
      console.log('  Review article type, category, tags, cover, images,')
      console.log('  formatting, visibility, and any platform-required fields.')
      console.log('  Click the final Publish button manually when ready.')
      console.log(
        '  Waiting up to ' + Math.round(timeoutMs / 60000) + ' minutes...',
      )
      console.log('')

      const networkConfirmation = waitForLearnBlockchainPublishResponse(
        page,
        timeoutMs,
      )
      const urlConfirmation = waitForLearnBlockchainArticleUrl(
        context,
        timeoutMs,
      )

      const result = await Promise.race([
        networkConfirmation.then((value) => value || urlConfirmation),
        urlConfirmation,
      ])

      return {
        ...result,
        platform: 'learnblockchain',
        ...(media.warning && result.ok
          ? {
              message:
                (result.message || 'LearnBlockchain article published.') +
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
