import type { LucideIcon } from 'lucide-react'

export type Tone = 'green' | 'blue' | 'red' | 'orange' | 'purple' | 'gray'

export interface PickCard {
  confidence?: string
  confidenceRationale?: string
  confidenceScore?: number
  id: string
  icon: LucideIcon
  iconImage?: string
  rank: string
  reasoning: string
  risk?: string
  selection: string
  title: string
  tone: Tone
}
