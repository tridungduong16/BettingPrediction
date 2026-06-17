import type { LucideIcon } from 'lucide-react'
import { BarChart3, BrainCircuit, Goal, Newspaper, RectangleHorizontal, Repeat2, ScanSearch, UsersRound } from 'lucide-react'

import type { FeedItem } from '@/store/features/dashboard/types'

import styles from './AiFeed.module.scss'

interface AiFeedProps {
  items: FeedItem[]
}

const feedIcons: Record<FeedItem['type'], LucideIcon> = {
  card: RectangleHorizontal,
  goal: Goal,
  model: BrainCircuit,
  news: Newspaper,
  market: BarChart3,
  lineup: UsersRound,
  substitution: Repeat2,
  var: ScanSearch,
}

export function AiFeed({ items }: AiFeedProps) {
  return (
    <section id="feed" className={styles.panel} aria-labelledby="feed-title">
      <div className={styles.header}>
        <span>Nhịp cập nhật</span>
        <h2 id="feed-title">Những thay đổi gần đây</h2>
      </div>

      <div className={styles.feedList}>
        {items.map((item) => {
          const Icon = feedIcons[item.type]

          return (
            <article key={item.id} className={styles.feedItem}>
              <div className={styles.icon}>
                <Icon size={16} aria-hidden="true" />
              </div>
              <div>
                <span>{item.time}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
