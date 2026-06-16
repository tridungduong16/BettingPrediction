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
import { useAppDispatch, useAppSelector } from '@/hooks/store'
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
import { dashboardActions, type DashboardLiveStatus } from '@/store/features/dashboard/slice'
import type { EdgeSignal, FeedItemType } from '@/store/features/dashboard/types'
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
  reasoning: string
  risk?: string
  selection: string
  title: string
  rank: string
  tone: Tone
}

const fallbackMovementValues = [50, 51, 50, 52, 54, 53, 55, 54, 56, 52, 53, 52, 56, 55, 53, 54, 57, 55, 56, 58]
const fallbackMovementTicks = ['17:45', '18:00', '18:15', '18:30', '18:42']
const liveStatusLabels: Record<DashboardLiveStatus, string> = {
  not_configured: 'chưa cấu hình',
  provider_error: 'lỗi nhà cung cấp',
  ready: 'sẵn sàng',
  unmapped: 'chưa liên kết trận live',
}

const liveRailStatusLabels: Record<DashboardLiveStatus, string> = {
  not_configured: 'chưa cấu hình',
  provider_error: 'lỗi live',
  ready: 'live',
  unmapped: 'chưa liên kết',
}

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

const confidenceLabels: Record<NonNullable<MarketPrediction['confidence']>, string> = {
  high: 'Tin cậy cao',
  low: 'Tin cậy thấp',
  medium: 'Tin cậy vừa',
}

const riskLabels: Record<NonNullable<MarketPrediction['risk']>, string> = {
  high: 'Rủi ro cao',
  low: 'Rủi ro thấp',
  medium: 'Rủi ro vừa',
}

const edgeSignalIcons = [ShieldAlert, Activity, CloudRain, Scale] satisfies LucideIcon[]

const impactLabels: Record<'high' | 'medium' | 'low', string> = {
  high: 'Tác động cao',
  low: 'Tác động thấp',
  medium: 'Tác động vừa',
}

const feedTypeLabels: Record<FeedItemType, string> = {
  card: 'Thẻ',
  goal: 'Bàn thắng',
  lineup: 'Đội hình',
  market: 'Kèo',
  model: 'Mô hình',
  news: 'Tin tức',
  substitution: 'Thay người',
  var: 'VAR',
}

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

function formatTimelineTime(time: string) {
  const normalizedTime = time.trim()

  if (!normalizedTime) {
    return 'Bây giờ'
  }

  if (isMatchMinuteTime(normalizedTime)) {
    return `Phút ${normalizedTime.replace("'", '')}`
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

function buildFallbackMarketPicks(homeTeam: string, awayTeam: string, winner: string): PickCard[] {
  const opponent = opponentForWinner(winner, homeTeam, awayTeam)

  return [
    {
      id: 'asian-handicap',
      title: `Kèo Châu Á: ${winner} -0.25`,
      selection: `${winner} -0.25 thắng kèo`,
      reasoning: `${winner} đang là cửa nghiêng tạm thời so với ${opponent}, nhưng handicap được giữ thấp vì còn thiếu dữ liệu live và đội hình mới nhất.`,
      rank: '#1',
      tone: 'green',
      icon: Scale,
      confidence: 'Tin cậy vừa',
      risk: 'Rủi ro vừa',
    },
    {
      id: 'over-under',
      title: 'Tài/Xỉu: Over 2.5 bàn',
      selection: 'Over 2.5 bàn',
      reasoning: `Tổng bàn của ${homeTeam} vs ${awayTeam} cần thêm nhịp trận, cú sút và đội hình ra sân trước khi nâng độ tin cậy.`,
      rank: '#2',
      tone: 'blue',
      icon: Goal,
      confidence: 'Tin cậy vừa',
      risk: 'Rủi ro cao',
    },
    {
      id: 'one-x-two',
      title: '1X2: Kết quả trận đấu',
      selection: `${winner} thắng`,
      reasoning: `Mô hình đang nghiêng về ${winner}; fallback này chỉ dùng dữ liệu trận hiện tại và không tái sử dụng luận điểm của cặp đấu mẫu.`,
      rank: '#3',
      tone: 'purple',
      icon: Flame,
      confidence: 'Tin cậy vừa',
      risk: 'Rủi ro thấp',
    },
    {
      id: 'cards',
      title: 'Thẻ phạt: Over 4.5 thẻ',
      selection: 'Over 4.5 thẻ',
      reasoning: 'Kèo thẻ cần thêm dữ liệu trọng tài, cường độ tranh chấp và trạng thái trận trước khi có lựa chọn chắc hơn.',
      rank: '#4',
      tone: 'orange',
      icon: ShieldAlert,
      confidence: 'Tin cậy thấp',
      risk: 'Rủi ro vừa',
    },
    {
      id: 'corners',
      title: 'Corner: Over 9.5 góc',
      selection: 'Over 9.5 góc',
      reasoning: `Kèo corner sẽ rõ hơn khi có hướng tấn công, số pha tạt bóng và cú sút bị chặn của ${homeTeam} hoặc ${awayTeam}.`,
      rank: '#5',
      tone: 'green',
      icon: Crosshair,
      confidence: 'Tin cậy vừa',
      risk: 'Rủi ro vừa',
    },
  ]
}

export default function Home() {
  const { matchId: routeMatchId } = useParams<{ matchId: string }>()
  const dispatch = useAppDispatch()
  const data = useAppSelector(selectDashboardData)
  const dashboardStatus = useAppSelector(selectDashboardStatus)
  const dashboardError = useAppSelector(selectDashboardError)
  const liveStatus = useAppSelector(selectDashboardLiveStatus)
  const lastLiveSnapshotAt = useAppSelector(selectLastLiveSnapshotAt)
  const marketPredictions = useAppSelector(selectMarketPredictions)
  const marketPredictionStatus = useAppSelector(selectMarketPredictionStatus)
  const marketPredictionError = useAppSelector(selectMarketPredictionError)
  const winnerOutcome = data.prediction.outcomes[0]
  const drawOutcome = data.prediction.outcomes[1]
  const awayOutcome = data.prediction.outcomes[2]
  const homeTeamName = data.match.homeTeam.name
  const awayTeamName = data.match.awayTeam.name
  const predictedWinner = data.prediction.winner

  const matchId = routeMatchId ?? env.defaultMatchId

  useEffect(() => {
    dispatch(dashboardActions.loadMatchRequested(matchId))

    return () => {
      dispatch(dashboardActions.stopLivePolling())
    }
  }, [dispatch, matchId])

  useEffect(() => {
    if (dashboardStatus !== 'ready') {
      return undefined
    }

    dispatch(dashboardActions.startLivePolling(matchId))

    return () => {
      dispatch(dashboardActions.stopLivePolling())
    }
  }, [dashboardStatus, dispatch, matchId])

  const liveStatusMessage = useMemo(() => {
    if (dashboardStatus === 'error') {
      return `Backend chưa sẵn sàng: ${dashboardError ?? 'Không thể tải chi tiết trận đấu'}. Đang hiển thị dashboard mẫu.`
    }

    if (dashboardError && liveStatus !== 'ready') {
      return `${dashboardError} Đang dùng phân tích fallback theo dữ liệu trận hiện có.`
    }

    if (lastLiveSnapshotAt && liveStatus !== 'ready') {
      return `Trạng thái nhà cung cấp live: ${liveStatusLabels[liveStatus]}. Đang dùng phân tích fallback theo dữ liệu trận hiện có.`
    }

    return undefined
  }, [dashboardError, dashboardStatus, lastLiveSnapshotAt, liveStatus])

  const edgeFactors = useMemo(() => toEdgeFactors(data.edgeSignals), [data.edgeSignals])

  const fallbackMarketPicks = useMemo(
    () => buildFallbackMarketPicks(homeTeamName, awayTeamName, predictedWinner),
    [awayTeamName, homeTeamName, predictedWinner],
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
        confidence: confidenceLabels[prediction.confidence],
        risk: riskLabels[prediction.risk],
      })) satisfies PickCard[]
    },
    [fallbackMarketPicks, marketPredictions],
  )

  const trend = formatTrend(winnerOutcome.trend)
  const movementSeries = data.movement.length ? data.movement.map((point) => point.home) : fallbackMovementValues
  const movementTicks = data.movement.length ? data.movement.map((point) => point.label) : fallbackMovementTicks
  const openingProbability = movementSeries[0] ?? winnerOutcome.value
  const previousProbability = movementSeries.at(-2) ?? openingProbability
  const hasMatchMinuteTimeline = data.feed.some((item) => isMatchMinuteTime(item.time))
  const timelineItems = hasMatchMinuteTimeline ? [...data.feed].reverse() : data.feed
  const liveScore = data.match.signals.find((signal) => signal.label.toLowerCase().includes('tỷ số'))?.value ?? '0-0'
  const matchTitle = `${data.match.homeTeam.name} vs ${data.match.awayTeam.name}`
  const liveRailSubtitle =
    liveStatus === 'ready'
      ? 'Sự kiện, tỷ số và đồng hồ từ nhà cung cấp live'
      : 'Trạng thái kết nối live và các cập nhật gần đây'
  const marketNote =
    marketPredictionStatus === 'loading'
      ? 'Đang lấy dự đoán AI từ backend...'
      : marketPredictionStatus === 'ready'
        ? marketPredictions?.summary
        : marketPredictionStatus === 'error'
          ? `Chưa lấy được dự đoán AI: ${marketPredictionError}. Đang dùng fallback theo trận hiện tại.`
          : 'Mỗi kèo hiển thị hướng AI chọn và reasoning ngắn gọn từ service LLM.'

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbRow}>
        <div className={styles.breadcrumbs} aria-label="Đường dẫn">
          <Link className={styles.backLink} to={ROUTES.HOME}>
            <ArrowLeft size={14} aria-hidden="true" />
            Trận đấu
          </Link>
          <ArrowRight size={14} aria-hidden="true" />
          <span>{matchTitle}</span>
        </div>
        <div className={styles.updated}>
          Cập nhật: {data.prediction.lastUpdated}
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
        <section className={styles.heroCard} id="matches" aria-label="Tổng quan trận đấu">
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

        <aside className={styles.liveRail} aria-label="Live trận đấu">
          <div className={styles.liveRailHeader}>
            <div>
              <h2>Live trận đấu</h2>
              <p>{liveRailSubtitle}</p>
            </div>
            <span data-status={liveStatus}>{liveRailStatusLabels[liveStatus]}</span>
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
                  <time>{formatTimelineTime(item.time)}</time>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                    <strong>{feedTypeLabels[item.type]}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.timelineEmpty}>Chưa có sự kiện live từ nhà cung cấp.</p>
          )}
        </aside>

        <div className={styles.mainStack}>
          <section className={styles.predictionDeck} id="prediction" aria-label="Dự đoán AI">
            <article className={styles.winnerPanel}>
              <div className={styles.panelHeader}>
                <h2>AI dự đoán chính</h2>
                <span className={styles.liveBadge} data-status={liveStatus}>
                  <Zap size={13} aria-hidden="true" />
                  {data.prediction.status}
                </span>
              </div>

              <div className={styles.winnerStatement}>
                <span>
                  <Sparkles size={16} aria-hidden="true" />
                  Lựa chọn hiện tại
                </span>
                <strong>{data.prediction.winner === 'Hòa' ? 'Hòa' : `${data.prediction.winner} thắng`}</strong>
                <p>{data.prediction.summary}</p>
              </div>

              <div className={styles.matchSignals} aria-label="Tín hiệu trận đấu">
                {data.match.signals.map((signal) => (
                  <div key={signal.label} data-tone={signal.tone}>
                    <span>{signal.label}</span>
                    <strong>{signal.value}</strong>
                  </div>
                ))}
              </div>

              <div className={styles.winnerMetrics}>
                <div>
                  <span>Độ tin cậy</span>
                  <strong>
                    {data.prediction.confidence.toFixed(1)}
                    <small>/10</small>
                  </strong>
                </div>
                <div>
                  <span>Biến động</span>
                  <strong className={styles.green}>{trend}</strong>
                  <small>30 phút qua</small>
                </div>
              </div>
            </article>

            <aside className={styles.probabilityPanel} aria-label="Xác suất thắng">
              <div className={styles.panelHeader}>
                <h2>Xác suất thắng</h2>
                <span className={styles.liveBadge} data-status={liveStatus}>
                  <Radio size={13} aria-hidden="true" />
                  {liveRailStatusLabels[liveStatus]}
                </span>
              </div>
              <div className={styles.probabilityRows}>
                <ProbabilityBar label={winnerOutcome.label} value={winnerOutcome.value} tone="green" />
                <ProbabilityBar label={drawOutcome.label} value={drawOutcome.value} tone="gray" />
                <ProbabilityBar label={awayOutcome.label} value={awayOutcome.value} tone="blue" />
              </div>
              <div className={styles.confidenceLine}>
                <span>Độ tin cậy mô hình: {data.prediction.confidence.toFixed(1)} / 10</span>
                <div aria-hidden="true">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <i key={index} className={index < Math.round(data.prediction.confidence) ? styles.filled : undefined} />
                  ))}
                </div>
              </div>
            </aside>
          </section>

          <section className={styles.reasoningSection} id="analysis" aria-label="Lý do dự đoán">
            <div className={styles.sectionIntro}>
              <h2>Vì sao AI nghiêng về {data.prediction.winner}</h2>
              <p>Ưu tiên đọc reasoning trước analytics: luận điểm chính, dữ liệu tác động và lợi thế ròng được tách thành từng nhóm.</p>
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
                      <span>{impactLabels[point.impact]}</span>
                      <h4>{point.title}</h4>
                      <p>{point.detail}</p>
                    </article>
                  ))}
                </div>
              </article>

              <aside className={styles.edgePanel} aria-label="Tín hiệu điều chỉnh xác suất">
                <div className={styles.panelHeader}>
                  <h3>Tín hiệu làm lệch xác suất</h3>
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
                  <span>Lợi thế ròng</span>
                  <strong>{data.netEdge}</strong>
                </div>
              </aside>
            </div>
          </section>

          <section className={styles.marketsSection} id="markets" aria-label="Các kèo AI đề xuất">
            <div className={styles.sectionIntro}>
              <h2>Lựa chọn AI theo từng thị trường</h2>
              <p>Kèo Châu Á, Tài/Xỉu, 1X2, thẻ phạt và corner được đặt thành các khối riêng để reasoning không bị nén vào một card.</p>
            </div>

            <div className={styles.pickGrid}>
              {topPicks.map((pick, index) => {
                const Icon = pick.icon

                return (
                  <article
                    key={pick.id}
                    className={clsx(styles.pickCard, styles[`pick${pick.tone}`], index < 2 && styles.featuredPick)}
                  >
                    <div className={styles.pickTop}>
                      <span className={styles.pickRank}>
                        <Icon size={14} aria-hidden="true" />
                        {pick.rank}
                      </span>
                      <span className={styles.pickLabel}>AI chọn</span>
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

          <section className={styles.liveSection} aria-label="Biến động xác suất">
            <section className={styles.movementPanel} aria-labelledby="movement-heading">
              <div className={styles.panelHeader}>
                <h2 id="movement-heading">Biến động xác suất live</h2>
                <button type="button">
                  60 phút qua
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
              </div>
              <div className={styles.movementSubject}>
                <img src={data.match.homeTeam.flagUrl} alt="" aria-hidden="true" />
                <strong>{winnerOutcome.label} thắng</strong>
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
                  <span>Mở kèo</span>
                  <strong>{openingProbability}%</strong>
                </div>
                <div>
                  <span>Lần trước</span>
                  <strong>{previousProbability}%</strong>
                </div>
                <div>
                  <span>Hiện tại</span>
                  <strong className={styles.green}>{winnerOutcome.value}%</strong>
                </div>
              </div>
            </section>
          </section>
        </div>

      </div>

      <section className={styles.liveSummary} aria-label="Tóm tắt hệ thống">
        <Bot size={18} aria-hidden="true" />
        <p>{liveStatusMessage ?? data.prediction.summary}</p>
        <span data-status={liveStatus}>
          <ShieldCheck size={15} aria-hidden="true" />
          {liveStatusLabels[liveStatus]}
        </span>
      </section>
    </div>
  )
}
