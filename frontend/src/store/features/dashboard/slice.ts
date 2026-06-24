import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { dashboardPlaceholder, getDashboardPlaceholder } from '@/data/placeholder'
import type { LanguageCode } from '@/i18n/languages'
import type {
  LiveMatchSnapshot,
  LiveProviderStatus,
  MarketPredictionResponse,
  MatchInsightResponse,
  PredictionMode,
  PredictionChatRecommendedQuestionsResponse,
  WorldCupMatch,
} from '@/store/features/dashboard/apiTypes'
import {
  applyMatchInsightToDashboardData,
  applyLiveSnapshotToDashboardData,
  liveStatusMessage,
  mapWorldCupMatchToDashboardData,
} from '@/store/features/dashboard/mappers'
import type { DashboardData } from '@/store/features/dashboard/types'

export type DashboardStatus = 'error' | 'idle' | 'loading' | 'ready'
export type DashboardLiveStatus = LiveProviderStatus
export type DashboardMarketPredictionStatus = 'error' | 'idle' | 'loading' | 'ready'
export type DashboardInsightPredictionStatus = 'error' | 'idle' | 'loading' | 'ready'

export interface DashboardMatchRequest {
  background?: boolean
  forceRefresh?: boolean
  language: LanguageCode
  matchId: string
  predictionMode?: PredictionMode
  providerFixtureId?: string | null
}

interface LoadMatchSucceededPayload {
  language: LanguageCode
  match: WorldCupMatch
}

interface LiveSnapshotReceivedPayload {
  language: LanguageCode
  snapshot: LiveMatchSnapshot
}

export interface DashboardState {
  activeMatchId?: string
  data: DashboardData
  error?: string
  insightPredictionError?: string
  insightPredictionStatus: DashboardInsightPredictionStatus
  matchInsight?: MatchInsightResponse
  lastLiveSnapshotAt?: string
  liveSnapshot?: LiveMatchSnapshot
  liveStatus: DashboardLiveStatus
  marketPredictionError?: string
  marketPredictionStatus: DashboardMarketPredictionStatus
  marketPredictions?: MarketPredictionResponse
  selectedMarketId: string
  status: DashboardStatus
}

const initialState: DashboardState = {
  data: dashboardPlaceholder,
  insightPredictionStatus: 'idle',
  liveStatus: 'not_configured',
  marketPredictionStatus: 'idle',
  selectedMarketId: dashboardPlaceholder.markets[0]?.id ?? '',
  status: 'idle',
}

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    loadMatchRequested(state, action: PayloadAction<DashboardMatchRequest>) {
      state.activeMatchId = action.payload.matchId
      state.status = 'loading'
      state.error = undefined
      state.data = getDashboardPlaceholder(action.payload.language)
      state.insightPredictionError = undefined
      state.insightPredictionStatus = 'idle'
      state.lastLiveSnapshotAt = undefined
      state.liveSnapshot = undefined
      state.liveStatus = 'not_configured'
      state.matchInsight = undefined
      state.marketPredictionError = undefined
      state.marketPredictionStatus = 'idle'
      state.marketPredictions = undefined
    },
    loadMatchSucceeded(state, action: PayloadAction<LoadMatchSucceededPayload>) {
      state.status = 'ready'
      state.error = undefined
      state.data = mapWorldCupMatchToDashboardData(
        action.payload.match,
        action.payload.language,
        state.data,
      )
    },
    loadMatchFailed(state, action: PayloadAction<string>) {
      state.status = 'error'
      state.error = action.payload
    },
    selectMarket(state, action: PayloadAction<string>) {
      state.selectedMarketId = action.payload
    },
    loadMarketPredictionsRequested(state, action: PayloadAction<DashboardMatchRequest>) {
      void action.payload.matchId
      state.marketPredictionStatus = 'loading'
      state.marketPredictionError = undefined
      if (!action.payload.background) {
        state.marketPredictions = undefined
      }
    },
    loadMarketPredictionsSucceeded(state, action: PayloadAction<MarketPredictionResponse>) {
      state.marketPredictionStatus = 'ready'
      state.marketPredictionError = undefined
      state.marketPredictions = action.payload
    },
    loadMarketPredictionsFailed(state, action: PayloadAction<string>) {
      state.marketPredictionStatus = 'error'
      state.marketPredictionError = action.payload
    },
    loadMatchInsightRequested(state, action: PayloadAction<DashboardMatchRequest>) {
      void action.payload.matchId
      state.insightPredictionStatus = 'loading'
      state.insightPredictionError = undefined
      if (!action.payload.background) {
        state.matchInsight = undefined
      }
    },
    loadMatchInsightSucceeded(state, action: PayloadAction<MatchInsightResponse>) {
      state.insightPredictionStatus = 'ready'
      state.insightPredictionError = undefined
      state.matchInsight = action.payload
      state.data = applyMatchInsightToDashboardData(action.payload, state.data, action.payload.language)
    },
    loadMatchInsightFailed(state, action: PayloadAction<string>) {
      state.insightPredictionStatus = 'error'
      state.insightPredictionError = action.payload
    },
    loadRecommendedChatQuestionsRequested(state, action: PayloadAction<DashboardMatchRequest>) {
      void state
      void action.payload.matchId
    },
    loadRecommendedChatQuestionsSucceeded(
      state,
      action: PayloadAction<PredictionChatRecommendedQuestionsResponse>,
    ) {
      if (action.payload.questions.length) {
        state.data.prompts = action.payload.questions.slice(0, 3)
      }
    },
    loadRecommendedChatQuestionsFailed(state, action: PayloadAction<string>) {
      void state
      void action.payload
    },
    startLivePolling(state, action: PayloadAction<DashboardMatchRequest>) {
      void state
      void action.payload.matchId
    },
    stopLivePolling() {},
    liveSnapshotReceived(state, action: PayloadAction<LiveSnapshotReceivedPayload>) {
      state.liveStatus = action.payload.snapshot.provider_status
      state.liveSnapshot = action.payload.snapshot
      state.lastLiveSnapshotAt = action.payload.snapshot.observed_at
      state.error = liveStatusMessage(
        action.payload.snapshot.provider_status,
        action.payload.snapshot.error,
        action.payload.language,
      )
      state.data = applyLiveSnapshotToDashboardData(
        action.payload.snapshot,
        state.data,
        action.payload.language,
      )
    },
    liveSnapshotFailed(state, action: PayloadAction<string>) {
      state.liveStatus = 'provider_error'
      state.error = action.payload
    },
    refreshPredictionTimestamp(state) {
      state.data.prediction.lastUpdated = new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date())
    },
  },
})

export const dashboardActions = dashboardSlice.actions
export const dashboardReducer = dashboardSlice.reducer
