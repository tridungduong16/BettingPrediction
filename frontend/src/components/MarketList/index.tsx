import { Gauge, Target } from 'lucide-react'
import clsx from 'clsx'

import { SectionHeader } from '@/components/Common/SectionHeader'
import { useAppDispatch, useAppSelector } from '@/hooks/store'
import { selectSelectedMarket } from '@/store/features/dashboard/selectors'
import { dashboardActions } from '@/store/features/dashboard/slice'
import type { MarketInfo } from '@/store/features/dashboard/types'

import styles from './MarketList.module.scss'

interface MarketListProps {
  markets: MarketInfo[]
}

const riskLabels: Record<MarketInfo['risk'], string> = {
  High: 'Cao',
  Low: 'Thấp',
  Medium: 'Trung bình',
}

export function MarketList({ markets }: MarketListProps) {
  const dispatch = useAppDispatch()
  const selectedMarket = useAppSelector(selectSelectedMarket)

  return (
    <section id="markets" className={styles.panel} aria-labelledby="markets-title">
      <SectionHeader
        eyebrow="Kèo dự đoán"
        title="Tín hiệu thị trường"
        description="Các kèo mà xác suất của mô hình hiện khác với giá đồng thuận của thị trường."
      />

      <div className={styles.marketGrid}>
        {markets.map((market) => {
          const isSelected = market.id === selectedMarket?.id

          return (
            <button
              key={market.id}
              className={clsx(styles.marketCard, isSelected && styles.selected)}
              type="button"
              onClick={() => dispatch(dashboardActions.selectMarket(market.id))}
            >
              <span className={styles.cardTop}>
                <span className={styles.marketName}>{market.name}</span>
                <span className={styles.risk} data-risk={market.risk.toLowerCase()}>
                  {riskLabels[market.risk]}
                </span>
              </span>
              <span className={styles.metricRow}>
                <strong>{market.probability}%</strong>
                <span>
                  <Target size={14} aria-hidden="true" />
                  +{market.edge.toFixed(1)} lợi thế
                </span>
              </span>
              <span className={styles.signal}>{market.signal}</span>
            </button>
          )
        })}
      </div>

      {selectedMarket ? (
        <div className={styles.detail}>
          <div className={styles.detailIcon}>
            <Gauge size={18} aria-hidden="true" />
          </div>
          <div>
            <span>Kèo đang chọn</span>
            <h3>{selectedMarket.name}</h3>
            <p>{selectedMarket.detail}</p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
