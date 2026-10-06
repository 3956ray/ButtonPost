import assert from 'node:assert/strict'
import test from 'node:test'
import { markdownToPlainText } from '../lib/content/markdown-to-plain.ts'

test('markdownToPlainText keeps meaning while removing Markdown syntax', () => {
  const source = '# Shipping **ButtonPost**\n\nRead the [repo](https://github.com/3956ray/ButtonPost).'
  assert.equal(
    markdownToPlainText(source),
    'Shipping ButtonPost\n\nRead the repo https://github.com/3956ray/ButtonPost.',
  )
})

test('markdownToPlainText keeps list structure as plain bullets', () => {
  assert.equal(markdownToPlainText('- X\n- DEV'), '• X\n• DEV')
})
