export const ROUTES = {
  HOME: '/',
  MATCH_DETAIL: '/tran-dau/:matchId',
  SIMULATION: '/simulation',
} as const

export function matchDetailPath(matchId: string) {
  return `/tran-dau/${encodeURIComponent(matchId)}`
}
