import { request } from '@/api/http'
import type {
  MarketPredictionResponse,
  MatchInsightResponse,
} from '@/store/features/dashboard/apiTypes'

interface MarketPredictionQuery {
  forceRefresh?: boolean
  includeLive?: boolean
  includeNews?: boolean
  newsMaxResults?: number
  providerFixtureId?: string
  source?: 'auto' | 'openfootball' | 'upbound'
  year?: number
}

export function getMarketPredictions(matchId: string, query: MarketPredictionQuery = {}) {
  return request<MarketPredictionResponse>(
    `/api/predictions/matches/${encodeURIComponent(matchId)}/markets`,
    {
      query: {
        force_refresh: query.forceRefresh,
        include_live: query.includeLive,
        include_news: query.includeNews,
        news_max_results: query.newsMaxResults,
        provider_fixture_id: query.providerFixtureId,
        source: query.source,
        year: query.year,
      },
    },
  )
}

export function getMatchInsight(matchId: string, query: MarketPredictionQuery = {}) {
  return request<MatchInsightResponse>(
    `/api/predictions/matches/${encodeURIComponent(matchId)}/insight`,
    {
      query: {
        force_refresh: query.forceRefresh,
        include_live: query.includeLive,
        include_news: query.includeNews,
        news_max_results: query.newsMaxResults,
        provider_fixture_id: query.providerFixtureId,
        source: query.source,
        year: query.year,
      },
    },
  )
}
