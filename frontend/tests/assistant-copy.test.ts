import assert from 'node:assert/strict'

import {
  assistantCopy,
  assistantMessageFallback,
  assistantThreadId,
  assistantToolActivityMessage,
} from '../src/components/FloatingAIAssistant'

function mapStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

const viCopy = assistantCopy('vi')

assert.equal(viCopy.status, 'Đang đọc dữ liệu trận...')
assert.doesNotMatch(viCopy.status, /context/i)

const firstSessionStorage = mapStorage()
const firstThreadId = assistantThreadId('2026-001-netherlands-vs-sweden', {
  createId: () => 'client-session-a',
  storage: firstSessionStorage,
})
const repeatedThreadId = assistantThreadId('2026-001-netherlands-vs-sweden', {
  createId: () => 'client-session-b',
  storage: firstSessionStorage,
})
const nextSessionThreadId = assistantThreadId('2026-001-netherlands-vs-sweden', {
  createId: () => 'client-session-b',
  storage: mapStorage(),
})

assert.equal(firstThreadId, '2026-001-netherlands-vs-sweden:client-session-a')
assert.equal(repeatedThreadId, firstThreadId)
assert.equal(nextSessionThreadId, '2026-001-netherlands-vs-sweden:client-session-b')
assert.notEqual(firstThreadId, '2026-001-netherlands-vs-sweden')
assert.notEqual(nextSessionThreadId, firstThreadId)

assert.equal(
  assistantToolActivityMessage({
    content: {
      args: {
        query: 'Netherlands Sweden odds',
      },
      name: 'search_latest_information',
    },
    type: 'tool_call',
  }, 'vi'),
  undefined,
)
assert.equal(
  assistantToolActivityMessage({
    content: {
      args: {
        query: 'Brazil vs France latest match news',
      },
      name: 'search_match_news',
    },
    type: 'tool_call',
  }, 'vi'),
  undefined,
)
assert.equal(
  assistantToolActivityMessage({
    content: {
      name: 'search_match_news',
      result: "{'provider_status': 'ready'}",
    },
    type: 'tool_result',
  }, 'vi'),
  undefined,
)
assert.equal(
  assistantToolActivityMessage({
    content: {
      args: {},
      name: 'some_internal_tool',
    },
    type: 'tool_call',
  }, 'en'),
  undefined,
)
assert.equal(
  assistantToolActivityMessage({
    content: {},
    type: 'text_delta',
  }, 'vi'),
  undefined,
)

const currentMessages = [
  { id: 'user-1', message: 'Có tin mới không?', sender: 'user' as const },
  { id: 'ai-1', message: 'Đầu câu trả lời đã stream', sender: 'ai' as const },
]

assert.equal(
  assistantMessageFallback(
    { id: 'ai-1', message: '', sender: 'ai' },
    currentMessages,
    'streaming',
    'Đang đọc dữ liệu trận...',
  ),
  'Đang đọc dữ liệu trận...',
)
assert.equal(
  assistantMessageFallback(
    { id: 'ai-2', message: '', sender: 'ai' },
    currentMessages,
    'streaming',
    'Đang đọc dữ liệu trận...',
  ),
  'Đang đọc dữ liệu trận...',
)
