import type { PayloadAction } from '@reduxjs/toolkit'
import { all, call, delay, put, race, take, takeLatest } from 'redux-saga/effects'

import { getLiveMatchSnapshot } from '@/api/liveEvents'
import {
  getMarketPredictions,
  getMatchInsight,
  getRecommendedChatQuestions,
} from '@/api/predictions'
import { getWorldCupMatch } from '@/api/worldcup'
import { env } from '@/config/env'
import type {
  LiveMatchSnapshot,
  MarketPredictionResponse,
  MatchInsightResponse,
  PredictionChatRecommendedQuestionsResponse,
  WorldCupMatch,
} from '@/store/features/dashboard/apiTypes'
import { dashboardActions, type DashboardMatchRequest } from '@/store/features/dashboard/slice'

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Yêu cầu dashboard gặp lỗi không xác định.'
}

function* loadMatch(action: PayloadAction<DashboardMatchRequest>) {
  try {
    const { language, matchId } = action.payload
    const match: WorldCupMatch = yield call(getWorldCupMatch, matchId)
    yield put(dashboardActions.loadMatchSucceeded({ language, match }))
    yield put(dashboardActions.loadMatchInsightRequested({ language, matchId }))
    yield put(dashboardActions.loadMarketPredictionsRequested({ language, matchId }))
    yield put(dashboardActions.loadRecommendedChatQuestionsRequested({ language, matchId }))
  } catch (error) {
    yield put(dashboardActions.loadMatchFailed(errorMessage(error)))
  }
}

function* loadMarketPredictions(action: PayloadAction<DashboardMatchRequest>) {
  try {
    const { language, matchId } = action.payload
    const predictions: MarketPredictionResponse = yield call(getMarketPredictions, matchId, { language })
    yield put(dashboardActions.loadMarketPredictionsSucceeded(predictions))
  } catch (error) {
    yield put(dashboardActions.loadMarketPredictionsFailed(errorMessage(error)))
  }
}

function* loadMatchInsight(action: PayloadAction<DashboardMatchRequest>) {
  try {
    const { language, matchId } = action.payload
    const insight: MatchInsightResponse = yield call(getMatchInsight, matchId, { language })
    yield put(dashboardActions.loadMatchInsightSucceeded(insight))
  } catch (error) {
    yield put(dashboardActions.loadMatchInsightFailed(errorMessage(error)))
  }
}

function* loadRecommendedChatQuestions(action: PayloadAction<DashboardMatchRequest>) {
  try {
    const { language, matchId } = action.payload
    const questions: PredictionChatRecommendedQuestionsResponse = yield call(
      getRecommendedChatQuestions,
      matchId,
      { language },
    )
    yield put(dashboardActions.loadRecommendedChatQuestionsSucceeded(questions))
  } catch (error) {
    yield put(dashboardActions.loadRecommendedChatQuestionsFailed(errorMessage(error)))
  }
}

function* fetchLiveSnapshot({ language, matchId }: DashboardMatchRequest) {
  try {
    const snapshot: LiveMatchSnapshot = yield call(getLiveMatchSnapshot, matchId, true)
    yield put(dashboardActions.liveSnapshotReceived({ language, snapshot }))
  } catch (error) {
    yield put(dashboardActions.liveSnapshotFailed(errorMessage(error)))
  }
}

function* pollLiveSnapshots(action: PayloadAction<DashboardMatchRequest>) {
  const intervalMs = Number.isFinite(env.livePollingIntervalMs)
    ? Math.max(env.livePollingIntervalMs, 3000)
    : 10000

  while (true) {
    const { stoppedBeforeFetch }: { stoppedBeforeFetch?: unknown } = yield race({
      fetched: call(fetchLiveSnapshot, action.payload),
      stoppedBeforeFetch: take(dashboardActions.stopLivePolling.type),
    })

    if (stoppedBeforeFetch) {
      return
    }

    const { stoppedDuringDelay }: { stoppedDuringDelay?: unknown } = yield race({
      delayed: delay(intervalMs),
      stoppedDuringDelay: take(dashboardActions.stopLivePolling.type),
    })

    if (stoppedDuringDelay) {
      return
    }
  }
}

export function* dashboardSaga() {
  yield all([
    takeLatest(dashboardActions.loadMatchRequested.type, loadMatch),
    takeLatest(dashboardActions.loadMatchInsightRequested.type, loadMatchInsight),
    takeLatest(dashboardActions.loadMarketPredictionsRequested.type, loadMarketPredictions),
    takeLatest(
      dashboardActions.loadRecommendedChatQuestionsRequested.type,
      loadRecommendedChatQuestions,
    ),
    takeLatest(dashboardActions.startLivePolling.type, pollLiveSnapshots),
  ])
}
