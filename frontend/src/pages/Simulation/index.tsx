import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  GitBranch,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trophy,
} from 'lucide-react'

import { getWorldCupSimulation } from '@/api/worldcup'
import { ROUTES } from '@/constants/routes'
import { displayTeamName, getTeamIdentity } from '@/helpers/teamIdentity'
import { useSeoMeta } from '@/hooks/useSeoMeta'
import { localeForLanguage, type LanguageCode } from '@/i18n/languages'
import { useI18n } from '@/i18n/I18nProvider'
import type {
  SimulationTargetRound,
  WorldCupGroupQualificationScenario,
  WorldCupGroupSimulation,
  WorldCupScenarioOutcome,
  WorldCupSimulatedFixture,
  WorldCupSimulationResponse,
  WorldCupSimulationSlot,
  WorldCupTeamStanding,
} from '@/store/features/dashboard/apiTypes'

import styles from './Simulation.module.scss'

type SimulationStatus = 'error' | 'loading' | 'ready'

interface SimulationState {
  data?: WorldCupSimulationResponse
  error?: string
  status: SimulationStatus
}

const targetRoundOptions: Array<{ enabled: boolean; round: SimulationTargetRound }> = [
  { enabled: true, round: 'Round of 32' },
  { enabled: false, round: 'Round of 16' },
  { enabled: false, round: 'Quarter-final' },
  { enabled: false, round: 'Semi-final' },
  { enabled: false, round: 'Final' },
]

const pageCopy = {
  en: {
    advancing: 'Advancing',
    bracket: 'Possible fixtures',
    candidates: 'Candidates',
    empty: 'Simulation data is not available yet.',
    errorFallback: 'Unable to load simulation.',
    finalPath: 'Bracket path',
    generated: 'Generated',
    groups: 'Group scenarios',
    loading: 'Building tournament simulation...',
    noPairings: 'Pairings pending',
    possibleThird: 'Third-place candidates',
    refresh: 'Refresh',
    remaining: 'remaining',
    roundUnavailable: 'Not enough current information to simulate this round yet.',
    scenarioCount: (visible: number, total: number) => `${visible} of ${total} scenario sets`,
    subtitle:
      'Current standings, remaining group paths, and possible knockout pairings from the latest World Cup dataset.',
    table: {
      gd: 'GD',
      gf: 'GF',
      played: 'P',
      points: 'Pts',
      team: 'Team',
    },
    tieBreaker: 'Official tiebreaker may be needed',
    title: 'Simulation',
    topSeeds: 'Top seeds',
    truncatedPairings: (shown: number, total: number) => `${shown} shown from ${total}`,
  },
  vi: {
    advancing: 'Đi tiếp',
    bracket: 'Cặp đấu có thể xảy ra',
    candidates: 'Ứng viên',
    empty: 'Chưa có dữ liệu mô phỏng.',
    errorFallback: 'Không thể tải mô phỏng.',
    finalPath: 'Nhánh knockout',
    generated: 'Tạo lúc',
    groups: 'Kịch bản theo bảng',
    loading: 'Đang dựng mô phỏng giải đấu...',
    noPairings: 'Chưa xác định cặp đấu',
    possibleThird: 'Ứng viên hạng ba',
    refresh: 'Làm mới',
    remaining: 'trận còn lại',
    roundUnavailable: 'Hiện tại chưa đủ thông tin để mô phỏng vòng này.',
    scenarioCount: (visible: number, total: number) => `${visible} trong ${total} nhóm kịch bản`,
    subtitle:
      'Bảng xếp hạng hiện tại, các đường đi còn lại ở vòng bảng và những cặp knockout có thể xảy ra từ dữ liệu World Cup mới nhất.',
    table: {
      gd: 'HS',
      gf: 'BT',
      played: 'Đ',
      points: 'Điểm',
      team: 'Đội',
    },
    tieBreaker: 'Có thể cần tie-breaker chính thức',
    title: 'Mô phỏng',
    topSeeds: 'Seed dẫn đầu',
    truncatedPairings: (shown: number, total: number) => `Đang hiển thị ${shown} / ${total}`,
  },
} satisfies Record<LanguageCode, Record<string, unknown>>

const dateFormatters = {
  en: new Intl.DateTimeFormat(localeForLanguage('en'), {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
    hour12: false,
  }),
  vi: new Intl.DateTimeFormat(localeForLanguage('vi'), {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }),
} satisfies Record<LanguageCode, Intl.DateTimeFormat>

function typedCopy(language: LanguageCode) {
  return pageCopy[language] as typeof pageCopy.vi
}

function formatDate(value: string, language: LanguageCode) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatters[language].format(date)
}

function formatPercent(value: number, language: LanguageCode) {
  return new Intl.NumberFormat(localeForLanguage(language), {
    maximumFractionDigits: 0,
    style: 'percent',
  }).format(value)
}

function teamDisplayName(teamName: string, language: LanguageCode) {
  return displayTeamName(teamName, language)
}

function TeamChip({ compact = false, language, teamName }: {
  compact?: boolean
  language: LanguageCode
  teamName: string
}) {
  const team = getTeamIdentity(teamName, language)

  return (
    <span className={compact ? styles.teamChipCompact : styles.teamChip}>
      <img src={team.flagUrl} alt="" aria-hidden="true" loading="lazy" />
      <span>{team.displayName}</span>
    </span>
  )
}

function StandingTable({
  language,
  standings,
}: {
  language: LanguageCode
  standings: WorldCupTeamStanding[]
}) {
  const copy = typedCopy(language)

  return (
    <div className={styles.tableWrap}>
      <table className={styles.standingsTable}>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{copy.table.team}</th>
            <th scope="col">{copy.table.played}</th>
            <th scope="col">{copy.table.points}</th>
            <th scope="col">{copy.table.gd}</th>
            <th scope="col">{copy.table.gf}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing) => (
            <tr key={standing.team}>
              <td>{standing.position}</td>
              <td>
                <TeamChip compact language={language} teamName={standing.team} />
              </td>
              <td>{standing.played}</td>
              <td>{standing.points}</td>
              <td>{standing.goal_difference > 0 ? `+${standing.goal_difference}` : standing.goal_difference}</td>
              <td>{standing.goals_for}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatOutcome(outcome: WorldCupScenarioOutcome, language: LanguageCode) {
  if (outcome.outcome === 'draw') {
    return language === 'vi'
      ? `${teamDisplayName(outcome.team1, language)} hòa ${teamDisplayName(outcome.team2, language)}`
      : `${teamDisplayName(outcome.team1, language)} draw ${teamDisplayName(outcome.team2, language)}`
  }

  const winner = outcome.outcome === 'team1' ? outcome.team1 : outcome.team2
  return language === 'vi'
    ? `${teamDisplayName(winner, language)} thắng`
    : `${teamDisplayName(winner, language)} win`
}

function ScenarioRow({
  language,
  scenario,
  totalOutcomePaths,
}: {
  language: LanguageCode
  scenario: WorldCupGroupQualificationScenario
  totalOutcomePaths: number
}) {
  const copy = typedCopy(language)

  return (
    <article className={styles.scenarioRow}>
      <div className={styles.scenarioMain}>
        <div className={styles.scenarioHeading}>
          <strong>{scenario.title}</strong>
          <span>
            {scenario.outcome_count}/{totalOutcomePaths} · {formatPercent(scenario.outcome_share, language)}
          </span>
        </div>
        <div className={styles.seedLine} aria-label={copy.advancing}>
          <TeamChip language={language} teamName={scenario.first} />
          <TeamChip language={language} teamName={scenario.second} />
          <span className={styles.thirdSeed}>
            3rd <TeamChip compact language={language} teamName={scenario.third} />
          </span>
        </div>
        {scenario.outcomes.length > 0 ? (
          <div className={styles.outcomeList}>
            {scenario.outcomes.map((outcome) => (
              <span key={outcome.match_id}>{formatOutcome(outcome, language)}</span>
            ))}
          </div>
        ) : null}
      </div>

      {scenario.tie_breaker_required ? (
        <span className={styles.tieBreaker}>
          <ShieldAlert size={14} aria-hidden="true" />
          {copy.tieBreaker}
        </span>
      ) : null}
    </article>
  )
}

function CandidateLine({
  label,
  language,
  teams,
}: {
  label: string
  language: LanguageCode
  teams: string[]
}) {
  return (
    <div className={styles.candidateLine}>
      <span>{label}</span>
      <div>
        {teams.slice(0, 6).map((team) => (
          <TeamChip key={team} compact language={language} teamName={team} />
        ))}
        {teams.length > 6 ? <em>+{teams.length - 6}</em> : null}
      </div>
    </div>
  )
}

function GroupPanel({
  group,
  language,
}: {
  group: WorldCupGroupSimulation
  language: LanguageCode
}) {
  const copy = typedCopy(language)
  const visibleScenarios = group.scenarios.length

  return (
    <section className={styles.groupPanel} aria-labelledby={`simulation-${group.group}`}>
      <header className={styles.groupHeader}>
        <div>
          <h2 id={`simulation-${group.group}`}>{group.group}</h2>
          <p>
            {group.remaining_matches.length} {copy.remaining} ·{' '}
            {copy.scenarioCount(visibleScenarios, group.scenario_count)}
          </p>
        </div>
        <div className={styles.groupSummary} aria-label={copy.topSeeds}>
          {group.possible_winners.slice(0, 3).map((team) => (
            <TeamChip key={team} compact language={language} teamName={team} />
          ))}
        </div>
      </header>

      <StandingTable language={language} standings={group.standings} />

      <div className={styles.candidateBlock}>
        <CandidateLine label="1st" language={language} teams={group.possible_winners} />
        <CandidateLine label="2nd" language={language} teams={group.possible_runners_up} />
        <CandidateLine label="3rd" language={language} teams={group.possible_third_place} />
      </div>

      <div className={styles.scenarioList}>
        {group.scenarios.map((scenario) => (
          <ScenarioRow
            key={scenario.id}
            language={language}
            scenario={scenario}
            totalOutcomePaths={group.total_outcome_paths}
          />
        ))}
      </div>
    </section>
  )
}

function SlotView({
  language,
  slot,
}: {
  language: LanguageCode
  slot: WorldCupSimulationSlot
}) {
  if (slot.resolved_team) {
    return <TeamChip language={language} teamName={slot.resolved_team} />
  }

  return (
    <div className={styles.slotView}>
      <span>{slot.label}</span>
      <div>
        {slot.candidates.slice(0, 5).map((team) => (
          <TeamChip key={team} compact language={language} teamName={team} />
        ))}
        {slot.candidates.length > 5 ? <em>+{slot.candidates.length - 5}</em> : null}
      </div>
    </div>
  )
}

function FixturePanel({
  fixture,
  language,
}: {
  fixture: WorldCupSimulatedFixture
  language: LanguageCode
}) {
  const copy = typedCopy(language)
  const shownPairings = fixture.possible_pairings.slice(0, 8)

  return (
    <article className={styles.fixturePanel}>
      <header>
        <span>Match {fixture.match_number}</span>
        <strong>{fixture.date}</strong>
      </header>
      <div className={styles.fixtureTeams}>
        <SlotView language={language} slot={fixture.team1} />
        <span>vs</span>
        <SlotView language={language} slot={fixture.team2} />
      </div>
      <div className={styles.pairingList}>
        {shownPairings.length > 0 ? (
          shownPairings.map(([first, second]) => (
            <span key={`${first}-${second}`}>
              {teamDisplayName(first, language)} vs {teamDisplayName(second, language)}
            </span>
          ))
        ) : (
          <span>{copy.noPairings}</span>
        )}
      </div>
      {fixture.possible_pairing_count > shownPairings.length ? (
        <p>{copy.truncatedPairings(shownPairings.length, fixture.possible_pairing_count)}</p>
      ) : null}
    </article>
  )
}

export default function Simulation() {
  const { language } = useI18n()
  const copy = typedCopy(language)
  const [targetRound, setTargetRound] = useState<SimulationTargetRound>('Round of 32')
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState<SimulationState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    getWorldCupSimulation(
      {
        pairing_limit: 48,
        scenario_limit: 8,
        target_round: targetRound,
      },
      { signal: controller.signal },
    )
      .then((data) => {
        setState({ data, status: 'ready' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error: error instanceof Error ? error.message : copy.errorFallback,
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [copy.errorFallback, reloadKey, targetRound])

  const data = state.data
  const topThirdCandidates = useMemo(
    () => data?.third_place_candidates.slice(0, 12) ?? [],
    [data?.third_place_candidates],
  )

  const refreshSimulation = () => {
    setState((current) => ({ data: current.data, status: 'loading' }))
    setReloadKey((value) => value + 1)
  }

  const changeTargetRound = (round: SimulationTargetRound) => {
    if (round === targetRound) {
      return
    }

    setState((current) => ({ data: current.data, status: 'loading' }))
    setTargetRound(round)
  }

  useSeoMeta({
    canonicalPath: ROUTES.SIMULATION,
    description: copy.subtitle,
    title: language === 'vi'
      ? 'Mô phỏng kịch bản World Cup | Worldian'
      : 'World Cup Scenario Simulation | Worldian',
  })

  return (
    <div className={styles.page}>
      <section className={styles.headerPanel} aria-labelledby="simulation-heading">
        <div>
          <span className={styles.kicker}>
            <Activity size={15} aria-hidden="true" />
            Worldian
          </span>
          <h1 id="simulation-heading">{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <button
          className={styles.refreshButton}
          type="button"
          onClick={refreshSimulation}
          disabled={state.status === 'loading'}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {copy.refresh}
        </button>
      </section>

      <section className={styles.toolbar} aria-label={copy.finalPath}>
        {targetRoundOptions.map((option) => (
          <button
            key={option.round}
            aria-pressed={targetRound === option.round}
            disabled={!option.enabled}
            title={!option.enabled ? copy.roundUnavailable : undefined}
            type="button"
            onClick={() => changeTargetRound(option.round)}
          >
            {option.round}
          </button>
        ))}
      </section>

      {data ? (
        <dl className={styles.sourceStrip}>
          <div>
            <dt>{copy.generated}</dt>
            <dd>{formatDate(data.generated_at, language)}</dd>
          </div>
          <div>
            <dt>{copy.possibleThird}</dt>
            <dd>{data.third_place_candidates.length}</dd>
          </div>
        </dl>
      ) : null}

      {state.status === 'loading' ? (
        <div className={styles.statePanel} role="status">
          <Loader2 size={22} aria-hidden="true" />
          {copy.loading}
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className={styles.statePanel} role="alert">
          <AlertTriangle size={22} aria-hidden="true" />
          {state.error}
        </div>
      ) : null}

      {state.status === 'ready' && !data ? (
        <div className={styles.statePanel}>
          <Info size={22} aria-hidden="true" />
          {copy.empty}
        </div>
      ) : null}

      {data ? (
        <div className={styles.layout}>
          <section className={styles.groupsSection} aria-labelledby="groups-heading">
            <div className={styles.sectionHeader}>
              <div>
                <h2 id="groups-heading">{copy.groups}</h2>
                <p>{copy.subtitle}</p>
              </div>
              <Trophy size={20} aria-hidden="true" />
            </div>
            <div className={styles.groupGrid}>
              {data.groups.map((group) => (
                <GroupPanel key={group.group} group={group} language={language} />
              ))}
            </div>
          </section>

          <aside className={styles.bracketSection} aria-labelledby="bracket-heading">
            <div className={styles.sectionHeader}>
              <div>
                <h2 id="bracket-heading">{copy.bracket}</h2>
                <p>{data.target_round}</p>
              </div>
              <GitBranch size={20} aria-hidden="true" />
            </div>

            <div className={styles.thirdCandidates}>
              <strong>{copy.possibleThird}</strong>
              <div>
                {topThirdCandidates.map((team) => (
                  <TeamChip key={team} compact language={language} teamName={team} />
                ))}
              </div>
            </div>

            <div className={styles.bracketScroll}>
              <div className={styles.fixtureList}>
                {data.bracket.map((fixture) => (
                  <FixturePanel key={fixture.match_id} fixture={fixture} language={language} />
                ))}
              </div>

            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
