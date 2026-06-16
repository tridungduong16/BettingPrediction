import { all } from 'redux-saga/effects'

import { dashboardSaga } from '@/store/features/dashboard/saga'

export function* rootSaga() {
  yield all([dashboardSaga()])
}
