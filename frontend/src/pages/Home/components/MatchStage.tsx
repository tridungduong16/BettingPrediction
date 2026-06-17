import clsx from 'clsx'

import type { MatchInfo } from '@/store/features/dashboard/types'

import styles from './MatchStage.module.scss'

interface MatchStageProps {
  match: MatchInfo
  overviewLabel: string
}

export function MatchStage({ match, overviewLabel }: MatchStageProps) {
  return (
    <section className={styles.heroCard} id="matches" aria-label={overviewLabel}>
      <div className={styles.matchStage}>
        <span className={clsx(styles.sideName, styles.sideNameHome)}>{match.homeTeam.name}</span>
        <span className={clsx(styles.sideName, styles.sideNameAway)}>{match.awayTeam.name}</span>

        <div className={clsx(styles.playerImage, styles.playerHome)}>
          <img src="/images/worldian-generic-home-athlete.png" alt="" aria-hidden="true" />
        </div>
        <div className={clsx(styles.playerImage, styles.playerAway)}>
          <img src="/images/worldian-generic-away-athlete.png" alt="" aria-hidden="true" />
        </div>

        <div className={styles.stageHeader}>
          <strong>{match.round}</strong>
          <span>
            {match.stadium}, {match.city}
          </span>
          <em>{match.kickoff}</em>
        </div>

        <div className={styles.teamDeck}>
          <div className={clsx(styles.teamBlock, styles.teamHome)}>
            <img src={match.homeTeam.flagUrl} alt={`Cờ ${match.homeTeam.name}`} />
            <h1>{match.homeTeam.name}</h1>
            <span>{match.homeTeam.shortName}</span>
          </div>

          <div className={styles.matchCenter}>
            <span>{match.competition}</span>
            <strong>VS</strong>
            <em>{match.round}</em>
          </div>

          <div className={clsx(styles.teamBlock, styles.teamAway)}>
            <img src={match.awayTeam.flagUrl} alt={`Cờ ${match.awayTeam.name}`} />
            <h2>{match.awayTeam.name}</h2>
            <span>{match.awayTeam.shortName}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
