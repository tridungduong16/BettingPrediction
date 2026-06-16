export const ROUTES = {
  HOME: '/',
  MATCH_DETAIL: '/tran-dau/:matchId',
} as const

export function matchDetailPath(matchId: string) {
  return `/tran-dau/${encodeURIComponent(matchId)}`
}
