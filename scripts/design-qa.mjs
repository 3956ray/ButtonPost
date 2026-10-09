import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'patchright'

const url = 'http://127.0.0.1:3187'
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-p', '3187'],
  {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '3187' },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)
let output = ''
server.stdout.on('data', chunk => { output += chunk.toString().slice(-2000) })
server.stderr.on('data', chunk => { output += chunk.toString().slice(-2000) })

let browser
try {
  let started = false
  for (let retry = 0; retry < 90; retry += 1) {
    if (server.exitCode !== null) throw new Error('Next.js exited early: ' + output)
    try {
      const response = await fetch(url)
      if (response.ok) { started = true; break }
    } catch {
      // Waiting for server to start.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  assert.equal(started, true, 'production preview starts')

  browser = await chromium.launch({ headless: true })
  await mkdir('design-qa-artifacts', { recursive: true })

  for (const size of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'small-mobile', width: 320, height: 740 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
    })

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
    await page.locator('#hero-title').waitFor()
    assert.equal(await page.getByRole('link', { name: /start publishing/i }).isVisible(), true)
    assert.equal(await page.locator('#workspace-title').count(), 1)
    assert.equal(await page.getByRole('button', { name: /publish to 0 destinations/i }).isDisabled(), true)
    assert.equal(await page.locator('.platform input[type="checkbox"]:checked').count(), 0)

    const measures = await page.evaluate(() => {
      const hero = document.getElementById('hero-title')?.getBoundingClientRect()
      const side = document.querySelector('.distribution-art')
      const mobile = window.innerWidth <= 760
      return {
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        heroRight: hero?.right,
        heroLeft: hero?.left,
        illustrationDisplayed: side ? getComputedStyle(side).display !== 'none' : false,
        mobile,
      }
    })
    assert.ok(
      measures.documentWidth <= size.width + 3 &&
        measures.bodyWidth <= size.width + 3,
      `${size.name} horizontal overflow: ${JSON.stringify(measures)}`,
    )
    assert.ok((measures.heroRight ?? 0) <= size.width + 2,
      `${size.name} headline exceeds viewport`)
    if (measures.mobile) assert.equal(measures.illustrationDisplayed, false)

    await page.screenshot({
      path: 'design-qa-artifacts/' + size.name + '.png',
      fullPage: true,
    })
    if (size.name === 'desktop' || size.name === 'mobile') {
      const thumbnail = await page.screenshot({ type: 'jpeg', quality: 38 })
      console.log('BUTTONPOST_QA_' + size.name.toUpperCase() + '=' + thumbnail.toString('base64'))
      const full = await page.screenshot({ type: 'jpeg', quality: 25, fullPage: true })
      console.log('BUTTONPOST_QA_' + size.name.toUpperCase() + '_FULL=' + full.toString('base64'))
    }
    if (size.name === 'desktop') {
      await page.keyboard.press('Tab')
      assert.equal(await page.evaluate(() => document.activeElement?.className), 'skip-link')
      await page.locator('#title').fill('ButtonPost design smoke test')
      await page.locator('#content').fill('One original post for all destinations.')
      const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9X4mNwAAAABJRU5ErkJggg==', 'base64')
      await page.locator('#images').setInputFiles([{ name: 'smoke.png', mimeType: 'image/png', buffer: image }])
      assert.equal(await page.getByText('1 image selected', { exact: false }).count(), 1)
      assert.equal(await page.getByRole('button', { name: /publish to 0 destinations/i }).isDisabled(), true)
    }

    // The link in the destination chooser must reveal the optional setup.
    await page.getByRole('link', { name: /enable more platforms/i }).click()
    await page.waitForFunction(
      () => document.querySelector('.runner-toggle')?.getAttribute('aria-expanded') === 'true',
      { timeout: 4000 },
    )
    assert.equal(await page.locator('#runner-details').isVisible(), true)
    console.log('PASS ' + size.name + ': layout, guest onboarding, destinations, optional setup')

    await page.close()
  }

  const login = await browser.newPage({ viewport: { width: 1280, height: 850 } })
  await login.goto(url + '/login', { waitUntil: 'networkidle' })
  assert.equal(await login.getByRole('button', { name: /continue with google/i }).count(), 1)
  assert.equal(await login.getByRole('button', { name: /continue with github/i }).count(), 1)
  await login.screenshot({ path: 'design-qa-artifacts/login.png', fullPage: true })
  await login.close()

  // Authenticate visually using the actual HomeShell and PublisherForm components.
  // This route exists *only* in the ephemeral CI build, never in production.
  for (const size of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'small-mobile', width: 320, height: 740 },
  ]) {
    const member = await browser.newPage({ viewport: size })
    await member.goto(url + '/design-qa-fixture', { waitUntil: 'networkidle' })
    await member.locator('.hero--workspace').waitFor()

    assert.equal(await member.locator('.distribution-art').count(), 0)
    assert.equal(await member.locator('.platform input:checked').count(), 2)
    assert.equal(await member.locator('.platform input:disabled').count(), 3)
    assert.equal(await member.getByRole('button', { name: /publish to 2 destinations/i }).isDisabled(), true)

    const metrics = await member.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      viewport: window.innerWidth,
      composerTop: document.querySelector('.composer')?.getBoundingClientRect().top,
    }))
    assert.ok(metrics.documentWidth <= size.width + 3 && metrics.bodyWidth <= size.width + 3,
      'Signed-in layout overflows at ' + size.name + ': ' + JSON.stringify(metrics))
    if (size.width > 1000) assert.ok((metrics.composerTop ?? 0) < 560, 'Editor is too low on desktop')

    const profile = member.getByLabel('Account menu')
    await profile.click()
    assert.equal(await member.getByRole('link', { name: /account settings/i }).isVisible(), true)
    if (size.width <= 560) {
      assert.equal(await member.getByRole('link', { name: /^connections/i }).isVisible(), true)
    }
    await profile.click()

    await member.screenshot({
      path: 'design-qa-artifacts/signed-in-' + size.name + '.png',
      fullPage: true,
    })

    await member.getByRole('button', { name: /enable local publishing/i }).click()
    assert.equal(await member.locator('#runner-details').isVisible(), true)
    await member.screenshot({
      path: 'design-qa-artifacts/runner-expanded-' + size.name + '.png',
      fullPage: size.name !== 'small-mobile',
    })
    await member.close()
    console.log('PASS signed-in ' + size.name + ': connected / disabled states, nav, Runner and overflow')
  }

  const publisher = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const attempts = []
  await publisher.route('**/api/publish', async route => {
    const body = route.request().postDataJSON()
    attempts.push(body)
    const responses = attempts.length === 1
      ? [
          { platform: 'x', status: 'published', externalUrl: 'https://x.com/example/status/1' },
          { platform: 'devto', status: 'failed', error: 'Temporary rate limit' },
        ]
      : [{ platform: 'devto', status: 'published', externalUrl: 'https://dev.to/example/recovered' }]

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: responses }),
    })
  })

  await publisher.goto(url + '/design-qa-fixture', { waitUntil: 'networkidle' })
  await publisher.locator('#title').fill('A single original post')
  await publisher.locator('#content').fill('One thought, multiple platforms.')
  await publisher.getByRole('button', { name: /publish to 2 destinations/i }).click()
  await publisher.getByText('Temporary rate limit').waitFor()
  assert.equal(attempts.length, 1)
  assert.deepEqual(attempts[0].platforms, ['x', 'devto'])
  assert.equal(await publisher.locator('.result-list .status.published').count(), 1)
  assert.equal(await publisher.locator('.result-list .status.failed').count(), 1)
  await publisher.screenshot({ path: 'design-qa-artifacts/delivery-partial-failure.png', fullPage: true })

  await publisher.getByRole('button', { name: /^Retry failed platforms \(1\)$/ }).click()
  assert.equal(await publisher.locator('.platform input[type=checkbox]').nth(0).isChecked(), false)
  assert.equal(await publisher.locator('.platform input[type=checkbox]').nth(1).isChecked(), true)
  assert.equal(await publisher.locator('#title').inputValue(), 'A single original post')
  assert.equal(await publisher.locator('#content').inputValue(), 'One thought, multiple platforms.')
  assert.equal(attempts.length, 1, 'Selecting Retry must never send without explicit confirmation')
  await publisher.screenshot({ path: 'design-qa-artifacts/retry-only-failed.png', fullPage: true })

  await publisher.getByRole('button', { name: /publish to 1 destination/i }).click()
  await publisher.getByRole('link', { name: /open published post/i }).waitFor()
  assert.equal(attempts.length, 2)
  assert.deepEqual(attempts[1].platforms, ['devto'], 'Successful X post must not be duplicated')
  await publisher.screenshot({ path: 'design-qa-artifacts/retry-recovered.png', fullPage: true })
  await publisher.reload({ waitUntil: 'networkidle' })
  assert.ok(await publisher.getByRole('heading', { name: 'Publication history' }).isVisible())
  await publisher.locator('.history-item').nth(1).waitFor()
  await publisher.close()
  console.log('PASS realistic publish/retry: X published, DEV failed, explicit DEV-only retry, history retained')

  const disconnected = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await disconnected.goto(url + '/design-qa-fixture?mode=disconnected', { waitUntil: 'networkidle' })
  assert.equal(await disconnected.getByRole('link', { name: /connect your first platform/i }).isVisible(), true)
  assert.equal(await disconnected.locator('.platform input[type=checkbox]:enabled').count(), 0)
  await disconnected.screenshot({ path: 'design-qa-artifacts/signed-in-disconnected.png', fullPage: true })
  await disconnected.close()
  console.log('PASS signed-in disconnected onboarding at mobile width')

  const connections = await browser.newPage({ viewport: { width: 1280, height: 840 } })
  await connections.goto(url + '/design-qa-fixture/connections', { waitUntil: 'networkidle' })
  assert.equal(await connections.locator('.connection-card').count(), 2)
  assert.equal(await connections.locator('.connection-state.connected').count(), 1)
  await connections.screenshot({ path: 'design-qa-artifacts/connections-connected.png', fullPage: true })
  await connections.close()
  console.log('PASS actual connection cards: connected / disconnected')

  console.log('PASS design QA: guest + signed-in, four widths, publishing feedback and failed-only retry')
} finally {
  await browser?.close().catch(() => {})
  server.kill('SIGTERM')
}
