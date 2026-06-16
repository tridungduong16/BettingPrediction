import { request } from '@/api/http'
import type {
  MatchStatus,
  WorldCupDataset,
  WorldCupMatch,
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
