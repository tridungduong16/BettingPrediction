import { request } from '@/api/http'
import { env } from '@/config/env'
import type {
  LiveMatchEvent,
  LiveMatchLineups,
  LiveMatchSnapshot,
} from '@/store/features/dashboard/apiTypes'

function liveMatchPath(matchId: string, suffix: string) {
  return `/api/live/matches/${encodeURIComponent(matchId)}/${suffix}`
}

export function getLiveMatchSnapshot(matchId: string, forceRefresh = false) {
  return request<LiveMatchSnapshot>(liveMatchPath(matchId, 'snapshot'), {
    query: { force_refresh: forceRefresh },
  })
}

export function getLiveMatchEvents(matchId: string, forceRefresh = false) {
  return request<LiveMatchEvent[]>(liveMatchPath(matchId, 'events'), {
    query: { force_refresh: forceRefresh },
  })
}

export function getLiveMatchLineups(
  matchId: string,
  options: { forceRefresh?: boolean; providerFixtureId?: string | null } = {},
) {
  return request<LiveMatchLineups>(liveMatchPath(matchId, 'lineups'), {
    query: {
      force_refresh: options.forceRefresh ?? false,
      provider_fixture_id: options.providerFixtureId,
    },
  })
}

export function getLiveEventsWebSocketUrl(matchId: string) {
  const baseUrl = env.websocketUrl || env.apiUrl || window.location.origin
  const url = new URL(liveMatchPath(matchId, 'events/ws'), baseUrl)

  if (url.protocol === 'http:') {
    url.protocol = 'ws:'
  } else if (url.protocol === 'https:') {
    url.protocol = 'wss:'
  }

  return url.toString()
}
