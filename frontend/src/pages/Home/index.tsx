import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  BrainCircuit,
  ChevronDown,
  CloudRain,
  Crosshair,
  Flame,
  Gauge,
  Goal,
  Hospital,
  Info,
  Landmark,
  Radio,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
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
import type { FeedItem } from '@/store/features/dashboard/types'

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

interface ContextTile {
  icon: LucideIcon
  label: string
  value: string
  detail: string
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

const fallbackInsightCards = [
  {
    time: '18:41',
    title: 'Mbappe bỏ ngỏ khả năng đá trận hôm nay.',
    impact: '+1.2%',
    affects: 'Brazil thắng',
    tone: 'green',
    isNew: true,
  },
  {
    time: '18:35',
    title: 'Brazil tung 18 cú sút trong 2 trận gần nhất.',
    impact: '+0.9%',
    affects: 'Brazil thắng',
    tone: 'green',
  },
  {
    time: '18:28',
    title: 'Xác suất mưa hiện là 70% lúc bóng lăn.',
    impact: '+0.4%',
    affects: 'Dưới 2.5',
    tone: 'blue',
  },
] satisfies Array<{
  time: string
  title: string
  impact: string
  affects: string
  tone: Tone
  isNew?: boolean
}>

const insightToneByFeedType: Record<FeedItem['type'], Tone> = {
  card: 'orange',
  goal: 'green',
  lineup: 'green',
  market: 'red',
  model: 'green',
  news: 'blue',
  substitution: 'blue',
  var: 'purple',
}

const insightImpactByFeedType: Record<FeedItem['type'], string> = {
  card: '+0.3%',
  goal: '+1.0%',
  lineup: '+1.2%',
  market: '-0.6%',
  model: '+0.9%',
  news: '+0.4%',
  substitution: '+0.2%',
  var: '+0.5%',
}

const insightAffectsByFeedType: Record<FeedItem['type'], string> = {
  card: 'Kỷ luật',
  goal: 'Tỷ số live',
  lineup: 'Đội hình',
  market: 'Brazil thắng',
  model: 'Brazil thắng',
  news: 'Dưới 2.5',
  substitution: 'Nhịp độ',
  var: 'Quyết định',
}

const quickActions = [
  {
    icon: Scale,
    label: 'So sánh đội',
    detail: 'Mở dữ liệu đầu vào về đối đầu',
  },
  {
    icon: BarChart3,
    label: 'Xem thống kê H2H',
    detail: 'Hiển thị biến động xác suất lịch sử',
  },
  {
    icon: UsersRound,
    label: 'Đội hình sắp có',
    detail: 'Theo dõi trạng thái xác nhận đội hình',
  },
]

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
  const [activeAction, setActiveAction] = useState(quickActions[0].label)

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

  const visibleInsightCards = useMemo(() => {
    const feedItems = data.feed.length ? data.feed : []

    if (!feedItems.length) {
      return fallbackInsightCards
    }

    return feedItems.slice(0, 3).map((item) => ({
      time: item.time,
      title: item.detail || item.title,
      impact: insightImpactByFeedType[item.type],
      affects: insightAffectsByFeedType[item.type],
      tone: insightToneByFeedType[item.type],
      isNew: item.type === 'goal' || item.type === 'card' || item.type === 'var',
    }))
  }, [data.feed])

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

  const contextTiles = useMemo(
    () =>
      [
        {
          icon: CloudRain,
          label: 'Thời tiết',
          value: '24°C',
          detail: 'Mưa lớn, tác động cao',
          tone: 'blue',
        },
        {
          icon: Hospital,
          label: 'Chấn thương',
          value: '1',
          detail: 'Nghi vấn trụ cột, trung vệ Pháp',
          tone: 'red',
        },
        {
          icon: Landmark,
          label: 'Mặt sân',
          value: 'Tốt',
          detail: 'Bề mặt hơi ướt',
          tone: 'green',
        },
        {
          icon: Gauge,
          label: 'Đà phong độ',
          value: data.prediction.winner.toUpperCase(),
          detail: 'Mạnh hơn trong 3 trận gần nhất',
          tone: 'purple',
        },
      ] satisfies ContextTile[],
    [data.prediction.winner],
  )

  const selectedAction = quickActions.find((action) => action.label === activeAction) ?? quickActions[0]
  const trend = formatTrend(winnerOutcome.trend)

  return (
    <div className={styles.page} id="matches">
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

      <section className={styles.heroCard} id="predictions" aria-label="Tổng quan dự đoán trận đấu">
        <div className={styles.matchStage}>
          <span className={clsx(styles.sideName, styles.sideNameHome)}>{data.match.homeTeam.name}</span>
          <span className={clsx(styles.sideName, styles.sideNameAway)}>{data.match.awayTeam.name}</span>

          <div className={clsx(styles.playerImage, styles.playerHome)}>
            <img src="/images/worldian-brazil-forward.png" alt="" aria-hidden="true" />
          </div>
          <div className={clsx(styles.playerImage, styles.playerAway)}>
            <img src="/images/worldian-france-forward.png" alt="" aria-hidden="true" />
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

      <section className={styles.analysisGrid} aria-label="Phân tích dự đoán">
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

      <section className={styles.bottomGrid} id="markets" aria-label="Bối cảnh trận đấu và công cụ mô hình">
        <section className={styles.contextPanel}>
          <div className={styles.panelHeader}>
            <h2>Bối cảnh trận đấu</h2>
          </div>
          <div className={styles.contextGrid}>
            {contextTiles.map((tile) => {
              const Icon = tile.icon

              return (
                <article key={tile.label}>
                  <Icon className={styles[tile.tone]} size={28} aria-hidden="true" />
                  <span>{tile.label}</span>
                  <strong>{tile.value}</strong>
                  <p>{tile.detail}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className={styles.flowPanel}>
          <div className={styles.panelHeader}>
            <h2>Dòng tiền thị trường</h2>
            <span className={styles.liveBadge}>
              <Zap size={13} aria-hidden="true" />
              Trực tiếp
            </span>
          </div>
          <div className={styles.marketFlow}>
            <span>33%</span>
            <div aria-label="Dòng tiền thị trường: 33 phần trăm Brazil, 67 phần trăm Pháp">
              <i />
            </div>
            <span>67%</span>
          </div>
          <div className={styles.flowLabels}>
            <span>{winnerOutcome.label}</span>
            <span>{awayOutcome.label}</span>
          </div>
          <div className={styles.moneyMove}>
            <span>Dịch chuyển tiền lớn nhất</span>
            <strong>
              <TrendingUp size={15} aria-hidden="true" />
              Pháp +8%
            </strong>
            <span>2 giờ qua</span>
          </div>
        </section>

        <section className={styles.modelPanel} id="insights">
          <div className={styles.panelHeader}>
            <h2>Nhận định mô hình</h2>
          </div>
          <div className={styles.modelCopy}>
            <BrainCircuit size={32} aria-hidden="true" />
            <p>{data.reasoning.description}</p>
          </div>
          <div className={styles.feedStack}>
            {visibleInsightCards.map((item) => (
              <article key={`${item.time}-${item.title}`}>
                <span>{item.time}</span>
                <p>{item.title}</p>
                <strong className={styles[item.tone]}>{item.impact}</strong>
              </article>
            ))}
          </div>
          <a href="#reason-heading">
            Cách mô hình hoạt động
            <ArrowRight size={15} aria-hidden="true" />
          </a>
        </section>

        <aside className={styles.actionsPanel} aria-label="Thao tác nhanh">
          <div className={styles.panelHeader}>
            <h2>Thao tác nhanh</h2>
          </div>
          <div className={styles.actionsList}>
            {quickActions.map((action) => {
              const Icon = action.icon

              return (
                <button
                  key={action.label}
                  type="button"
                  aria-pressed={activeAction === action.label}
                  onClick={() => setActiveAction(action.label)}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>{action.label}</span>
                </button>
              )
            })}
          </div>
          <p>
            <Info size={15} aria-hidden="true" />
            {selectedAction.detail}
          </p>
        </aside>
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
