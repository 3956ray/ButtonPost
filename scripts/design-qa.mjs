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

    if (size.name === 'desktop') {
      await page.keyboard.press('Tab')
      assert.equal(await page.evaluate(() => document.activeElement?.className), 'skip-link')
    }

    await page.screenshot({
      path: 'design-qa-artifacts/' + size.name + '.png',
      fullPage: true,
    })
    if (size.name === 'desktop' || size.name === 'mobile') {
      const thumbnail = await page.screenshot({ type: 'jpeg', quality: 38 })
      console.log('BUTTONPOST_QA_' + size.name.toUpperCase() + '=' + thumbnail.toString('base64'))
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

  console.log('PASS design QA: four viewport widths, guest login, independent helper setup')
} finally {
  await browser?.close().catch(() => {})
  server.kill('SIGTERM')
}
