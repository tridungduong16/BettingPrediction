import assert from 'node:assert/strict'

import { renderToStaticMarkup } from 'react-dom/server'

import { MarkdownMessage } from '../src/components/FloatingAIAssistant/MarkdownMessage'

const markdown = [
  '**Confidence edge:** Brazil press is producing better shots.',
  '',
  '- Watch the first 15 minutes',
  '- Recheck corners after team news',
  '',
  '[Source](https://example.com/match-note)',
  '',
  '<script>alert("xss")</script>',
].join('\n')

const html = renderToStaticMarkup(<MarkdownMessage content={markdown} fallback="Thinking..." />)

assert.match(html, /<strong>Confidence edge:<\/strong>/)
assert.match(html, /<li>Watch the first 15 minutes<\/li>/)
assert.match(html, /href="https:\/\/example\.com\/match-note"/)
assert.match(html, /target="_blank"/)
assert.doesNotMatch(html, /<script/)
