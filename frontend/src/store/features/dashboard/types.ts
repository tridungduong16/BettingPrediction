export type TrendDirection = 'up' | 'down' | 'flat'

export interface Team {
  name: string
  shortName: string
  countryCode: string
  flagUrl: string
  form: string[]
}

export interface MatchInfo {
  id: string
  competition: string
  round: string
  kickoff: string
  stadium: string
  city: string
  signals: MatchSignal[]
  homeTeam: Team
  awayTeam: Team
}

export interface MatchSignal {
  label: string
  value: string
  tone: 'positive' | 'warning' | 'info'
}

export interface ProbabilityOutcome {
  id: string
  label: string
  value: number
  trend: number
  direction: TrendDirection
}

export interface PredictionInfo {
  winner: string
  confidence: number
  confidenceLevel?: 'high' | 'low' | 'medium'
  confidenceRationale?: string
  status: string
  lastUpdated: string
  summary: string
  outcomes: ProbabilityOutcome[]
}

export interface ReasoningPoint {
  id: string
  title: string
  detail: string
  impact: 'high' | 'medium' | 'low'
}

export interface ReasoningInfo {
  headline: string
  description: string
  points: ReasoningPoint[]
}

export interface EdgeSignal {
  id: string
  label: string
  detail: string
  delta: string
  tone: 'blue' | 'gray' | 'green' | 'orange' | 'purple' | 'red'
}

export interface MarketInfo {
  id: string
  name: string
  probability: number
  edge: number
  risk: 'Low' | 'Medium' | 'High'
  signal: string
  detail: string
}

export interface MovementPoint {
  label: string
  home: number
  draw: number
  away: number
}

export type FeedItemType =
  | 'card'
  | 'goal'
  | 'lineup'
  | 'market'
  | 'model'
  | 'news'
  | 'substitution'
  | 'var'

export interface FeedItem {
  id: string
  time: string
  title: string
  detail: string
  type: FeedItemType
}

export interface ChatMessage {
  id: string
  sender: 'ai' | 'user'
  message: string
}

export interface DashboardData {
  match: MatchInfo
  prediction: PredictionInfo
  reasoning: ReasoningInfo
  edgeSignals: EdgeSignal[]
  netEdge: string
  markets: MarketInfo[]
  movement: MovementPoint[]
  feed: FeedItem[]
  chat: ChatMessage[]
  prompts: string[]
}
