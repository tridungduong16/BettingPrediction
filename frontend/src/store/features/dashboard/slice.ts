import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { dashboardPlaceholder } from '@/data/placeholder'
import type {
  LiveMatchSnapshot,
  LiveProviderStatus,
  MarketPredictionResponse,
  WorldCupMatch,
} from '@/store/features/dashboard/apiTypes'
import {
  applyLiveSnapshotToDashboardData,
  liveStatusMessage,
  mapWorldCupMatchToDashboardData,
} from '@/store/features/dashboard/mappers'
import type { DashboardData } from '@/store/features/dashboard/types'

export type DashboardStatus = 'error' | 'idle' | 'loading' | 'ready'
export type DashboardLiveStatus = LiveProviderStatus
export type DashboardMarketPredictionStatus = 'error' | 'idle' | 'loading' | 'ready'

export interface DashboardState {
  data: DashboardData
  error?: string
  lastLiveSnapshotAt?: string
  liveStatus: DashboardLiveStatus
  marketPredictionError?: string
  marketPredictionStatus: DashboardMarketPredictionStatus
  marketPredictions?: MarketPredictionResponse
  selectedMarketId: string
  status: DashboardStatus
}

const initialState: DashboardState = {
  data: dashboardPlaceholder,
  liveStatus: 'not_configured',
  marketPredictionStatus: 'idle',
  selectedMarketId: dashboardPlaceholder.markets[0]?.id ?? '',
  status: 'idle',
}

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    loadMatchRequested(state, action: PayloadAction<string>) {
      void action.payload
      state.status = 'loading'
      state.error = undefined
      state.marketPredictionError = undefined
      state.marketPredictionStatus = 'idle'
      state.marketPredictions = undefined
    },
    loadMatchSucceeded(state, action: PayloadAction<WorldCupMatch>) {
      state.status = 'ready'
      state.error = undefined
      state.data = mapWorldCupMatchToDashboardData(action.payload, state.data)
    },
    loadMatchFailed(state, action: PayloadAction<string>) {
      state.status = 'error'
      state.error = action.payload
    },
    selectMarket(state, action: PayloadAction<string>) {
      state.selectedMarketId = action.payload
    },
    loadMarketPredictionsRequested(state, action: PayloadAction<string>) {
      void action.payload
      state.marketPredictionStatus = 'loading'
      state.marketPredictionError = undefined
      state.marketPredictions = undefined
    },
    loadMarketPredictionsSucceeded(state, action: PayloadAction<MarketPredictionResponse>) {
      state.marketPredictionStatus = 'ready'
      state.marketPredictionError = undefined
      state.marketPredictions = action.payload
    },
    loadMarketPredictionsFailed(state, action: PayloadAction<string>) {
      state.marketPredictionStatus = 'error'
      state.marketPredictionError = action.payload
      state.marketPredictions = undefined
    },
    startLivePolling(state, action: PayloadAction<string>) {
      void state
      void action.payload
    },
    stopLivePolling() {},
    liveSnapshotReceived(state, action: PayloadAction<LiveMatchSnapshot>) {
      state.liveStatus = action.payload.provider_status
      state.lastLiveSnapshotAt = action.payload.observed_at
      state.error = liveStatusMessage(action.payload.provider_status, action.payload.error)
      state.data = applyLiveSnapshotToDashboardData(action.payload, state.data)
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
