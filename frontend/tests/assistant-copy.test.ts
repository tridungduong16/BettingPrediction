import assert from 'node:assert/strict'

import {
  ENABLE_RESPONSE_FOLLOW_UPS,
  assistantCopy,
  assistantMessageFallback,
  assistantNextPrompts,
  assistantStreamAnswerMessage,
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
const enCopy = assistantCopy('en')

assert.equal(viCopy.status, 'Đang suy nghĩ...')
assert.equal(enCopy.status, 'Thinking...')
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
assert.equal(ENABLE_RESPONSE_FOLLOW_UPS, true)

assert.deepEqual(
  assistantNextPrompts(
    [
      'Find the latest information on Netherlands vs Sweden',
      'Which market has the clearest edge?',
      'What could change the prediction live?',
      'How risky is the Asian handicap?',
    ],
    'Find the latest information on Netherlands vs Sweden',
  ),
  [
    'Which market has the clearest edge?',
    'What could change the prediction live?',
  ],
)

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
  'Đang tìm thông tin mới nhất về Netherlands Sweden odds',
)
assert.equal(
  assistantToolActivityMessage({
    content: {
      args: {
        query: 'Netherlands Sweden World Cup 2026 confirmed lineups injury update June 20 2026 Reuters AP',
      },
      name: 'search_latest_information',
    },
    type: 'tool_call',
  }, 'en'),
  'Search latest information about Netherlands Sweden World Cup 2026 confirmed lineups injury update June 20 2026 Reuters AP',
)
assert.equal(
  assistantToolActivityMessage({
    content: {
      args: {
        query: 'Netherlands vs Sweden latest match news',
      },
      name: 'search_match_news',
    },
    type: 'tool_call',
  }, 'en'),
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

assert.equal(
  assistantStreamAnswerMessage(
    'Đang tìm thông tin mới nhất về trận đấu...',
    { content: 'Brazil', type: 'text_delta' },
    false,
  ),
  'Brazil',
)
assert.equal(
  assistantStreamAnswerMessage(
    'Brazil',
    { content: ' nhỉnh hơn', type: 'text_delta' },
    true,
  ),
  'Brazil nhỉnh hơn',
)
assert.equal(
  assistantStreamAnswerMessage(
    'Brazil nhỉnh hơn',
    { content: 'Brazil có lợi thế rõ hơn.', type: 'done' },
    true,
  ),
  'Brazil có lợi thế rõ hơn.',
)
assert.equal(
  assistantStreamAnswerMessage(
    'Brazil nhỉnh hơn',
    { content: {}, type: 'tool_call' },
    true,
  ),
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
    'Thinking...',
  ),
  'Thinking...',
)
assert.equal(
  assistantMessageFallback(
    { id: 'ai-2', message: '', sender: 'ai' },
    currentMessages,
    'streaming',
    'Thinking...',
  ),
  'Thinking...',
)
