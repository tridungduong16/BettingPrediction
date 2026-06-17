import { useEffect, useMemo, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  ChevronDown,
  CloudRain,
  Crosshair,
  Flame,
  Goal,
  Radio,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import clsx from 'clsx'

import { env } from '@/config/env'
import { ROUTES } from '@/constants/routes'
import { getDashboardPlaceholder } from '@/data/placeholder'
import { useAppDispatch, useAppSelector } from '@/hooks/store'
import { useI18n } from '@/i18n/I18nProvider'
import type { LanguageCode } from '@/i18n/languages'
import {
  selectDashboardData,
  selectDashboardError,
  selectDashboardLiveStatus,
  selectDashboardStatus,
  selectLastLiveSnapshotAt,
  selectMarketPredictionError,
  selectMarketPredictionStatus,
  selectMarketPredictions,
} from '@/store/features/dashboard/selectors'
import { dashboardActions } from '@/store/features/dashboard/slice'
import type { EdgeSignal } from '@/store/features/dashboard/types'
import type { MarketFamily, MarketPrediction } from '@/store/features/dashboard/apiTypes'

import styles from './Home.module.scss'

type Tone = 'green' | 'blue' | 'red' | 'orange' | 'purple' | 'gray'

interface ProbabilityBarProps {
  label: string
  value: number
  tone: Tone
}

interface EdgeFactor {
  icon: LucideIcon
  label: string
  detail: string
  delta: string
  tone: Tone
}

interface PickCard {
  confidence?: string
  id: string
  icon: LucideIcon
  iconImage?: string
  reasoning: string
  risk?: string
  selection: string
  title: string
  rank: string
  tone: Tone
}

const fallbackMovementValues = [50, 51, 50, 52, 54, 53, 55, 54, 56, 52, 53, 52, 56, 55, 53, 54, 57, 55, 56, 58]
const fallbackMovementTicks = ['17:45', '18:00', '18:15', '18:30', '18:42']
const asianHandicapIcon = '/images/market-asian-handicap-icon.png'

const marketToneByFamily: Record<MarketFamily, Tone> = {
  asian_handicap: 'green',
  cards: 'orange',
  corners: 'green',
  one_x_two: 'purple',
  over_under: 'blue',
}

const marketIconByFamily: Record<MarketFamily, LucideIcon> = {
  asian_handicap: Scale,
  cards: ShieldAlert,
  corners: Crosshair,
  one_x_two: Flame,
  over_under: Goal,
}

const edgeSignalIcons = [ShieldAlert, Activity, CloudRain, Scale] satisfies LucideIcon[]

function buildSparkline(values: number[], width: number, height: number) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width
      const y = height - ((value - min) / range) * (height - 10) - 5
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function Sparkline({
  values,
  tone = 'green',
  width = 132,
  height = 48,
  className,
}: {
  values: number[]
  tone?: Tone
  width?: number
  height?: number
  className?: string
}) {
  const points = buildSparkline(values, width, height)
  const [lastX = width.toString(), lastY = (height / 2).toString()] = points.split(' ').at(-1)?.split(',') ?? []

  return (
    <svg
      className={clsx(styles.sparkline, styles[tone], className)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon points={`0,${height} ${points} ${width},${height}`} />
      <polyline points={points} />
      <circle cx={lastX} cy={lastY} r="3.4" />
    </svg>
  )
}

function ProbabilityBar({ label, value, tone }: ProbabilityBarProps) {
  const style = { '--bar-value': `${value}%` } as CSSProperties

  return (
    <div className={styles.probabilityRow} style={style}>
      <span>{label}</span>
      <div className={styles.track} aria-hidden="true">
        <i className={styles[tone]} />
      </div>
      <strong>{value}%</strong>
    </div>
  )
}

function formatTrend(value: number) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function isMatchMinuteTime(time: string) {
  return /^\d+(?:\+\d+)?'$/.test(time.trim())
}

function formatTimelineTime(time: string, nowLabel: string, minuteLabel: string) {
  const normalizedTime = time.trim()

  if (!normalizedTime) {
    return nowLabel
  }

  if (isMatchMinuteTime(normalizedTime)) {
    return `${minuteLabel} ${normalizedTime.replace("'", '')}`
  }

  return normalizedTime
}

function opponentForWinner(winner: string, homeTeam: string, awayTeam: string) {
  return winner === awayTeam ? homeTeam : awayTeam
}

function toEdgeFactors(signals: EdgeSignal[]): EdgeFactor[] {
  return signals.map((signal, index) => ({
    ...signal,
    icon: edgeSignalIcons[index % edgeSignalIcons.length],
  }))
}

function buildFallbackMarketPicks(
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
        confidence: confidence.medium,
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
        confidence: confidence.medium,
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
        confidence: confidence.low,
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
        confidence: confidence.medium,
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
      confidence: confidence.medium,
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
      confidence: confidence.medium,
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
      confidence: confidence.low,
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
      confidence: confidence.medium,
      risk: risk.medium,
    },
  ]
}

export default function Home() {
  const { copy, language } = useI18n()
  const { matchId: routeMatchId } = useParams<{ matchId: string }>()
  const dispatch = useAppDispatch()
  const dashboardData = useAppSelector(selectDashboardData)
  const dashboardStatus = useAppSelector(selectDashboardStatus)
  const dashboardError = useAppSelector(selectDashboardError)
  const liveStatus = useAppSelector(selectDashboardLiveStatus)
  const lastLiveSnapshotAt = useAppSelector(selectLastLiveSnapshotAt)
  const marketPredictions = useAppSelector(selectMarketPredictions)
  const marketPredictionStatus = useAppSelector(selectMarketPredictionStatus)
  const marketPredictionError = useAppSelector(selectMarketPredictionError)
  const data = dashboardStatus === 'idle' ? getDashboardPlaceholder(language) : dashboardData
  const winnerOutcome = data.prediction.outcomes[0]
  const drawOutcome = data.prediction.outcomes[1]
  const awayOutcome = data.prediction.outcomes[2]
  const homeTeamName = data.match.homeTeam.name
  const awayTeamName = data.match.awayTeam.name
  const predictedWinner = data.prediction.winner

  const matchId = routeMatchId ?? env.defaultMatchId

  useEffect(() => {
    dispatch(dashboardActions.loadMatchRequested({ language, matchId }))

    return () => {
      dispatch(dashboardActions.stopLivePolling())
    }
  }, [dispatch, language, matchId])

  useEffect(() => {
    if (dashboardStatus !== 'ready') {
      return undefined
    }

    dispatch(dashboardActions.startLivePolling({ language, matchId }))

    return () => {
      dispatch(dashboardActions.stopLivePolling())
    }
  }, [dashboardStatus, dispatch, language, matchId])

  const liveStatusMessage = useMemo(() => {
    if (dashboardStatus === 'error') {
      return copy.home.backendNotReady(dashboardError ?? copy.home.noMatchError)
    }

    if (liveStatus === 'unmapped') {
      return undefined
    }

    if (dashboardError && liveStatus !== 'ready') {
      return dashboardError
    }

    if (lastLiveSnapshotAt && liveStatus !== 'ready') {
      return copy.home.statusProvider(copy.home.liveStatusLabels[liveStatus])
    }

    return undefined
  }, [copy.home, dashboardError, dashboardStatus, lastLiveSnapshotAt, liveStatus])

  const edgeFactors = useMemo(() => toEdgeFactors(data.edgeSignals), [data.edgeSignals])

  const fallbackMarketPicks = useMemo(
    () => buildFallbackMarketPicks(
      homeTeamName,
      awayTeamName,
      predictedWinner,
      language,
      copy.home.confidence,
      copy.home.risk,
    ),
    [awayTeamName, copy.home.confidence, copy.home.risk, homeTeamName, language, predictedWinner],
  )

  const topPicks = useMemo(
    () => {
      const predictions = marketPredictions?.predictions ?? []

      if (!predictions.length) {
        return fallbackMarketPicks
      }

      return predictions.map((prediction, index) => ({
        id: prediction.id,
        title: prediction.name,
        selection: prediction.selection,
        reasoning: prediction.reasoning,
        rank: `#${index + 1}`,
        tone: marketToneByFamily[prediction.family],
        icon: marketIconByFamily[prediction.family],
        iconImage: prediction.family === 'asian_handicap' ? asianHandicapIcon : undefined,
        confidence: copy.home.confidence[prediction.confidence],
        risk: copy.home.risk[prediction.risk],
      })) satisfies PickCard[]
    },
    [copy.home.confidence, copy.home.risk, fallbackMarketPicks, marketPredictions],
  )

  const trend = formatTrend(winnerOutcome.trend)
  const movementSeries = data.movement.length ? data.movement.map((point) => point.home) : fallbackMovementValues
  const movementTicks = data.movement.length ? data.movement.map((point) => point.label) : fallbackMovementTicks
  const openingProbability = movementSeries[0] ?? winnerOutcome.value
  const previousProbability = movementSeries.at(-2) ?? openingProbability
  const hasMatchMinuteTimeline = data.feed.some((item) => isMatchMinuteTime(item.time))
  const timelineItems = hasMatchMinuteTimeline ? [...data.feed].reverse() : data.feed
  const scoreSignalNeedle = language === 'vi' ? 'tỷ số' : 'score'
  const liveScore = data.match.signals.find((signal) => signal.label.toLowerCase().includes(scoreSignalNeedle))?.value ?? '0-0'
  const matchTitle = `${data.match.homeTeam.name} vs ${data.match.awayTeam.name}`
  const liveRailSubtitle =
    liveStatus === 'ready'
      ? copy.home.liveRailSubtitleReady
      : copy.home.liveRailSubtitleStatus
  const marketNote =
    marketPredictionStatus === 'loading'
      ? copy.home.marketNoteLoading
      : marketPredictionStatus === 'ready'
        ? marketPredictions?.summary
        : marketPredictionStatus === 'error'
          ? copy.home.marketNoteError(marketPredictionError)
          : copy.home.marketNoteDefault
  const isDrawWinner = data.prediction.winner === copy.home.draw || data.prediction.winner === 'Hòa' || data.prediction.winner === 'Draw'
  const winnerStatement = isDrawWinner
    ? copy.home.draw
    : copy.home.winLabel(data.prediction.winner)

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbRow}>
        <div className={styles.breadcrumbs} aria-label={copy.home.breadcrumbLabel}>
          <Link className={styles.backLink} to={ROUTES.HOME}>
            <ArrowLeft size={14} aria-hidden="true" />
            {copy.home.backToMatches}
          </Link>
          <ArrowRight size={14} aria-hidden="true" />
          <span>{matchTitle}</span>
        </div>
        <div className={styles.updated}>
          {copy.home.updated}: {data.prediction.lastUpdated}
          <Radio size={15} aria-hidden="true" />
        </div>
      </div>

      {liveStatusMessage ? (
        <div className={styles.liveStatusBanner} data-status={liveStatus}>
          <ShieldAlert size={15} aria-hidden="true" />
          <span>{liveStatusMessage}</span>
        </div>
      ) : null}

      <div className={styles.dashboardLayout}>
        <section className={styles.heroCard} id="matches" aria-label={copy.home.matchOverviewLabel}>
          <div className={styles.matchStage}>
            <span className={clsx(styles.sideName, styles.sideNameHome)}>{data.match.homeTeam.name}</span>
            <span className={clsx(styles.sideName, styles.sideNameAway)}>{data.match.awayTeam.name}</span>

            <div className={clsx(styles.playerImage, styles.playerHome)}>
              <img src="/images/worldian-generic-home-athlete.png" alt="" aria-hidden="true" />
            </div>
            <div className={clsx(styles.playerImage, styles.playerAway)}>
              <img src="/images/worldian-generic-away-athlete.png" alt="" aria-hidden="true" />
            </div>

            <div className={styles.stageHeader}>
              <strong>{data.match.round}</strong>
              <span>
                {data.match.stadium}, {data.match.city}
              </span>
              <em>{data.match.kickoff}</em>
            </div>

            <div className={styles.teamDeck}>
              <div className={clsx(styles.teamBlock, styles.teamHome)}>
                <img src={data.match.homeTeam.flagUrl} alt={`Cờ ${data.match.homeTeam.name}`} />
                <h1>{data.match.homeTeam.name}</h1>
                <span>{data.match.homeTeam.shortName}</span>
              </div>

              <div className={styles.matchCenter}>
                <span>{data.match.competition}</span>
                <strong>VS</strong>
                <em>{data.match.round}</em>
              </div>

              <div className={clsx(styles.teamBlock, styles.teamAway)}>
                <img src={data.match.awayTeam.flagUrl} alt={`Cờ ${data.match.awayTeam.name}`} />
                <h2>{data.match.awayTeam.name}</h2>
                <span>{data.match.awayTeam.shortName}</span>
              </div>
            </div>
          </div>
        </section>

        <aside className={styles.liveRail} aria-label={copy.home.liveRailLabel}>
          <div className={styles.liveRailHeader}>
            <div>
              <h2>{copy.home.liveRailLabel}</h2>
              <p>{liveRailSubtitle}</p>
            </div>
            <span data-status={liveStatus}>{copy.home.liveRailStatusLabels[liveStatus]}</span>
          </div>

          <div className={styles.liveScoreStrip}>
            <span>{data.match.homeTeam.shortName}</span>
            <strong>{liveScore}</strong>
            <span>{data.match.awayTeam.shortName}</span>
          </div>

          {timelineItems.length ? (
            <div className={styles.timelineStack}>
              {timelineItems.map((item) => (
                <article key={item.id}>
                  <time>{formatTimelineTime(item.time, copy.home.now, copy.home.minute)}</time>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                    <strong>{copy.home.feedType[item.type]}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.timelineEmpty}>{copy.home.liveScoreEmpty}</p>
          )}
        </aside>

        <div className={styles.mainStack}>
          <section className={styles.predictionDeck} id="prediction" aria-label={copy.home.mainPrediction}>
            <article className={styles.winnerPanel}>
              <div className={styles.panelHeader}>
                <h2>{copy.home.mainPrediction}</h2>
                <span className={styles.liveBadge} data-status={liveStatus}>
                  <Zap size={13} aria-hidden="true" />
                  {data.prediction.status}
                </span>
              </div>

              <div className={styles.winnerStatement}>
                <span>
                  <Sparkles size={16} aria-hidden="true" />
                  {copy.home.currentPick}
                </span>
                <strong>{winnerStatement}</strong>
                <p>{data.prediction.summary}</p>
              </div>

              <div className={styles.matchSignals} aria-label={copy.home.matchOverviewLabel}>
                {data.match.signals.map((signal) => (
                  <div key={signal.label} data-tone={signal.tone}>
                    <span>{signal.label}</span>
                    <strong>{signal.value}</strong>
                  </div>
                ))}
              </div>

              <div className={styles.winnerMetrics}>
                <div>
                  <span>{copy.home.confidenceLabel}</span>
                  <strong>
                    {data.prediction.confidence.toFixed(1)}
                    <small>/10</small>
                  </strong>
                </div>
                <div>
                  <span>{copy.home.movementLabel}</span>
                  <strong className={styles.green}>{trend}</strong>
                  <small>{copy.home.trendWindow}</small>
                </div>
              </div>
            </article>

            <aside className={styles.probabilityPanel} aria-label={copy.home.probabilityLabel}>
              <div className={styles.panelHeader}>
                <h2>{copy.home.probabilityTitle}</h2>
                <span className={styles.liveBadge} data-status={liveStatus}>
                  <Radio size={13} aria-hidden="true" />
                  {copy.home.liveRailStatusLabels[liveStatus]}
                </span>
              </div>
              <div className={styles.probabilityRows}>
                <ProbabilityBar label={winnerOutcome.label} value={winnerOutcome.value} tone="green" />
                <ProbabilityBar label={drawOutcome.label} value={drawOutcome.value} tone="gray" />
                <ProbabilityBar label={awayOutcome.label} value={awayOutcome.value} tone="blue" />
              </div>
              <div className={styles.confidenceLine}>
                <span>{copy.home.modelConfidence}: {data.prediction.confidence.toFixed(1)} / 10</span>
                <div aria-hidden="true">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <i key={index} className={index < Math.round(data.prediction.confidence) ? styles.filled : undefined} />
                  ))}
                </div>
              </div>
            </aside>
          </section>

          <section className={styles.reasoningSection} id="analysis" aria-label={copy.home.analysisLabel}>
            <div className={styles.sectionIntro}>
              <h2>{copy.home.reasoningTitle(data.prediction.winner)}</h2>
              <p>{copy.home.reasoningIntro}</p>
            </div>

            <div className={styles.reasoningLayout}>
              <article className={styles.reasonPanel} aria-labelledby="reason-heading">
                <div className={styles.reasoningLead}>
                  <h3 id="reason-heading">{data.reasoning.headline}</h3>
                  <p>{data.reasoning.description}</p>
                </div>

                <div className={styles.reasonPointList}>
                  {data.reasoning.points.map((point) => (
                    <article key={point.id}>
                      <span>{copy.home.impact[point.impact]}</span>
                      <h4>{point.title}</h4>
                      <p>{point.detail}</p>
                    </article>
                  ))}
                </div>
              </article>

              <aside className={styles.edgePanel} aria-label={copy.home.edgePanelLabel}>
                <div className={styles.panelHeader}>
                  <h3>{copy.home.edgePanelLabel}</h3>
                </div>
                <div className={styles.reasonList}>
                  {edgeFactors.map((factor) => {
                    const Icon = factor.icon

                    return (
                      <article key={factor.label}>
                        <span className={clsx(styles.reasonIcon, styles[factor.tone])}>
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <div>
                          <h4>{factor.label}</h4>
                          <p>{factor.detail}</p>
                        </div>
                        <strong className={styles[factor.tone]}>{factor.delta}</strong>
                      </article>
                    )
                  })}
                </div>
                <div className={styles.netEdge}>
                  <span>{copy.home.netEdge}</span>
                  <strong>{data.netEdge}</strong>
                </div>
              </aside>
            </div>
          </section>

          <section className={styles.marketsSection} id="markets" aria-label={copy.home.marketsLabel}>
            <div className={styles.sectionIntro}>
              <h2>{copy.home.marketsTitle}</h2>
              <p>{copy.home.marketsIntro}</p>
            </div>

            <div className={styles.pickGrid}>
              {topPicks.map((pick, index) => {
                const Icon = pick.icon

                return (
                  <article
                    key={pick.id}
                    className={clsx(
                      styles.pickCard,
                      styles[`pick${pick.tone}`],
                      index < 2 && styles.featuredPick,
                      pick.iconImage && styles.illustratedPick,
                    )}
                  >
                    <div className={styles.pickTop}>
                      <span className={styles.pickRank}>
                        {pick.iconImage ? (
                          <span className={styles.pickIconBadge}>
                            <img className={styles.pickIconImage} src={pick.iconImage} alt="" aria-hidden="true" />
                          </span>
                        ) : (
                          <Icon size={14} aria-hidden="true" />
                        )}
                        {pick.rank}
                      </span>
                      <span className={styles.pickLabel}>{copy.home.aiPick}</span>
                    </div>
                    <div className={styles.pickMarket}>
                      <h3>{pick.title}</h3>
                      <strong>{pick.selection}</strong>
                    </div>
                    <p className={styles.pickReasoning}>{pick.reasoning}</p>
                    <div className={styles.pickMeta}>
                      {pick.confidence ? <span>{pick.confidence}</span> : null}
                      {pick.risk ? <span>{pick.risk}</span> : null}
                    </div>
                  </article>
                )
              })}
            </div>

            <p className={clsx(styles.marketNote, marketPredictionStatus === 'error' && styles.warningNote)}>{marketNote}</p>
          </section>

          <section className={styles.liveSection} aria-label={copy.home.movementLabel}>
            <section className={styles.movementPanel} aria-labelledby="movement-heading">
              <div className={styles.panelHeader}>
                <h2 id="movement-heading">{copy.home.movementTitle}</h2>
                <button type="button">
                  {copy.home.chartRange}
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
              </div>
              <div className={styles.movementSubject}>
                <img src={data.match.homeTeam.flagUrl} alt="" aria-hidden="true" />
                <strong>{copy.home.winProbabilitySubject(winnerOutcome.label)}</strong>
              </div>
              <div className={styles.chartBox}>
                <Sparkline values={movementSeries} width={540} height={220} className={styles.movementSparkline} />
                <span className={styles.nowTag}>{winnerOutcome.value}%</span>
                <div className={styles.chartScale} aria-hidden="true">
                  <span>60%</span>
                  <span>55%</span>
                  <span>50%</span>
                  <span>45%</span>
                </div>
                <div className={styles.chartTimes} aria-hidden="true">
                  {movementTicks.map((tick) => (
                    <span key={tick}>{tick}</span>
                  ))}
                </div>
              </div>
              <div className={styles.movementStats}>
                <div>
                  <span>{copy.home.openingLine}</span>
                  <strong>{openingProbability}%</strong>
                </div>
                <div>
                  <span>{copy.home.previous}</span>
                  <strong>{previousProbability}%</strong>
                </div>
                <div>
                  <span>{copy.home.current}</span>
                  <strong className={styles.green}>{winnerOutcome.value}%</strong>
                </div>
              </div>
            </section>
          </section>
        </div>

      </div>

      <section className={styles.liveSummary} aria-label={copy.home.systemSummaryLabel}>
        <Bot size={18} aria-hidden="true" />
        <p>{liveStatusMessage ?? data.prediction.summary}</p>
        <span data-status={liveStatus}>
          <ShieldCheck size={15} aria-hidden="true" />
          {copy.home.liveStatusLabels[liveStatus]}
        </span>
      </section>
    </div>
  )
}
