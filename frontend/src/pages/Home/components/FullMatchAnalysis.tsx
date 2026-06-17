import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ChevronDown,
  CloudRain,
  Radio,
  Scale,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react'
import clsx from 'clsx'

import type { TranslationCopy } from '@/i18n/translations'
import type { DashboardLiveStatus } from '@/store/features/dashboard/slice'
import type { DashboardData, EdgeSignal } from '@/store/features/dashboard/types'

import type { Tone } from '../types'
import styles from '../Home.module.scss'

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

interface FullMatchAnalysisProps {
  copy: TranslationCopy['home']
  data: DashboardData
  liveStatus: DashboardLiveStatus
  showProbabilityMovement: boolean
}

const fallbackMovementValues = [50, 51, 50, 52, 54, 53, 55, 54, 56, 52, 53, 52, 56, 55, 53, 54, 57, 55, 56, 58]
const fallbackMovementTicks = ['17:45', '18:00', '18:15', '18:30', '18:42']
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

function toEdgeFactors(signals: EdgeSignal[]): EdgeFactor[] {
  return signals.map((signal, index) => ({
    ...signal,
    icon: edgeSignalIcons[index % edgeSignalIcons.length],
  }))
}

export function FullMatchAnalysis({
  copy,
  data,
  liveStatus,
  showProbabilityMovement,
}: FullMatchAnalysisProps) {
  const winnerOutcome = data.prediction.outcomes[0]
  const drawOutcome = data.prediction.outcomes[1]
  const awayOutcome = data.prediction.outcomes[2]
  const edgeFactors = toEdgeFactors(data.edgeSignals)
  const trend = formatTrend(winnerOutcome.trend)
  const movementSeries = data.movement.length ? data.movement.map((point) => point.home) : fallbackMovementValues
  const movementTicks = data.movement.length ? data.movement.map((point) => point.label) : fallbackMovementTicks
  const openingProbability = movementSeries[0] ?? winnerOutcome.value
  const previousProbability = movementSeries.at(-2) ?? openingProbability
  const isDrawWinner = data.prediction.winner === copy.draw || data.prediction.winner === 'Hòa' || data.prediction.winner === 'Draw'
  const winnerStatement = isDrawWinner
    ? copy.draw
    : copy.winLabel(data.prediction.winner)
  const confidenceLevelLabel = data.prediction.confidenceLevel
    ? copy.confidence[data.prediction.confidenceLevel]
    : undefined

  return (
    <>
      <section className={styles.predictionDeck} id="prediction" aria-label={copy.mainPrediction}>
        <article className={styles.winnerPanel}>
          <div className={styles.panelHeader}>
            <h2>{copy.mainPrediction}</h2>
            <span className={styles.liveBadge} data-status={liveStatus}>
              <Zap size={13} aria-hidden="true" />
              {data.prediction.status}
            </span>
          </div>

          <div className={styles.winnerStatement}>
            <span>
              <Sparkles size={16} aria-hidden="true" />
              {copy.currentPick}
            </span>
            <strong>{winnerStatement}</strong>
            <p>{data.prediction.summary}</p>
          </div>

          <div className={styles.matchSignals} aria-label={copy.matchOverviewLabel}>
            {data.match.signals.map((signal) => (
              <div key={signal.label} data-tone={signal.tone}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
              </div>
            ))}
          </div>

          <div className={styles.winnerMetrics}>
            <div>
              <span>{copy.confidenceLabel}</span>
              <strong>
                {data.prediction.confidence.toFixed(1)}
                <small>/10</small>
              </strong>
              {confidenceLevelLabel ? <small>{confidenceLevelLabel}</small> : null}
            </div>
            {showProbabilityMovement ? (
              <div>
                <span>{copy.movementLabel}</span>
                <strong className={styles.green}>{trend}</strong>
                <small>{copy.trendWindow}</small>
              </div>
            ) : null}
          </div>
        </article>

        <aside className={styles.probabilityPanel} aria-label={copy.probabilityLabel}>
          <div className={styles.panelHeader}>
            <h2>{copy.probabilityTitle}</h2>
            <span className={styles.liveBadge} data-status={liveStatus}>
              <Radio size={13} aria-hidden="true" />
              {copy.liveRailStatusLabels[liveStatus]}
            </span>
          </div>
          <div className={styles.probabilityRows}>
            <ProbabilityBar label={winnerOutcome.label} value={winnerOutcome.value} tone="green" />
            <ProbabilityBar label={drawOutcome.label} value={drawOutcome.value} tone="gray" />
            <ProbabilityBar label={awayOutcome.label} value={awayOutcome.value} tone="blue" />
          </div>
          <div className={styles.confidenceLine}>
            <span>
              {copy.modelConfidence}: {data.prediction.confidence.toFixed(1)} / 10
              {confidenceLevelLabel ? ` · ${confidenceLevelLabel}` : ''}
            </span>
            <div aria-hidden="true">
              {Array.from({ length: 10 }).map((_, index) => (
                <i key={index} className={index < Math.round(data.prediction.confidence) ? styles.filled : undefined} />
              ))}
            </div>
            {data.prediction.confidenceRationale ? (
              <p className={styles.confidenceRationale}>{data.prediction.confidenceRationale}</p>
            ) : null}
          </div>
        </aside>
      </section>

      <section className={styles.reasoningSection} id="analysis" aria-label={copy.analysisLabel}>
        <div className={styles.sectionIntro}>
          <h2>{copy.reasoningTitle(data.prediction.winner)}</h2>
          <p>{copy.reasoningIntro}</p>
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
                  <span>{copy.impact[point.impact]}</span>
                  <h4>{point.title}</h4>
                  <p>{point.detail}</p>
                </article>
              ))}
            </div>
          </article>

          <aside className={styles.edgePanel} aria-label={copy.edgePanelLabel}>
            <div className={styles.panelHeader}>
              <h3>{copy.edgePanelLabel}</h3>
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
              <span>{copy.netEdge}</span>
              <strong>{data.netEdge}</strong>
            </div>
          </aside>
        </div>
      </section>

      {showProbabilityMovement ? (
        <section className={styles.liveSection} aria-label={copy.movementLabel}>
          <section className={styles.movementPanel} aria-labelledby="movement-heading">
            <div className={styles.panelHeader}>
              <h2 id="movement-heading">{copy.movementTitle}</h2>
              <button type="button">
                {copy.chartRange}
                <ChevronDown size={15} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.movementSubject}>
              <img src={data.match.homeTeam.flagUrl} alt="" aria-hidden="true" />
              <strong>{copy.winProbabilitySubject(winnerOutcome.label)}</strong>
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
                {movementTicks.map((tick) => <span key={tick}>{tick}</span>)}
              </div>
            </div>
            <div className={styles.movementStats}>
              <div>
                <span>{copy.openingLine}</span>
                <strong>{openingProbability}%</strong>
              </div>
              <div>
                <span>{copy.previous}</span>
                <strong>{previousProbability}%</strong>
              </div>
              <div>
                <span>{copy.current}</span>
                <strong>{winnerOutcome.value}%</strong>
              </div>
            </div>
          </section>
        </section>
      ) : null}
    </>
  )
}
