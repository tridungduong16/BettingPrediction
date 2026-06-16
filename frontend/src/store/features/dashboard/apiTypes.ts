export type MatchStatus = 'finished' | 'scheduled'

export interface WorldCupGoal {
  name: string
  minute?: number | string | null
  penalty?: boolean | null
  ownGoal?: boolean | null
}

export interface WorldCupScore {
  ft?: [number, number] | null
  ht?: [number, number] | null
  et?: [number, number] | null
  p?: [number, number] | null
}

export interface WorldCupMatch {
  id: string
  source_index: number
  competition: string
  round: string
  date: string
  time?: string | null
  kickoff_utc?: string | null
  team1: string
  team2: string
  group?: string | null
  ground?: string | null
  city?: string | null
  status: MatchStatus
  score?: WorldCupScore | null
  goals1: WorldCupGoal[]
  goals2: WorldCupGoal[]
  winner?: string | null
  raw: Record<string, unknown>
}

export type LiveProviderStatus = 'not_configured' | 'provider_error' | 'ready' | 'unmapped'
export type LiveMatchPhase =
  | 'extra_time'
  | 'finished'
  | 'first_half'
  | 'halftime'
  | 'penalties'
  | 'scheduled'
  | 'second_half'
  | 'suspended'
  | 'unknown'

export type LiveEventType =
  | 'card'
  | 'corner'
  | 'goal'
  | 'injury'
  | 'other'
  | 'penalty'
  | 'period'
  | 'shot'
  | 'substitution'
  | 'var'

export type TeamSide = 'away' | 'home' | 'unknown'

export interface LiveTeam {
  id?: string | null
  name?: string | null
  side: TeamSide
}

export interface LivePlayer {
  id?: string | null
  name?: string | null
}

export interface LiveMatchScore {
  home?: number | null
  away?: number | null
}

export interface LiveMatchClock {
  phase: LiveMatchPhase
  elapsed?: number | null
  extra?: number | null
  raw_status?: string | null
}

export interface LiveMatchEvent {
  id: string
  match_id: string
  provider: 'api_football'
  provider_fixture_id: string
  provider_event_id?: string | null
  sequence: number
  type: LiveEventType
  detail?: string | null
  comments?: string | null
  minute?: number | null
  stoppage_minute?: number | null
  team: LiveTeam
  player?: LivePlayer | null
  assist_player?: LivePlayer | null
  score?: LiveMatchScore | null
  occurred_at?: string | null
  observed_at: string
  raw: Record<string, unknown>
}

export interface LiveMatchSnapshot {
  match_id: string
  provider: 'api_football'
  provider_fixture_id?: string | null
  provider_status: LiveProviderStatus
  observed_at: string
  fetched_at?: string | null
  score: LiveMatchScore
  clock: LiveMatchClock
  events: LiveMatchEvent[]
  error?: string | null
  raw: Record<string, unknown>
}

export type MarketFamily = 'asian_handicap' | 'cards' | 'corners' | 'one_x_two' | 'over_under'
export type MarketRisk = 'high' | 'low' | 'medium'
export type PredictionConfidence = 'high' | 'low' | 'medium'

export interface MarketPredictionCandidate {
  id: string
  family: MarketFamily
  name: string
  line?: string | null
  description: string
  candidate_outcomes: string[]
}

export interface MarketPrediction {
  id: string
  family: MarketFamily
  name: string
  selection: string
  line?: string | null
  probability: number
  confidence: PredictionConfidence
  risk: MarketRisk
  reasoning: string
  drivers: string[]
  data_gaps: string[]
}

export interface MarketPredictionResponse {
  match_id: string
  generated_at: string
  model_name?: string | null
  match: WorldCupMatch
  live_snapshot?: LiveMatchSnapshot | null
  markets: MarketPredictionCandidate[]
  summary: string
  predictions: MarketPrediction[]
  data_quality_notes: string[]
}
