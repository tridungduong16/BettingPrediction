import type { PayloadAction } from '@reduxjs/toolkit'
import { all, call, delay, put, race, select, take, takeLatest } from 'redux-saga/effects'

import { getLiveMatchSnapshot } from '@/api/liveEvents'
import {
  getMarketPredictions,
  getMatchInsight,
  getRecommendedChatQuestions,
} from '@/api/predictions'
import { getWorldCupMatch } from '@/api/worldcup'
import { env } from '@/config/env'
import type { RootState } from '@/store'
import type {
  LiveMatchPhase,
  LiveMatchSnapshot,
  MarketPredictionResponse,
  MatchInsightResponse,
  PredictionChatRecommendedQuestionsResponse,
  WorldCupMatch,
} from '@/store/features/dashboard/apiTypes'
import { dashboardActions, type DashboardMatchRequest } from '@/store/features/dashboard/slice'

const defaultLivePollingIntervalMs = 5 * 60 * 1000
const liveLogPrefix = '[live-feed]'
const livePredictionPhases = new Set<LiveMatchPhase>([
  'extra_time',
  'first_half',
  'halftime',
  'penalties',
  'second_half',
  'suspended',
])
const lastLivePredictionFingerprintByMatch = new Map<string, string>()

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

function rawStatisticsFingerprint(snapshot: LiveMatchSnapshot) {
  try {
    return JSON.stringify(snapshot.raw?.statistics ?? null)
  } catch {
    return 'unavailable'
  }
}

function livePredictionFingerprint(snapshot?: LiveMatchSnapshot | null) {
  if (!snapshot) {
    return undefined
  }

  const latestEvent = snapshot.events.reduce<LiveMatchSnapshot['events'][number] | undefined>(
    (current, event) => {
      if (!current || event.sequence >= current.sequence) {
        return event
      }

      return current
    },
    undefined,
  )

  return [
    snapshot.provider_fixture_id ?? '',
    snapshot.provider_status,
    snapshot.clock.phase,
    snapshot.clock.elapsed ?? '',
    snapshot.clock.extra ?? '',
    snapshot.score.home ?? '',
    snapshot.score.away ?? '',
    snapshot.events.length,
    latestEvent?.id ?? '',
    latestEvent?.sequence ?? '',
    latestEvent?.type ?? '',
    latestEvent?.minute ?? '',
    rawStatisticsFingerprint(snapshot),
  ].join('|')
}

function canRefreshLivePredictions(snapshot: LiveMatchSnapshot) {
  return snapshot.provider_status === 'ready' && livePredictionPhases.has(snapshot.clock.phase)
}

function selectPredictionRefreshState(state: RootState) {
  return {
    insightPredictionStatus: state.dashboard.insightPredictionStatus,
    marketPredictionStatus: state.dashboard.marketPredictionStatus,
    matchInsight: state.dashboard.matchInsight,
    marketPredictions: state.dashboard.marketPredictions,
  }
}

function* refreshLivePredictionsIfChanged(
  request: DashboardMatchRequest,
  snapshot: LiveMatchSnapshot,
) {
  if (!canRefreshLivePredictions(snapshot)) {
    return
  }

  const fingerprint = livePredictionFingerprint(snapshot)
  if (!fingerprint) {
    return
  }

  const predictionState: ReturnType<typeof selectPredictionRefreshState> = yield select(
    selectPredictionRefreshState,
  )

  if (
    predictionState.insightPredictionStatus === 'loading' ||
    predictionState.marketPredictionStatus === 'loading'
  ) {
    logLiveDebug('prediction refresh deferred while LLM request is running', {
      matchId: request.matchId,
    })
    return
  }

  const lastFingerprint = lastLivePredictionFingerprintByMatch.get(request.matchId)
  const latestResponseFingerprints = [
    livePredictionFingerprint(predictionState.matchInsight?.live_snapshot),
    livePredictionFingerprint(predictionState.marketPredictions?.live_snapshot),
  ]

  if (lastFingerprint === fingerprint || latestResponseFingerprints.includes(fingerprint)) {
    lastLivePredictionFingerprintByMatch.set(request.matchId, fingerprint)
    return
  }

  lastLivePredictionFingerprintByMatch.set(request.matchId, fingerprint)

  const refreshRequest: DashboardMatchRequest = {
    background: true,
    language: request.language,
    matchId: request.matchId,
    predictionMode: 'live',
    providerFixtureId: snapshot.provider_fixture_id ?? request.providerFixtureId ?? undefined,
  }

  logLiveDebug('prediction refresh requested from live snapshot', {
    events: snapshot.events.length,
    matchId: request.matchId,
    phase: snapshot.clock.phase,
    providerFixtureId: snapshot.provider_fixture_id,
    score: snapshot.score,
  })

  yield put(dashboardActions.loadMatchInsightRequested(refreshRequest))
  yield put(dashboardActions.loadMarketPredictionsRequested(refreshRequest))
}

function* loadMatch(action: PayloadAction<DashboardMatchRequest>) {
  try {
    const { language, matchId } = action.payload
    lastLivePredictionFingerprintByMatch.delete(matchId)
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
    const { forceRefresh, language, matchId, predictionMode, providerFixtureId } = action.payload
    const predictions: MarketPredictionResponse = yield call(getMarketPredictions, matchId, {
      forceRefresh,
      language,
      predictionMode,
      providerFixtureId: providerFixtureId ?? undefined,
    })
    yield put(dashboardActions.loadMarketPredictionsSucceeded(predictions))
  } catch (error) {
    if (action.payload.background) {
      logLiveDebug('background market prediction refresh failed', {
        error: errorMessage(error),
        matchId: action.payload.matchId,
      })
      lastLivePredictionFingerprintByMatch.delete(action.payload.matchId)
    }

    yield put(dashboardActions.loadMarketPredictionsFailed(errorMessage(error)))
  }
}

function* loadMatchInsight(action: PayloadAction<DashboardMatchRequest>) {
  try {
    const { forceRefresh, language, matchId, predictionMode, providerFixtureId } = action.payload
    const insight: MatchInsightResponse = yield call(getMatchInsight, matchId, {
      forceRefresh,
      language,
      predictionMode,
      providerFixtureId: providerFixtureId ?? undefined,
    })
    yield put(dashboardActions.loadMatchInsightSucceeded(insight))
  } catch (error) {
    if (action.payload.background) {
      logLiveDebug('background insight refresh failed', {
        error: errorMessage(error),
        matchId: action.payload.matchId,
      })
      lastLivePredictionFingerprintByMatch.delete(action.payload.matchId)
    }

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

function* fetchLiveSnapshot(request: DashboardMatchRequest) {
  const { language, matchId } = request

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
    yield call(refreshLivePredictionsIfChanged, request, snapshot)
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
