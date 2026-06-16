import { CalendarClock, MapPin, Radio, Trophy } from 'lucide-react'

import type { MatchInfo, Team } from '@/store/features/dashboard/types'

import styles from './MatchHero.module.scss'

interface MatchHeroProps {
  match: MatchInfo
}

function TeamBlock({ team, side }: { team: Team; side: 'home' | 'away' }) {
  return (
    <div className={styles.teamBlock}>
      <div className={styles.flagFrame}>
        <img src={team.flagUrl} alt={`Cờ ${team.name}`} />
      </div>
      <div className={styles.teamCopy}>
        <span>{side === 'home' ? 'Đội chủ nhà theo mô hình' : 'Đội khách theo mô hình'}</span>
        <h2>{team.name}</h2>
        <div className={styles.formRow} aria-label={`Phong độ gần đây của ${team.name}`}>
          {team.form.map((result, index) => (
            <span key={`${team.shortName}-${result}-${index}`} data-result={result}>
              {result}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MatchHero({ match }: MatchHeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="match-title">
      <div className={styles.context}>
        <span className={styles.pill}>
          <Trophy size={15} aria-hidden="true" />
          {match.competition}
        </span>
        <span>{match.round}</span>
      </div>

      <div className={styles.matchup}>
        <TeamBlock team={match.homeTeam} side="home" />
        <div className={styles.versus}>
          <span>vs</span>
        </div>
        <TeamBlock team={match.awayTeam} side="away" />
      </div>

      <h1 id="match-title" className={styles.title}>
        {match.homeTeam.name} vs {match.awayTeam.name}
      </h1>

      <div className={styles.signalGrid} aria-label="Tín hiệu live của mô hình">
        {match.signals.map((signal) => (
          <div key={signal.label} className={styles.signal} data-tone={signal.tone}>
            <Radio size={15} aria-hidden="true" />
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </div>
        ))}
      </div>

      <div className={styles.metaGrid}>
        <div>
          <CalendarClock size={17} aria-hidden="true" />
          <span>{match.kickoff}</span>
        </div>
        <div>
          <MapPin size={17} aria-hidden="true" />
          <span>
            {match.stadium}, {match.city}
          </span>
        </div>
      </div>
    </section>
  )
}
