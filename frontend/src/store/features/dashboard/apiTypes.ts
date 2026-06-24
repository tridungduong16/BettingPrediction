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

export interface WorldCupSourceInfo {
  name: string
  year: number
  source_name: string
  source_url: string
  source_text_url: string
  fetched_at: string
  cache_hit: boolean
  stale_cache: boolean
  match_count: number
}

export interface WorldCupDataset {
  source: WorldCupSourceInfo
  matches: WorldCupMatch[]
}

export type SimulationTargetRound =
  | 'Final'
  | 'Match for third place'
  | 'Quarter-final'
  | 'Round of 16'
  | 'Round of 32'
  | 'Semi-final'

export type SimulationSlotSource = 'actual' | 'match_reference' | 'seed' | 'unresolved'
export type ScenarioOutcome = 'draw' | 'team1' | 'team2'

export interface WorldCupTeamStanding {
  group: string
  position: number
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  tied_on_primary_metrics: boolean
}

export interface WorldCupScenarioOutcome {
  match_id: string
  team1: string
  team2: string
  outcome: ScenarioOutcome
  label: string
}

export interface WorldCupGroupQualificationScenario {
  id: string
  title: string
  first: string
  second: string
  third: string
  advancing_teams: string[]
  outcomes: WorldCupScenarioOutcome[]
  outcome_count: number
  outcome_share: number
  tie_breaker_required: boolean
  notes: string[]
}

export interface WorldCupGroupSimulation {
  group: string
  standings: WorldCupTeamStanding[]
  remaining_matches: WorldCupMatch[]
  possible_winners: string[]
  possible_runners_up: string[]
  possible_third_place: string[]
  scenarios: WorldCupGroupQualificationScenario[]
  total_outcome_paths: number
  scenario_count: number
  truncated: boolean
}

export interface WorldCupSimulationSlot {
  label: string
  resolved_team?: string | null
  candidates: string[]
  source: SimulationSlotSource
}

export interface WorldCupSimulatedFixture {
  match_id: string
  match_number: number
  round: SimulationTargetRound
  date: string
  time?: string | null
  team1: WorldCupSimulationSlot
  team2: WorldCupSimulationSlot
  possible_pairings: [string, string][]
  possible_pairing_count: number
  pairings_truncated: boolean
}

export interface WorldCupSimulationResponse {
  source: WorldCupSourceInfo
  generated_at: string
  target_round: SimulationTargetRound
  groups: WorldCupGroupSimulation[]
  third_place_candidates: string[]
  bracket: WorldCupSimulatedFixture[]
  data_quality_notes: string[]
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

export interface LiveLineupCoach {
  id?: string | null
  name?: string | null
  photo?: string | null
}

export interface LiveLineupPlayer {
  id?: string | null
  name?: string | null
  number?: number | null
  position?: string | null
  grid?: string | null
  raw: Record<string, unknown>
}

export interface LiveTeamLineup {
  team: LiveTeam
  formation?: string | null
  coach?: LiveLineupCoach | null
  start_xi: LiveLineupPlayer[]
  substitutes: LiveLineupPlayer[]
  raw: Record<string, unknown>
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

export interface LiveMatchLineups {
  match_id: string
  provider: 'api_football'
  provider_fixture_id?: string | null
  provider_status: LiveProviderStatus
  observed_at: string
  fetched_at?: string | null
  lineups: LiveTeamLineup[]
  error?: string | null
  raw: Record<string, unknown>
}

export type MarketFamily = 'asian_handicap' | 'cards' | 'corners' | 'one_x_two' | 'over_under'
export type MarketRisk = 'high' | 'low' | 'medium'
export type PredictionConfidence = 'high' | 'low' | 'medium'
export type PredictionMode = 'live' | 'post_match_evaluation' | 'pre_match'
export type ResponseLanguage = 'en' | 'vi'
export type TrendDirection = 'down' | 'flat' | 'up'
export type OutcomeId = 'away' | 'draw' | 'home'
export type ReasoningImpact = 'high' | 'low' | 'medium'
export type EdgeTone = 'blue' | 'gray' | 'green' | 'orange' | 'purple' | 'red'

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
  confidence_score?: number
  confidence_rationale?: string
  risk: MarketRisk
  reasoning: string
  drivers: string[]
}

export interface MarketPredictionResponse {
  match_id: string
  generated_at: string
  language: ResponseLanguage
  model_name?: string | null
  prediction_mode: PredictionMode
  match: WorldCupMatch
  live_snapshot?: LiveMatchSnapshot | null
  prediction_context?: Record<string, unknown> | null
  markets: MarketPredictionCandidate[]
  summary: string
  predictions: MarketPrediction[]
  data_quality_notes: string[]
}

export interface MatchInsightOutcome {
  id: OutcomeId
  label: string
  value: number
  trend: number
  direction: TrendDirection
}

export interface MatchInsightReasoningPoint {
  id: string
  title: string
  detail: string
  impact: ReasoningImpact
}

export interface MatchInsightReasoning {
  headline: string
  description: string
  points: MatchInsightReasoningPoint[]
}

export interface MatchInsightEdgeSignal {
  id: string
  label: string
  detail: string
  delta: string
  tone: EdgeTone
}

export interface MatchInsight {
  winner: string
  confidence: number
  confidence_level?: PredictionConfidence
  confidence_rationale?: string
  status: string
  summary: string
  outcomes: MatchInsightOutcome[]
  reasoning: MatchInsightReasoning
  edge_signals: MatchInsightEdgeSignal[]
  net_edge: string
  data_quality_notes: string[]
}

export interface MatchInsightResponse {
  match_id: string
  generated_at: string
  language: ResponseLanguage
  model_name?: string | null
  prediction_mode: PredictionMode
  match: WorldCupMatch
  live_snapshot?: LiveMatchSnapshot | null
  prediction_context?: Record<string, unknown> | null
  insight: MatchInsight
}

export interface PredictionChatRequest {
  message: string
  prediction_context?: Record<string, unknown> | null
  thread_id?: string | null
}

export interface PredictionChatResponse {
  answer: string
  generated_at: string
  language: ResponseLanguage
  live_snapshot?: LiveMatchSnapshot | null
  match: WorldCupMatch
  match_id: string
  message: string
  model_name?: string | null
  prediction_context?: Record<string, unknown> | null
  prediction_mode: PredictionMode
  thread_id?: string | null
}

export interface PredictionChatRecommendedQuestionsResponse {
  generated_at: string
  language: ResponseLanguage
  live_snapshot?: LiveMatchSnapshot | null
  match: WorldCupMatch
  match_id: string
  model_name?: string | null
  prediction_context?: Record<string, unknown> | null
  prediction_mode: PredictionMode
  questions: string[]
}

export interface PredictionChatStreamEvent {
  content: unknown
  metadata?: Record<string, unknown> | null
  type: 'done' | 'error' | 'metadata' | 'text_delta' | 'text_full' | string
}
