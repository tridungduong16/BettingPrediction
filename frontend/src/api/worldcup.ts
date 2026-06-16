import { request } from '@/api/http'
import type { WorldCupMatch } from '@/store/features/dashboard/apiTypes'

export function getWorldCupMatch(matchId: string) {
  return request<WorldCupMatch>(`/api/worldcup/matches/${encodeURIComponent(matchId)}`)
}
