import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,}$/

export async function loadOrCreateRunnerToken({
  directory = path.join(os.homedir(), '.buttonpost'),
  override = process.env.BUTTONPOST_RUNNER_TOKEN,
} = {}) {
  if (override) {
    if (!TOKEN_PATTERN.test(override)) {
      throw new Error('BUTTONPOST_RUNNER_TOKEN must be at least 32 URL-safe characters.')
    }
    return { token: override, created: false }
  }

  await mkdir(directory, { recursive: true, mode: 0o700 })
  const tokenPath = path.join(directory, 'runner-token')

  async function readExisting() {
    const token = (await readFile(tokenPath, 'utf8')).trim()
    if (!TOKEN_PATTERN.test(token)) {
      throw new Error('Stored runner token is invalid. Review ~/.buttonpost/runner-token.')
    }
    return { token, created: false }
  }

  try {
    return await readExisting()
  } catch (cause) {
    if (cause?.code !== 'ENOENT') throw cause
  }

  const token = randomBytes(32).toString('base64url')
  try {
    await writeFile(tokenPath, token + '\n', {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    return { token, created: true }
  } catch (cause) {
    if (cause?.code !== 'EEXIST') throw cause
    return readExisting()
  }
}
