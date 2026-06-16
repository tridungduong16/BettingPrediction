import { request } from '@/api/http'
import { env } from '@/config/env'
import type { LiveMatchEvent, LiveMatchSnapshot } from '@/store/features/dashboard/apiTypes'

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
