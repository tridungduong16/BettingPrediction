import type { RootState } from '@/store'

export const selectDashboardData = (state: RootState) => state.dashboard.data

export const selectDashboardStatus = (state: RootState) => state.dashboard.status

export const selectDashboardError = (state: RootState) => state.dashboard.error

export const selectDashboardLiveStatus = (state: RootState) => state.dashboard.liveStatus

export const selectLastLiveSnapshotAt = (state: RootState) => state.dashboard.lastLiveSnapshotAt

export const selectMatchInsight = (state: RootState) => state.dashboard.matchInsight

export const selectInsightPredictionStatus = (state: RootState) =>
  state.dashboard.insightPredictionStatus

export const selectInsightPredictionError = (state: RootState) =>
  state.dashboard.insightPredictionError

export const selectMarketPredictions = (state: RootState) => state.dashboard.marketPredictions

export const selectMarketPredictionStatus = (state: RootState) =>
  state.dashboard.marketPredictionStatus

export const selectMarketPredictionError = (state: RootState) =>
  state.dashboard.marketPredictionError

export const selectSelectedMarket = (state: RootState) =>
  state.dashboard.data.markets.find(
    (market) => market.id === state.dashboard.selectedMarketId,
  ) ?? state.dashboard.data.markets[0]
