import clsx from 'clsx'
import { ShieldCheck } from 'lucide-react'

import { SectionHeader } from '@/components/Common/SectionHeader'
import type { ReasoningInfo } from '@/store/features/dashboard/types'

import styles from './ReasoningPanel.module.scss'

interface ReasoningPanelProps {
  reasoning: ReasoningInfo
}

const impactLabels: Record<ReasoningInfo['points'][number]['impact'], string> = {
  high: 'Cao',
  low: 'Thấp',
  medium: 'Trung bình',
}

export function ReasoningPanel({ reasoning }: ReasoningPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="reasoning-title">
      <SectionHeader
        eyebrow="Vì sao mô hình dịch chuyển"
        title="Lập luận trước khi phân tích"
        description={reasoning.description}
      />

      <div className={styles.headline}>
        <ShieldCheck size={20} aria-hidden="true" />
        <p id="reasoning-title">{reasoning.headline}</p>
      </div>

      <div className={styles.points}>
        {reasoning.points.map((point) => (
          <article key={point.id} className={styles.point}>
            <div className={styles.pointHeader}>
              <h3>{point.title}</h3>
              <span className={clsx(styles.impact, styles[point.impact])}>
                {impactLabels[point.impact]}
              </span>
            </div>
            <p>{point.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
