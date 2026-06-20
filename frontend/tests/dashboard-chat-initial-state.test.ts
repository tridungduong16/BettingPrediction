import assert from 'node:assert/strict'

import { mapWorldCupMatchToDashboardData } from '../src/store/features/dashboard/mappers'
import type { WorldCupMatch } from '../src/store/features/dashboard/apiTypes'

const match: WorldCupMatch = {
  id: '2026-001-netherlands-vs-sweden',
  source_index: 0,
  competition: 'World Cup 2026',
  round: 'Group Stage',
  date: '2026-06-20',
  time: '20:00 UTC',
  kickoff_utc: '2026-06-20T20:00:00Z',
  team1: 'Netherlands',
  team2: 'Sweden',
  status: 'scheduled',
  goals1: [],
  goals2: [],
  raw: {},
}

const dashboardData = mapWorldCupMatchToDashboardData(match, 'vi')

assert.deepEqual(dashboardData.chat, [])
assert.deepEqual(dashboardData.prompts, [
  'Tìm thông tin mới nhất về trận đấu giữa Hà Lan và Thụy Điển',
  'Phân tích tổng quan trận đấu',
  'Tìm kèo có xác suất thắng cao',
])
