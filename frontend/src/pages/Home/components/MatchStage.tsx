import clsx from 'clsx'

import type { MatchInfo, Team } from '@/store/features/dashboard/types'

import styles from './MatchStage.module.scss'

interface MatchStageProps {
  match: MatchInfo
  overviewLabel: string
}

function TeamHeadline({ team, className }: { team: Team; className?: string }) {
  return (
    <span className={clsx(styles.teamBlock, className)}>
      <img src={team.flagUrl} alt={`Cờ ${team.name}`} />
      <span className={styles.teamCopy}>
        <strong>{team.name}</strong>
        <span>{team.shortName}</span>
      </span>
    </span>
  )
}

export function MatchStage({ match, overviewLabel }: MatchStageProps) {
  return (
    <section
      className={styles.heroCard}
      id="matches"
      aria-label={`${overviewLabel}: ${match.homeTeam.name} vs ${match.awayTeam.name}`}
    >
      <div className={styles.matchStage}>
        <div className={styles.stageHeader}>
          <span>
            {match.stadium}, {match.city}
          </span>
          <strong>{match.kickoff}</strong>
        </div>

        <h1 className={styles.teamDeck} id="match-stage-title">
          <TeamHeadline team={match.homeTeam} className={styles.teamHome} />
          <div className={styles.matchCenter}>
            <span>{match.competition}</span>
            <strong>VS</strong>
            <em>{match.round}</em>
          </div>
          <TeamHeadline team={match.awayTeam} className={styles.teamAway} />
        </h1>
      </div>
    </section>
  )
}
