import { request } from '@/api/http'
import type {
  MatchStatus,
  WorldCupDataset,
  WorldCupMatch,
  WorldCupSimulationResponse,
} from '@/store/features/dashboard/apiTypes'

interface WorldCupMatchesParams extends Record<string, boolean | number | string | undefined> {
  date?: string
  force_refresh?: boolean
  group?: string
  round?: string
  source?: string
  status?: MatchStatus
  team?: string
  year?: number
}

interface WorldCupRequestOptions {
  signal?: AbortSignal
}

interface WorldCupSimulationParams extends Record<string, boolean | number | string | undefined> {
  force_refresh?: boolean
  pairing_limit?: number
  scenario_limit?: number
  source?: string
  target_round?: string
  year?: number
}

export function getWorldCupMatch(matchId: string) {
  return request<WorldCupMatch>(`/api/worldcup/matches/${encodeURIComponent(matchId)}`)
}

export function getWorldCupMatches(
  params: WorldCupMatchesParams = {},
  options: WorldCupRequestOptions = {},
) {
  return request<WorldCupDataset>('/api/worldcup/matches', {
    query: params,
    signal: options.signal,
  })
}

export function getWorldCupSimulation(
  params: WorldCupSimulationParams = {},
  options: WorldCupRequestOptions = {},
) {
  return request<WorldCupSimulationResponse>('/api/worldcup/simulation', {
    query: params,
    signal: options.signal,
  })
}
