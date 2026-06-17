import type { CSSProperties } from 'react'
import { BrainCircuit, Clock3, TrendingDown, TrendingUp } from 'lucide-react'
import clsx from 'clsx'

import type { PredictionInfo, TrendDirection } from '@/store/features/dashboard/types'

import styles from './PredictionCard.module.scss'

interface PredictionCardProps {
  prediction: PredictionInfo
}

const trendIcon = {
  up: TrendingUp,
  down: TrendingDown,
  flat: TrendingUp,
} satisfies Record<TrendDirection, typeof TrendingUp>

export function PredictionCard({ prediction }: PredictionCardProps) {
  const confidencePercent = Math.round(prediction.confidence * 10)

  return (
    <section className={styles.card} aria-labelledby="prediction-title">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Nhận định trận đấu</span>
          <h2 id="prediction-title">Nghiêng về {prediction.winner}</h2>
        </div>
        <div
          className={styles.confidence}
          style={{ '--confidence': `${confidencePercent}%` } as CSSProperties}
          aria-label={`Độ tin cậy ${prediction.confidence} trên 10`}
        >
          <span>{prediction.confidence.toFixed(1)}</span>
          <small>/10</small>
        </div>
      </div>

      <p className={styles.summary}>{prediction.summary}</p>

      <div className={styles.outcomes}>
        {prediction.outcomes.map((outcome) => {
          const Icon = trendIcon[outcome.direction]

          return (
            <div key={outcome.id} className={styles.outcome}>
              <div className={styles.outcomeMeta}>
                <span>{outcome.label}</span>
                <strong>{outcome.value}%</strong>
              </div>
              <div className={styles.barTrack} aria-hidden="true">
                <span style={{ width: `${outcome.value}%` }} />
              </div>
              <div className={clsx(styles.trend, styles[outcome.direction])}>
                <Icon size={15} aria-hidden="true" />
                <span>
                  {outcome.trend > 0 ? '+' : ''}
                  {outcome.trend.toFixed(1)} điểm
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.footer}>
        <span>
          <BrainCircuit size={15} aria-hidden="true" />
          Mô hình {prediction.status}
        </span>
        <span>
          <Clock3 size={15} aria-hidden="true" />
          Cập nhật {prediction.lastUpdated}
        </span>
      </div>
    </section>
  )
}
