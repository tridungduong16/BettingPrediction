import type { TranslationCopy } from '@/i18n/translations'
import type { DashboardLiveStatus } from '@/store/features/dashboard/slice'
import type { FeedItem, MatchInfo } from '@/store/features/dashboard/types'

import { formatTimelineTime } from '../timeline'
import styles from './LiveRail.module.scss'

interface LiveRailProps {
  copy: TranslationCopy['home']
  items: FeedItem[]
  liveScore: string
  liveStatus: DashboardLiveStatus
  match: MatchInfo
  subtitle: string
}

export function LiveRail({
  copy,
  items,
  liveScore,
  liveStatus,
  match,
  subtitle,
}: LiveRailProps) {
  return (
    <aside className={styles.liveRail} aria-label={copy.liveRailLabel}>
      <div className={styles.liveRailHeader}>
        <div>
          <h2>{copy.liveRailLabel}</h2>
          <p>{subtitle}</p>
        </div>
        <span data-status={liveStatus}>{copy.liveRailStatusLabels[liveStatus]}</span>
      </div>

      <div className={styles.liveScoreStrip}>
        <span>{match.homeTeam.shortName}</span>
        <strong>{liveScore}</strong>
        <span>{match.awayTeam.shortName}</span>
      </div>

      {items.length ? (
        <div className={styles.timelineStack}>
          {items.map((item) => (
            <article key={item.id}>
              <time>{formatTimelineTime(item.time, copy.now, copy.minute)}</time>
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <strong>{copy.feedType[item.type]}</strong>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.timelineEmpty}>{copy.liveScoreEmpty}</p>
      )}
    </aside>
  )
}
