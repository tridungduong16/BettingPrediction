import { Navigate, useLocation } from 'react-router-dom'

import { env } from '@/config/env'
import { matchDetailPath } from '@/constants/routes'

export function LegacyMatchDetailRedirect() {
  const location = useLocation()
  const matchId = new URLSearchParams(location.search).get('matchId') ?? env.defaultMatchId

  return <Navigate to={matchDetailPath(matchId)} replace />
}
