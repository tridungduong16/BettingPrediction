import { request } from '@/api/http'
import type { MarketPredictionResponse } from '@/store/features/dashboard/apiTypes'

interface MarketPredictionQuery {
  forceRefresh?: boolean
  includeLive?: boolean
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
        provider_fixture_id: query.providerFixtureId,
        source: query.source,
        year: query.year,
      },
    },
  )
}
