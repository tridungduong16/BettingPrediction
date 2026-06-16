import { combineReducers } from '@reduxjs/toolkit'

import { dashboardReducer } from '@/store/features/dashboard/slice'

export const rootReducer = combineReducers({
  dashboard: dashboardReducer,
})
