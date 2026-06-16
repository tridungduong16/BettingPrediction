import { useEffect, useMemo, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
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
  TrendingUp,
  Zap,
} from 'lucide-react'
import clsx from 'clsx'

import { env } from '@/config/env'
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
  dataGaps?: string[]
  id: string
  icon: LucideIcon
  reasoning: string
  risk?: string
  selection: string
  title: string
  rank: string
  tone: Tone
}

const edgeFactors = [
  {
    icon: ShieldAlert,
    label: 'Trung vệ Pháp bỏ ngỏ khả năng ra sân',
    detail: 'Hậu vệ trụ cột Dayot Upamecano nhiều khả năng vắng mặt',
    delta: '+1.8%',
    tone: 'green',
  },
  {
    icon: Activity,
    label: 'Xu hướng xG của Brazil cải thiện',
    detail: '1.72 xG trong 3 trận gần nhất',
    delta: '+1.2%',
    tone: 'green',
  },
  {
    icon: CloudRain,
    label: 'Dự báo mưa lớn tại Lusail',
    detail: 'Điều kiện phù hợp với lối chơi của Brazil',
    delta: '+0.6%',
    tone: 'green',
  },
  {
    icon: Scale,
    label: 'Dòng cược công chúng nghiêng về Pháp',
    detail: '67% lượt cược chọn Pháp thắng',
    delta: '-0.8%',
    tone: 'red',
  },
] satisfies EdgeFactor[]

const movementValues = [50, 51, 50, 52, 54, 53, 55, 54, 56, 52, 53, 52, 56, 55, 53, 54, 57, 55, 56, 58]

const liveStatusLabels: Record<DashboardLiveStatus, string> = {
  not_configured: 'chưa cấu hình',
  provider_error: 'lỗi nhà cung cấp',
  ready: 'sẵn sàng',
  unmapped: 'chưa liên kết trận live',
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

const fallbackMarketPicks: PickCard[] = [
  {
    id: 'asian-handicap',
    title: 'Kèo Châu Á: Brazil -1.0',
    selection: 'Brazil -1.0 thắng kèo',
    reasoning:
      'Brazil đang có lợi thế về chất lượng cơ hội và khả năng gây áp lực ở trung lộ, nên hướng handicap nghiêng nhẹ về cửa Brazil.',
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
    reasoning:
      'Nhịp tấn công hai đội đủ cao để tạo nhiều pha dứt điểm, nhưng cần xác nhận đội hình trước khi nâng độ tin cậy.',
    rank: '#2',
    tone: 'blue',
    icon: Goal,
    confidence: 'Tin cậy vừa',
    risk: 'Rủi ro cao',
  },
  {
    id: 'one-x-two',
    title: '1X2: Kết quả trận đấu',
    selection: 'Brazil thắng',
    reasoning:
      'Mô hình đang nghiêng về Brazil nhờ chất lượng cú sút tốt hơn và rủi ro đội hình của Pháp ở hàng thủ.',
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
    reasoning:
      'Trận loại trực tiếp có xác suất va chạm và lỗi chiến thuật cao hơn, đặc biệt khi hai đội chuyển trạng thái nhanh.',
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
    reasoning:
      'Brazil được dự báo ép biên nhiều hơn, tạo thêm các pha tạt bóng, sút bị chặn và tình huống phạt góc.',
    rank: '#5',
    tone: 'green',
    icon: Crosshair,
    confidence: 'Tin cậy vừa',
    risk: 'Rủi ro vừa',
  },
]

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

export default function Home() {
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

  const matchId = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('matchId') ?? env.defaultMatchId
  }, [])

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
      return `${dashboardError} Dự đoán mẫu vẫn đang hiển thị.`
    }

    if (lastLiveSnapshotAt && liveStatus !== 'ready') {
      return `Trạng thái nhà cung cấp live: ${liveStatusLabels[liveStatus]}. Dự đoán mẫu vẫn đang hiển thị.`
    }

    return undefined
  }, [dashboardError, dashboardStatus, lastLiveSnapshotAt, liveStatus])

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
        dataGaps: prediction.data_gaps,
      })) satisfies PickCard[]
    },
    [marketPredictions],
  )

  const trend = formatTrend(winnerOutcome.trend)

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbRow}>
        <div className={styles.breadcrumbs} aria-label="Đường dẫn">
          <span>{data.match.competition}</span>
          <ArrowRight size={14} aria-hidden="true" />
          <span>{data.match.round}</span>
        </div>
        <div className={styles.updated}>
          Cập nhật: {data.prediction.lastUpdated}
          <Radio size={15} aria-hidden="true" />
        </div>
      </div>

      <section className={styles.heroCard} id="matches" aria-label="Tổng quan dự đoán trận đấu">
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
              <span>Hạng FIFA #1</span>
            </div>

            <div className={styles.aiPickCard}>
              <span>
                <Sparkles size={15} aria-hidden="true" />
                AI chọn
              </span>
              <strong>{data.prediction.winner} thắng</strong>
              <div className={styles.confidenceScore}>
                <div>
                  <b>{data.prediction.confidence.toFixed(1)}</b>
                  <small>/10</small>
                </div>
                <em>Rất cao</em>
              </div>
              <p>
                <TrendingUp size={20} aria-hidden="true" />
                <b>{trend}</b>
                <span>30 phút qua</span>
              </p>
            </div>

            <div className={clsx(styles.teamBlock, styles.teamAway)}>
              <img src={data.match.awayTeam.flagUrl} alt={`Cờ ${data.match.awayTeam.name}`} />
              <h2>{data.match.awayTeam.name}</h2>
              <span>Hạng FIFA #2</span>
            </div>
          </div>
        </div>

        <aside className={styles.probabilityPanel} aria-label="Xác suất thắng">
          <div className={styles.panelHeader}>
            <h2>Xác suất thắng</h2>
            <span className={styles.liveBadge}>
              <Zap size={13} aria-hidden="true" />
              Trực tiếp
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

      <section className={styles.analysisGrid} id="analysis" aria-label="Phân tích dự đoán">
        <section className={styles.reasonPanel} aria-labelledby="reason-heading">
          <div className={styles.panelHeader}>
            <h2 id="reason-heading">Vì sao AI nghiêng về {data.prediction.winner}</h2>
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
                    <h3>{factor.label}</h3>
                    <p>{factor.detail}</p>
                  </div>
                  <strong className={styles[factor.tone]}>{factor.delta}</strong>
                </article>
              )
            })}
          </div>
          <div className={styles.netEdge}>
            <span>Lợi thế ròng</span>
            <strong>+2.9%</strong>
          </div>
        </section>

        <section className={styles.topPicksPanel} aria-labelledby="picks-heading">
          <div className={styles.panelHeader}>
            <h2 id="picks-heading">Lựa chọn AI nổi bật</h2>
            <a href="#markets">
              Xem tất cả kèo
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
          <div className={styles.pickGrid}>
            {topPicks.map((pick) => {
              const Icon = pick.icon

              return (
                <article key={pick.id} className={clsx(styles.pickCard, styles[`pick${pick.tone}`])}>
                  <div className={styles.pickRank}>
                    <Icon size={14} aria-hidden="true" />
                    <span>{pick.rank}</span>
                  </div>
                  <h3>{pick.title}</h3>
                  <span className={styles.pickLabel}>AI chọn</span>
                  <strong>{pick.selection}</strong>
                  <p>{pick.reasoning}</p>
                  <div className={styles.pickMeta}>
                    {pick.confidence ? <span>{pick.confidence}</span> : null}
                    {pick.risk ? <span>{pick.risk}</span> : null}
                  </div>
                  {pick.dataGaps?.length ? (
                    <small>Thiếu dữ liệu: {pick.dataGaps.join(', ')}</small>
                  ) : null}
                </article>
              )
            })}
          </div>
          <p className={clsx(styles.marketNote, marketPredictionStatus === 'error' && styles.warningNote)}>
            {marketPredictionStatus === 'loading'
              ? 'Đang lấy dự đoán AI từ backend...'
              : marketPredictionStatus === 'ready'
                ? marketPredictions?.summary
                : marketPredictionStatus === 'error'
                  ? `Chưa lấy được dự đoán AI: ${marketPredictionError}. Đang hiển thị dữ liệu mẫu.`
                  : 'Mỗi kèo hiển thị hướng AI chọn và reasoning ngắn gọn từ service LLM.'}
          </p>
        </section>

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
            <Sparkline values={movementValues} width={540} height={150} className={styles.movementSparkline} />
            <span className={styles.nowTag}>{winnerOutcome.value}%</span>
            <div className={styles.chartScale} aria-hidden="true">
              <span>60%</span>
              <span>55%</span>
              <span>50%</span>
              <span>45%</span>
            </div>
            <div className={styles.chartTimes} aria-hidden="true">
              <span>17:45</span>
              <span>18:00</span>
              <span>18:15</span>
              <span>18:30</span>
              <span>18:42</span>
            </div>
          </div>
          <div className={styles.movementStats}>
            <div>
              <span>Mở kèo</span>
              <strong>54%</strong>
            </div>
            <div>
              <span>30 phút trước</span>
              <strong>55%</strong>
            </div>
            <div>
              <span>Hiện tại</span>
              <strong className={styles.green}>{winnerOutcome.value}%</strong>
            </div>
          </div>
        </section>
      </section>

      <section className={styles.liveSummary} aria-label="Tóm tắt hệ thống">
        <Bot size={18} aria-hidden="true" />
        <p>{liveStatusMessage ?? data.prediction.summary}</p>
        <span>
          <ShieldCheck size={15} aria-hidden="true" />
          {data.prediction.status}
        </span>
      </section>
    </div>
  )
}
