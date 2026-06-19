import { buildApiUrl, request } from '@/api/http'
import type { LanguageCode } from '@/i18n/languages'
import type {
  MarketPredictionResponse,
  MatchInsightResponse,
  PredictionChatRequest,
  PredictionChatResponse,
  PredictionChatStreamEvent,
} from '@/store/features/dashboard/apiTypes'

interface MarketPredictionQuery {
  forceRefresh?: boolean
  includeLive?: boolean
  includeNews?: boolean
  language?: LanguageCode
  newsMaxResults?: number
  providerFixtureId?: string
  source?: 'auto' | 'openfootball' | 'upbound'
  year?: number
}

type ChatStreamHandler = (event: PredictionChatStreamEvent) => void

interface ChatStreamOptions extends MarketPredictionQuery {
  signal?: AbortSignal
}

function predictionQuery(query: MarketPredictionQuery = {}) {
  return {
    force_refresh: query.forceRefresh,
    include_live: query.includeLive,
    include_news: query.includeNews,
    language: query.language,
    news_max_results: query.newsMaxResults,
    provider_fixture_id: query.providerFixtureId,
    source: query.source,
    year: query.year,
  }
}

function parseSseMessage(message: string): PredictionChatStreamEvent | undefined {
  const data = message
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')

  if (!data) {
    return undefined
  }

  return JSON.parse(data) as PredictionChatStreamEvent
}

function emitSseMessages(buffer: string, onEvent: ChatStreamHandler) {
  let remaining = buffer
  let boundary = remaining.indexOf('\n\n')

  while (boundary >= 0) {
    const rawMessage = remaining.slice(0, boundary).trim()
    remaining = remaining.slice(boundary + 2)

    if (rawMessage) {
      const event = parseSseMessage(rawMessage)

      if (event) {
        onEvent(event)
      }
    }

    boundary = remaining.indexOf('\n\n')
  }

  return remaining
}

export function getMarketPredictions(matchId: string, query: MarketPredictionQuery = {}) {
  return request<MarketPredictionResponse>(
    `/api/predictions/matches/${encodeURIComponent(matchId)}/markets`,
    {
      query: predictionQuery(query),
    },
  )
}

export function getMatchInsight(matchId: string, query: MarketPredictionQuery = {}) {
  return request<MatchInsightResponse>(
    `/api/predictions/matches/${encodeURIComponent(matchId)}/insight`,
    {
      query: predictionQuery(query),
    },
  )
}

export function chatAboutMatch(
  matchId: string,
  body: PredictionChatRequest,
  query: MarketPredictionQuery = {},
) {
  return request<PredictionChatResponse>(
    `/api/predictions/matches/${encodeURIComponent(matchId)}/chat`,
    {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      query: predictionQuery(query),
    },
  )
}

export async function streamMatchChat(
  matchId: string,
  body: PredictionChatRequest,
  onEvent: ChatStreamHandler,
  options: ChatStreamOptions = {},
) {
  const response = await fetch(
    buildApiUrl(
      `/api/predictions/matches/${encodeURIComponent(matchId)}/chat/stream`,
      predictionQuery(options),
    ),
    {
      body: JSON.stringify(body),
      credentials: 'include',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: options.signal,
    },
  )

  if (!response.ok) {
    throw new Error(response.statusText || 'Chat stream failed')
  }

  if (!response.body) {
    throw new Error('Chat stream is unavailable')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer = emitSseMessages(buffer + decoder.decode(value, { stream: true }), onEvent)
    }

    buffer = emitSseMessages(buffer + decoder.decode(), onEvent)

    if (buffer.trim()) {
      const event = parseSseMessage(buffer.trim())

      if (event) {
        onEvent(event)
      }
    }
  } finally {
    reader.releaseLock()
  }
}
