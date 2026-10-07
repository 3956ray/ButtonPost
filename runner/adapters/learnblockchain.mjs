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
          'Timed out waiting for the selected login flow to return to LearnBlockchain. The browser was kept open for the full login window.',
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
          '.CodeMirror',
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

async function fillEditorLocator(page, locator, value) {
  const meta = await locator.evaluate((element) => ({
    tagName: element.tagName.toLowerCase(),
    contentEditable: element.getAttribute('contenteditable'),
    isCodeMirror:
      element.classList.contains('CodeMirror') ||
      Boolean(element.closest?.('.CodeMirror')),
  }))

  if (meta.isCodeMirror) {
    const codeMirrorFilled = await locator
      .evaluate((element, text) => {
        const root = element.classList.contains('CodeMirror')
          ? element
          : element.closest?.('.CodeMirror')
        const editor = root?.CodeMirror

        if (editor && typeof editor.setValue === 'function') {
          editor.setValue(text)
          editor.focus?.()
          return true
        }

        return false
      }, value)
      .catch(() => false)

    if (codeMirrorFilled) return

    const root = locator.locator('xpath=ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " CodeMirror ")][1]')
    const textarea = root.locator('textarea').first()

    if ((await textarea.count()) > 0) {
      await textarea.evaluate((element) => element.focus())
    } else {
      await locator.click()
    }

    await page.keyboard.press(
      process.platform === 'darwin' ? 'Meta+A' : 'Control+A',
    )
    await page.keyboard.insertText(value)
    await sleep(300)

    const rendered = (
      (await root.locator('.CodeMirror-code').textContent().catch(() => '')) ||
      (await root.textContent().catch(() => '')) ||
      ''
    ).trim()

    if (!rendered && value.trim()) {
      throw new Error(
        'LearnBlockchain CodeMirror editor did not accept the Markdown body.',
      )
    }

    return
  }

  if (
    meta.tagName === 'input' ||
    meta.tagName === 'textarea' ||
    meta.contentEditable === 'true'
  ) {
    await locator.fill(value)
    return
  }

  await locator.click()
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+A' : 'Control+A',
  )
  await page.keyboard.insertText(value)
}

async function getLearnBlockchainEditorValue(locator) {
  return locator.evaluate((element) => {
    const root = element.classList.contains('CodeMirror')
      ? element
      : element.closest?.('.CodeMirror')
    const editor = root?.CodeMirror

    if (editor && typeof editor.getValue === 'function') {
      return String(editor.getValue() || '')
    }

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      return element.value || ''
    }

    const textarea = root?.querySelector('textarea')
    if (textarea instanceof HTMLTextAreaElement && textarea.value) {
      return textarea.value
    }

    return element.textContent || ''
  })
}

export function extractLearnBlockchainImageUrl(value) {
  if (value === null || value === undefined) return null

  const source =
    typeof value === 'string' ? value : JSON.stringify(value)
  if (!source) return null

  const normalized = source
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')

  const absolute = normalized.match(
    /https?:\/\/img\.learnblockchain\.cn\/[^\s"'<>\\]+/i,
  )
  if (absolute?.[0]) return absolute[0]

  const relative = normalized.match(
    /\/?(?:attachments|pics|20\d{2}\/)[^\s"'<>\\]+/i,
  )
  if (relative?.[0]) {
    const pathname = relative[0].startsWith('/')
      ? relative[0]
      : '/' + relative[0]
    return 'https://img.learnblockchain.cn' + pathname
  }

  return null
}

function beginLearnBlockchainImageCapture(page) {
  let imageUrl = null

  const listener = async (response) => {
    if (imageUrl || !response.ok()) return

    const method = response.request().method()
    if (!['POST', 'PUT', 'PATCH'].includes(method)) return

    const direct = extractLearnBlockchainImageUrl(response.url())
    if (direct) {
      imageUrl = direct
      return
    }

    const headers = response.headers()
    const contentType = String(headers['content-type'] || '')
    const contentLength = Number(headers['content-length'] || '0')

    if (
      contentLength > 2 * 1024 * 1024 ||
      (!contentType.includes('json') &&
        !contentType.includes('text') &&
        !contentType.includes('javascript'))
    ) {
      return
    }

    const body = await response.text().catch(() => '')
    const captured = extractLearnBlockchainImageUrl(body)
    if (captured) imageUrl = captured
  }

  page.on('response', listener)

  return {
    getUrl() {
      return imageUrl
    },
    stop() {
      page.off('response', listener)
    },
  }
}

function learnBlockchainImageMarkdown(imagePath, imageUrl) {
  const alt = path
    .basename(imagePath)
    .replace(/[\[\]]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return `![${alt || 'image'}](${imageUrl})`
}

function hasMarkdownImageAdded(before, after) {
  if (!after || after === before) return false

  const beforeCount =
    (before.match(/!\[[^\]]*\]\([^\n)]+\)/g) || []).length +
    (before.match(/<img\b/gi) || []).length
  const afterCount =
    (after.match(/!\[[^\]]*\]\([^\n)]+\)/g) || []).length +
    (after.match(/<img\b/gi) || []).length

  return (
    afterCount > beforeCount ||
    after.includes('img.learnblockchain.cn/')
  )
}

async function appendLearnBlockchainImageMarkdown(
  page,
  contentLocator,
  imagePath,
  imageUrl,
) {
  const current = await getLearnBlockchainEditorValue(contentLocator)
  if (current.includes(imageUrl)) return

  const markdown = learnBlockchainImageMarkdown(imagePath, imageUrl)
  const next = current.trimEnd() + '\n\n' + markdown + '\n'
  await fillEditorLocator(page, contentLocator, next)
}

async function rankedLearnBlockchainFileInputs(page) {
  const inputs = page.locator('input[type="file"]')
  const count = await inputs.count()
  const ranked = []

  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index)
    const details = await input
      .evaluate((element) => {
        const attributes = [
          element.getAttribute('accept'),
          element.getAttribute('name'),
          element.getAttribute('id'),
          element.getAttribute('class'),
          element.getAttribute('aria-label'),
          element.getAttribute('title'),
          element.closest('label')?.textContent,
          element.parentElement?.textContent,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return {
          attributes,
          accept: element.getAttribute('accept') || '',
          multiple: element.hasAttribute('multiple'),
        }
      })
      .catch(() => null)

    if (!details) continue

    let score = 0
    if (details.accept.toLowerCase().includes('image')) score += 20
    if (details.multiple) score += 4
    if (
      /image|img|upload|attachment|picture|photo|content|markdown|editor|图片|上传|附件|正文/i.test(
        details.attributes,
      )
    ) {
      score += 12
    }
    if (
      /cover|featured|avatar|logo|thumb|thumbnail|banner|封面|头像/i.test(
        details.attributes,
      )
    ) {
      score -= 40
    }

    ranked.push({ input, score, index })
  }

  return ranked.sort(
    (left, right) => right.score - left.score || left.index - right.index,
  )
}

async function tryLearnBlockchainFileInput(
  page,
  contentLocator,
  input,
  imagePath,
) {
  const before = await getLearnBlockchainEditorValue(contentLocator)
  const capture = beginLearnBlockchainImageCapture(page)

  try {
    await input.setInputFiles(imagePath)

    const deadline = Date.now() + 12_000
    while (Date.now() < deadline) {
      const current = await getLearnBlockchainEditorValue(contentLocator)
      if (hasMarkdownImageAdded(before, current)) {
        return { ok: true, nativeInserted: true, imageUrl: capture.getUrl() }
      }

      const imageUrl = capture.getUrl()
      if (imageUrl) {
        await sleep(700)

        const afterSettle = await getLearnBlockchainEditorValue(contentLocator)
        if (!hasMarkdownImageAdded(before, afterSettle)) {
          await appendLearnBlockchainImageMarkdown(
            page,
            contentLocator,
            imagePath,
            imageUrl,
          )
        }

        return { ok: true, nativeInserted: false, imageUrl }
      }

      await sleep(400)
    }

    return { ok: false, nativeInserted: false, imageUrl: null }
  } catch {
    return { ok: false, nativeInserted: false, imageUrl: null }
  } finally {
    capture.stop()
  }
}

async function tryLearnBlockchainToolbarUpload(
  page,
  contentLocator,
  imagePath,
) {
  const selectors = [
    'button[title*="上传图片"]',
    'button[aria-label*="上传图片"]',
    'a[title*="上传图片"]',
    'a[aria-label*="上传图片"]',
    'button:has-text("上传图片")',
    'a:has-text("上传图片")',
    '.editor-toolbar [title*="Upload image" i]',
    '.editor-toolbar [aria-label*="Upload image" i]',
  ]

  const button = await firstVisible(page, selectors, 1_500)
  if (!button) return { ok: false, nativeInserted: false, imageUrl: null }

  const before = await getLearnBlockchainEditorValue(contentLocator)
  const capture = beginLearnBlockchainImageCapture(page)

  try {
    const chooserPromise = page
      .waitForEvent('filechooser', { timeout: 2_500 })
      .catch(() => null)

    await button.click()
    const chooser = await chooserPromise

    if (chooser) {
      await chooser.setFiles(imagePath)
    } else {
      const ranked = await rankedLearnBlockchainFileInputs(page)
      const candidate = ranked.find((item) => item.score > -20)
      if (!candidate) return { ok: false, nativeInserted: false, imageUrl: null }
      await candidate.input.setInputFiles(imagePath)
    }

    const deadline = Date.now() + 12_000
    while (Date.now() < deadline) {
      const current = await getLearnBlockchainEditorValue(contentLocator)
      if (hasMarkdownImageAdded(before, current)) {
        return { ok: true, nativeInserted: true, imageUrl: capture.getUrl() }
      }

      const imageUrl = capture.getUrl()
      if (imageUrl) {
        await sleep(700)
        const settled = await getLearnBlockchainEditorValue(contentLocator)
        if (!hasMarkdownImageAdded(before, settled)) {
          await appendLearnBlockchainImageMarkdown(
            page,
            contentLocator,
            imagePath,
            imageUrl,
          )
        }

        return { ok: true, nativeInserted: false, imageUrl }
      }

      await sleep(400)
    }

    if ((await getLearnBlockchainEditorValue(contentLocator)) !== before) {
      await fillEditorLocator(page, contentLocator, before)
    }

    return { ok: false, nativeInserted: false, imageUrl: null }
  } catch {
    return { ok: false, nativeInserted: false, imageUrl: null }
  } finally {
    capture.stop()
  }
}

async function uploadLearnBlockchainImages(
  page,
  contentLocator,
  imagePaths,
) {
  if (!imagePaths.length) {
    return { uploaded: 0, inserted: 0, warning: null }
  }

  let uploaded = 0
  let inserted = 0
  const failed = []

  for (const imagePath of imagePaths) {
    let result = await tryLearnBlockchainToolbarUpload(
      page,
      contentLocator,
      imagePath,
    )

    if (!result.ok) {
      const rankedInputs = await rankedLearnBlockchainFileInputs(page)

      for (const candidate of rankedInputs) {
        result = await tryLearnBlockchainFileInput(
          page,
          contentLocator,
          candidate.input,
          imagePath,
        )
        if (result.ok) break
      }
    }

    if (result.ok) {
      uploaded += 1
      inserted += 1
    } else {
      failed.push(path.basename(imagePath))
    }
  }

  return {
    uploaded,
    inserted,
    warning:
      failed.length > 0
        ? 'ButtonPost could not insert ' +
          failed.length +
          ' LearnBlockchain image(s) into the Markdown body: ' +
          failed.join(', ') +
          '. Add them manually before publishing.'
        : null,
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

      await fillEditorLocator(page, editor.title, normalizedTitle)
      await fillEditorLocator(page, editor.content, normalizedContent)

      const media = await uploadLearnBlockchainImages(
        page,
        editor.content,
        normalizedImages,
      )

      const timeoutMs = learnBlockchainReviewTimeoutMs()
      console.log('')
      console.log('LearnBlockchain review mode')
      console.log('  ButtonPost filled the article title and Markdown body.')
      if (media.uploaded) {
        console.log(
          '  LearnBlockchain images uploaded/inserted: ' +
            media.inserted +
            '/' +
            normalizedImages.length,
        )
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
