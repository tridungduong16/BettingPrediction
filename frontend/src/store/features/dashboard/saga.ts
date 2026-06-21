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

const defaultLivePollingIntervalMs = 5 * 60 * 1000
const liveLogPrefix = '[live-feed]'

function logLiveDebug(message: string, details?: Record<string, unknown>) {
  if (!env.liveDebugLogs) {
    return
  }

  if (details) {
    console.info(liveLogPrefix, message, details)
    return
  }

  console.info(liveLogPrefix, message)
}

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
    const { language, matchId, predictionMode, providerFixtureId } = action.payload
    const predictions: MarketPredictionResponse = yield call(getMarketPredictions, matchId, {
      language,
      predictionMode,
      providerFixtureId: providerFixtureId ?? undefined,
    })
    yield put(dashboardActions.loadMarketPredictionsSucceeded(predictions))
  } catch (error) {
    yield put(dashboardActions.loadMarketPredictionsFailed(errorMessage(error)))
  }
}

function* loadMatchInsight(action: PayloadAction<DashboardMatchRequest>) {
  try {
    const { language, matchId, predictionMode, providerFixtureId } = action.payload
    const insight: MatchInsightResponse = yield call(getMatchInsight, matchId, {
      language,
      predictionMode,
      providerFixtureId: providerFixtureId ?? undefined,
    })
    yield put(dashboardActions.loadMatchInsightSucceeded(insight))
  } catch (error) {
    yield put(dashboardActions.loadMatchInsightFailed(errorMessage(error)))
  }
}

function* loadRecommendedChatQuestions(action: PayloadAction<DashboardMatchRequest>) {
  try {
    const { language, matchId, predictionMode, providerFixtureId } = action.payload
    const questions: PredictionChatRecommendedQuestionsResponse = yield call(
      getRecommendedChatQuestions,
      matchId,
      {
        language,
        predictionMode,
        providerFixtureId: providerFixtureId ?? undefined,
      },
    )
    yield put(dashboardActions.loadRecommendedChatQuestionsSucceeded(questions))
  } catch (error) {
    yield put(dashboardActions.loadRecommendedChatQuestionsFailed(errorMessage(error)))
  }
}

function* fetchLiveSnapshot({ language, matchId }: DashboardMatchRequest) {
  try {
    logLiveDebug('fetch snapshot started', {
      forceRefresh: true,
      language,
      matchId,
    })
    const snapshot: LiveMatchSnapshot = yield call(getLiveMatchSnapshot, matchId, true)
    logLiveDebug('fetch snapshot received', {
      clock: snapshot.clock,
      error: snapshot.error,
      events: snapshot.events.length,
      fetchedAt: snapshot.fetched_at,
      matchId: snapshot.match_id,
      observedAt: snapshot.observed_at,
      providerFixtureId: snapshot.provider_fixture_id,
      providerStatus: snapshot.provider_status,
      score: snapshot.score,
    })
    yield put(dashboardActions.liveSnapshotReceived({ language, snapshot }))
  } catch (error) {
    const message = errorMessage(error)
    logLiveDebug('fetch snapshot failed', {
      error: message,
      matchId,
    })
    yield put(dashboardActions.liveSnapshotFailed(message))
  }
}

function* pollLiveSnapshots(action: PayloadAction<DashboardMatchRequest>) {
  const intervalMs = Number.isFinite(env.livePollingIntervalMs)
    ? Math.max(env.livePollingIntervalMs, 3000)
    : defaultLivePollingIntervalMs
  logLiveDebug('polling started', {
    intervalMs,
    matchId: action.payload.matchId,
  })

  while (true) {
    const { stoppedBeforeFetch }: { stoppedBeforeFetch?: unknown } = yield race({
      fetched: call(fetchLiveSnapshot, action.payload),
      stoppedBeforeFetch: take(dashboardActions.stopLivePolling.type),
    })

    if (stoppedBeforeFetch) {
      logLiveDebug('polling stopped before fetch', {
        matchId: action.payload.matchId,
      })
      return
    }

    const { stoppedDuringDelay }: { stoppedDuringDelay?: unknown } = yield race({
      delayed: delay(intervalMs),
      stoppedDuringDelay: take(dashboardActions.stopLivePolling.type),
    })

    if (stoppedDuringDelay) {
      logLiveDebug('polling stopped during delay', {
        matchId: action.payload.matchId,
      })
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
