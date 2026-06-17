import { Crosshair, Flame, Goal, Scale, ShieldAlert } from 'lucide-react'

import type { LanguageCode } from '@/i18n/languages'
import type { MarketFamily, MarketPrediction } from '@/store/features/dashboard/apiTypes'

import type { PickCard, Tone } from './types'

const asianHandicapIcon = '/images/market-asian-handicap-icon.png'
const overUnderIcon = '/images/market-over-under-icon.png'
const oneXTwoIcon = '/images/market-one-x-two-icon.png'
const cardsIcon = '/images/market-cards-icon.png'
const cornersIcon = '/images/market-corners-icon.png'

const marketIconImageByFamily: Record<MarketFamily, string> = {
  asian_handicap: asianHandicapIcon,
  cards: cardsIcon,
  corners: cornersIcon,
  one_x_two: oneXTwoIcon,
  over_under: overUnderIcon,
}

const marketToneByFamily: Record<MarketFamily, Tone> = {
  asian_handicap: 'green',
  cards: 'orange',
  corners: 'green',
  one_x_two: 'purple',
  over_under: 'blue',
}

const marketIconByFamily: Record<MarketFamily, typeof Scale> = {
  asian_handicap: Scale,
  cards: ShieldAlert,
  corners: Crosshair,
  one_x_two: Flame,
  over_under: Goal,
}

const confidenceScoreFallback: Record<NonNullable<MarketPrediction['confidence']>, number> = {
  high: 78,
  low: 38,
  medium: 62,
}

function opponentForWinner(winner: string, homeTeam: string, awayTeam: string) {
  return winner === awayTeam ? homeTeam : awayTeam
}

function clampConfidenceScore(value: number | undefined, confidence: MarketPrediction['confidence']) {
  if (value === undefined || Number.isNaN(value)) {
    return confidenceScoreFallback[confidence]
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

export function buildFallbackMarketPicks(
  homeTeam: string,
  awayTeam: string,
  winner: string,
  language: LanguageCode,
  confidence: Record<NonNullable<MarketPrediction['confidence']>, string>,
  risk: Record<NonNullable<MarketPrediction['risk']>, string>,
): PickCard[] {
  const opponent = opponentForWinner(winner, homeTeam, awayTeam)

  if (language === 'en') {
    return [
      {
        id: 'asian-handicap',
        title: `Asian Handicap: ${winner} -0.25`,
        selection: `${winner} -0.25 covers`,
        reasoning: `${winner} is the temporary lean over ${opponent}, but the handicap stays conservative while live data and confirmed lineups are incomplete.`,
        rank: '#1',
        tone: 'green',
        icon: Scale,
        iconImage: asianHandicapIcon,
        confidence: confidence.medium,
        confidenceScore: 60,
        confidenceRationale: 'The lean is usable, but missing live and lineup signals keep confidence moderate.',
        risk: risk.medium,
      },
      {
        id: 'over-under',
        title: 'Over/Under: Over 2.5 goals',
        selection: 'Over 2.5 goals',
        reasoning: `${homeTeam} vs ${awayTeam} needs more match rhythm, shots and lineup data before the confidence can move higher.`,
        rank: '#2',
        tone: 'blue',
        icon: Goal,
        iconImage: overUnderIcon,
        confidence: confidence.medium,
        confidenceScore: 56,
        confidenceRationale: 'Goal-total confidence stays limited until shot volume and match rhythm are available.',
        risk: risk.high,
      },
      {
        id: 'one-x-two',
        title: '1X2: Match result',
        selection: `${winner} win`,
        reasoning: `The current read leans toward ${winner}; this temporary view only uses this match data and does not reuse another fixture.`,
        rank: '#3',
        tone: 'purple',
        icon: Flame,
        iconImage: oneXTwoIcon,
        confidence: confidence.medium,
        confidenceScore: 62,
        confidenceRationale: 'The fixture read supports the pick, but the data set is still pre-match heavy.',
        risk: risk.low,
      },
      {
        id: 'cards',
        title: 'Cards: Over 4.5 cards',
        selection: 'Over 4.5 cards',
        reasoning: 'The cards market needs referee data, duel intensity and match state before the pick can be more certain.',
        rank: '#4',
        tone: 'orange',
        icon: ShieldAlert,
        iconImage: cardsIcon,
        confidence: confidence.low,
        confidenceScore: 38,
        confidenceRationale: 'Card confidence is low without referee and duel-intensity data.',
        risk: risk.medium,
      },
      {
        id: 'corners',
        title: 'Corners: Over 9.5 corners',
        selection: 'Over 9.5 corners',
        reasoning: `The corners market becomes clearer when wide attacks, crosses and blocked shots from ${homeTeam} or ${awayTeam} are available.`,
        rank: '#5',
        tone: 'green',
        icon: Crosshair,
        iconImage: cornersIcon,
        confidence: confidence.medium,
        confidenceScore: 54,
        confidenceRationale: 'Corner confidence needs wide-attack and blocked-shot data before it can rise.',
        risk: risk.medium,
      },
    ]
  }

  return [
    {
      id: 'asian-handicap',
      title: `Kèo Châu Á: ${winner} -0.25`,
      selection: `${winner} -0.25 thắng kèo`,
      reasoning: `${winner} đang là cửa nghiêng tạm thời so với ${opponent}, nhưng handicap được giữ thấp vì còn thiếu dữ liệu live và đội hình mới nhất.`,
      rank: '#1',
      tone: 'green',
      icon: Scale,
      iconImage: asianHandicapIcon,
      confidence: confidence.medium,
      confidenceScore: 60,
      confidenceRationale: 'Cửa nghiêng có thể dùng được, nhưng thiếu tín hiệu live và đội hình nên confidence chỉ ở mức vừa.',
      risk: risk.medium,
    },
    {
      id: 'over-under',
      title: 'Tài/Xỉu: Over 2.5 bàn',
      selection: 'Over 2.5 bàn',
      reasoning: `Tổng bàn của ${homeTeam} vs ${awayTeam} cần thêm nhịp trận, cú sút và đội hình ra sân trước khi nâng độ tin cậy.`,
      rank: '#2',
      tone: 'blue',
      icon: Goal,
      iconImage: overUnderIcon,
      confidence: confidence.medium,
      confidenceScore: 56,
      confidenceRationale: 'Confidence của tổng bàn còn giới hạn vì chưa có nhịp trận và số cú sút thực tế.',
      risk: risk.high,
    },
    {
      id: 'one-x-two',
      title: '1X2: Kết quả trận đấu',
      selection: `${winner} thắng`,
      reasoning: `Nhận định hiện nghiêng về ${winner}; phần tạm này chỉ dùng dữ liệu trận hiện tại và không dùng lại luận điểm của cặp đấu mẫu.`,
      rank: '#3',
      tone: 'purple',
      icon: Flame,
      iconImage: oneXTwoIcon,
      confidence: confidence.medium,
      confidenceScore: 62,
      confidenceRationale: 'Bối cảnh trận ủng hộ lựa chọn này, nhưng dữ liệu vẫn chủ yếu là trước trận.',
      risk: risk.low,
    },
    {
      id: 'cards',
      title: 'Thẻ phạt: Over 4.5 thẻ',
      selection: 'Over 4.5 thẻ',
      reasoning: 'Kèo thẻ cần thêm dữ liệu trọng tài, cường độ tranh chấp và trạng thái trận trước khi có lựa chọn chắc hơn.',
      rank: '#4',
      tone: 'orange',
      icon: ShieldAlert,
      iconImage: cardsIcon,
      confidence: confidence.low,
      confidenceScore: 38,
      confidenceRationale: 'Confidence kèo thẻ thấp vì chưa có dữ liệu trọng tài và cường độ tranh chấp.',
      risk: risk.medium,
    },
    {
      id: 'corners',
      title: 'Corner: Over 9.5 góc',
      selection: 'Over 9.5 góc',
      reasoning: `Kèo corner sẽ rõ hơn khi có hướng tấn công, số pha tạt bóng và cú sút bị chặn của ${homeTeam} hoặc ${awayTeam}.`,
      rank: '#5',
      tone: 'green',
      icon: Crosshair,
      iconImage: cornersIcon,
      confidence: confidence.medium,
      confidenceScore: 54,
      confidenceRationale: 'Confidence kèo corner cần thêm dữ liệu tấn công biên và cú sút bị chặn.',
      risk: risk.medium,
    },
  ]
}

export function mapMarketPredictionsToPickCards(
  predictions: MarketPrediction[],
  confidence: Record<NonNullable<MarketPrediction['confidence']>, string>,
  risk: Record<NonNullable<MarketPrediction['risk']>, string>,
): PickCard[] {
  return predictions.map((prediction, index) => ({
    id: prediction.id,
    title: prediction.name,
    selection: prediction.selection,
    reasoning: prediction.reasoning,
    rank: `#${index + 1}`,
    tone: marketToneByFamily[prediction.family],
    icon: marketIconByFamily[prediction.family],
    iconImage: marketIconImageByFamily[prediction.family],
    confidence: confidence[prediction.confidence],
    confidenceScore: clampConfidenceScore(prediction.confidence_score, prediction.confidence),
    confidenceRationale: prediction.confidence_rationale,
    risk: risk[prediction.risk],
  }))
}
