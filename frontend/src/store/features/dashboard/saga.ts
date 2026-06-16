import type { PayloadAction } from '@reduxjs/toolkit'
import { all, call, delay, put, race, take, takeLatest } from 'redux-saga/effects'

import { getLiveMatchSnapshot } from '@/api/liveEvents'
import { getMarketPredictions } from '@/api/predictions'
import { getWorldCupMatch } from '@/api/worldcup'
import { env } from '@/config/env'
import type {
  LiveMatchSnapshot,
  MarketPredictionResponse,
  WorldCupMatch,
} from '@/store/features/dashboard/apiTypes'
import { dashboardActions } from '@/store/features/dashboard/slice'

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Yêu cầu dashboard gặp lỗi không xác định.'
}

function* loadMatch(action: PayloadAction<string>) {
  try {
    const match: WorldCupMatch = yield call(getWorldCupMatch, action.payload)
    yield put(dashboardActions.loadMatchSucceeded(match))
    yield put(dashboardActions.loadMarketPredictionsRequested(action.payload))
  } catch (error) {
    yield put(dashboardActions.loadMatchFailed(errorMessage(error)))
  }
}

function* loadMarketPredictions(action: PayloadAction<string>) {
  try {
    const predictions: MarketPredictionResponse = yield call(getMarketPredictions, action.payload)
    yield put(dashboardActions.loadMarketPredictionsSucceeded(predictions))
  } catch (error) {
    yield put(dashboardActions.loadMarketPredictionsFailed(errorMessage(error)))
  }
}

function* fetchLiveSnapshot(matchId: string) {
  try {
    const snapshot: LiveMatchSnapshot = yield call(getLiveMatchSnapshot, matchId, true)
    yield put(dashboardActions.liveSnapshotReceived(snapshot))
  } catch (error) {
    yield put(dashboardActions.liveSnapshotFailed(errorMessage(error)))
  }
}

function* pollLiveSnapshots(action: PayloadAction<string>) {
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
    takeLatest(dashboardActions.loadMarketPredictionsRequested.type, loadMarketPredictions),
    takeLatest(dashboardActions.startLivePolling.type, pollLiveSnapshots),
  ])
}
