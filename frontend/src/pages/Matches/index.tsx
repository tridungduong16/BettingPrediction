import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Trophy,
  Users,
} from 'lucide-react'

import { getWorldCupMatches } from '@/api/worldcup'
import { ROUTES, matchDetailPath } from '@/constants/routes'
import { displayTeamName, getTeamIdentity } from '@/helpers/teamIdentity'
import { useSeoMeta } from '@/hooks/useSeoMeta'
import { localeForLanguage, type LanguageCode } from '@/i18n/languages'
import { useI18n } from '@/i18n/I18nProvider'
import type { WorldCupDataset, WorldCupMatch } from '@/store/features/dashboard/apiTypes'

import styles from './Matches.module.scss'

type MatchesStatus = 'error' | 'loading' | 'ready'

interface MatchesState {
  dataset?: WorldCupDataset
  error?: string
  loadedAtMs?: number
  status: MatchesStatus
}

const dateFormatters = {
  en: {
    matchDay: new Intl.DateTimeFormat(localeForLanguage('en'), {
      day: '2-digit',
      month: 'short',
      weekday: 'long',
      year: 'numeric',
    }),
    matchTime: new Intl.DateTimeFormat(localeForLanguage('en'), {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    sourceTime: new Intl.DateTimeFormat(localeForLanguage('en'), {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
      hour12: false,
    }),
  },
  vi: {
    matchDay: new Intl.DateTimeFormat(localeForLanguage('vi'), {
      day: '2-digit',
      month: '2-digit',
      weekday: 'long',
      year: 'numeric',
    }),
    matchTime: new Intl.DateTimeFormat(localeForLanguage('vi'), {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    sourceTime: new Intl.DateTimeFormat(localeForLanguage('vi'), {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false,
    }),
  },
} satisfies Record<LanguageCode, Record<'matchDay' | 'matchTime' | 'sourceTime', Intl.DateTimeFormat>>

const calendarDatePattern = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/

function getKickoffDate(match: WorldCupMatch) {
  if (!match.kickoff_utc) {
    return undefined
  }

  const date = new Date(match.kickoff_utc)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function getAnalysisDate(match: WorldCupMatch) {
  const kickoff = getKickoffDate(match)

  if (kickoff) {
    return kickoff
  }

  const matchDate = calendarDatePattern.exec(match.date)

  if (matchDate?.groups) {
    const year = Number(matchDate.groups.year)
    const month = Number(matchDate.groups.month)
    const day = Number(matchDate.groups.day)
    return new Date(year, month - 1, day)
  }

  const date = new Date(match.date)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function getAnalysisCutoffTime(referenceDate = new Date()) {
  const cutoff = new Date(referenceDate)
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() + 2)
  return cutoff.getTime()
}

function getVisibleMatchStartTime(referenceDate = new Date()) {
  const startOfDay = new Date(referenceDate)
  startOfDay.setHours(0, 0, 0, 0)
  return startOfDay.getTime()
}

function canOpenMatchAnalysis(match: WorldCupMatch) {
  const analysisDate = getAnalysisDate(match)
  return analysisDate ? analysisDate.getTime() < getAnalysisCutoffTime() : false
}

function getSourceSchedule(match: WorldCupMatch, noTimeLabel: string) {
  return [match.date, match.time].filter(Boolean).join(' - ') || noTimeLabel
}

function formatLocalDate(match: WorldCupMatch, language: LanguageCode, noDateLabel: string) {
  const kickoff = getKickoffDate(match)
  return kickoff ? dateFormatters[language].matchDay.format(kickoff) : match.date || noDateLabel
}

function formatLocalTime(match: WorldCupMatch, language: LanguageCode, noTimeLabel: string) {
  const kickoff = getKickoffDate(match)
  return kickoff ? dateFormatters[language].matchTime.format(kickoff) : match.time || noTimeLabel
}

function getSortValue(match: WorldCupMatch) {
  const parsedDate = Date.parse(match.date)
  return getKickoffDate(match)?.getTime() ?? (Number.isNaN(parsedDate) ? Number.MAX_SAFE_INTEGER : parsedDate)
}

function groupMatchesByDate(matches: WorldCupMatch[], language: LanguageCode, noDateLabel: string) {
  return matches.reduce<Array<{ dateLabel: string; matches: WorldCupMatch[] }>>((groups, match) => {
    const dateLabel = formatLocalDate(match, language, noDateLabel)
    const existingGroup = groups.find((group) => group.dateLabel === dateLabel)

    if (existingGroup) {
      existingGroup.matches.push(match)
      return groups
    }

    groups.push({ dateLabel, matches: [match] })
    return groups
  }, [])
}

function normalizeSearch(value: string, language: LanguageCode) {
  return value.trim().toLocaleLowerCase(localeForLanguage(language))
}

function matchSearchText(match: WorldCupMatch, language: LanguageCode) {
  return [
    match.team1,
    match.team2,
    displayTeamName(match.team1, language),
    displayTeamName(match.team2, language),
    match.group,
    match.round,
    match.ground,
    match.city,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase(localeForLanguage(language))
}

function TeamLabel({ teamName, language }: { language: LanguageCode; teamName: string }) {
  const team = getTeamIdentity(teamName, language)

  return (
    <span className={styles.teamLabel}>
      <img src={team.flagUrl} alt="" aria-hidden="true" loading="lazy" />
      <strong>{team.displayName}</strong>
    </span>
  )
}

function MatchAnalysisAction({ className, match }: { className?: string; match: WorldCupMatch }) {
  const { copy } = useI18n()
  const available = canOpenMatchAnalysis(match)

  if (!available) {
    return (
      <button
        aria-disabled="true"
        aria-label={copy.matches.analysisUnavailableLabel}
        className={className}
        disabled
        title={copy.matches.analysisUnavailableTitle}
        type="button"
      >
        {copy.matches.openAnalysis}
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    )
  }

  return (
    <Link aria-label={copy.matches.analysisAvailableLabel} className={className} to={matchDetailPath(match.id)}>
      {copy.matches.openAnalysis}
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  )
}

export default function Matches() {
  const { copy, language } = useI18n()
  const [state, setState] = useState<MatchesState>({ status: 'loading' })
  const [search, setSearch] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getWorldCupMatches({}, { signal: controller.signal })
      .then((dataset) => {
        setState({ dataset, loadedAtMs: Date.now(), status: 'ready' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error: error instanceof Error ? error.message : copy.matches.errorFallback,
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [copy.matches.errorFallback, reloadKey])

  const visibleMatches = useMemo(() => {
    const referenceDate = state.loadedAtMs ? new Date(state.loadedAtMs) : new Date()
    const earliestVisibleMatchTime = getVisibleMatchStartTime(referenceDate)
    const query = normalizeSearch(search, language)

    return (state.dataset?.matches ?? [])
      .filter((match) => {
        const matchDate = getAnalysisDate(match)
        return !matchDate || matchDate.getTime() >= earliestVisibleMatchTime
      })
      .filter((match) => !query || matchSearchText(match, language).includes(query))
      .sort((first, second) => getSortValue(first) - getSortValue(second))
  }, [language, search, state.dataset, state.loadedAtMs])

  const groupedMatches = useMemo(
    () => groupMatchesByDate(visibleMatches, language, copy.matches.noDate),
    [copy.matches.noDate, language, visibleMatches],
  )
  const source = state.dataset?.source

  useSeoMeta({
    canonicalPath: ROUTES.HOME,
    description: language === 'vi'
      ? 'Theo dõi lịch trận World Cup hiện tại và sắp diễn ra, tìm trận đấu và mở phân tích dự đoán AI từ Worldian.'
      : 'Track current and upcoming World Cup matches, search the schedule, and open Worldian AI prediction analysis.',
    title: language === 'vi'
      ? 'Lịch trận World Cup và dự đoán AI | Worldian'
      : 'World Cup Match Schedule and AI Predictions | Worldian',
  })

  const refreshMatches = () => {
    setState((current) => ({
      dataset: current.dataset,
      status: 'loading',
    }))
    setReloadKey((value) => value + 1)
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="matches-heading">
        <video
          aria-hidden="true"
          autoPlay
          className={styles.heroVideo}
          loop
          muted
          playsInline
          preload="metadata"
        >
          <source media="(max-width: 720px)" src="/background_vertical.mp4" type="video/mp4" />
          <source src="/background3.mp4" type="video/mp4" />
        </video>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>
            <Trophy size={15} aria-hidden="true" />
            {copy.matches.worldCup(source?.year ?? 2026)}
          </span>
          <h1 id="matches-heading">{copy.matches.title}</h1>
          <p>
            {source ? copy.matches.sourceSummary(visibleMatches.length) : copy.matches.loading}
          </p>
        </div>
      </section>

      <section className={styles.toolbar} aria-label={copy.matches.toolbarLabel}>
        <label className={styles.searchBox}>
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">{copy.matches.searchLabel}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.matches.searchPlaceholder}
          />
        </label>
        <button
          className={styles.refreshButton}
          type="button"
          onClick={refreshMatches}
          disabled={state.status === 'loading'}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {copy.matches.refresh}
        </button>
      </section>

      {source ? (
        <dl className={styles.sourceStrip} aria-label={copy.matches.sourceScheduleLabel}>
          <div>
            <dt>{copy.matches.sourceTotal}</dt>
            <dd>{source.match_count}</dd>
          </div>
          <div>
            <dt>{copy.matches.sourceLoaded}</dt>
            <dd>{dateFormatters[language].sourceTime.format(new Date(source.fetched_at))}</dd>
          </div>
        </dl>
      ) : null}

      {state.status === 'loading' ? (
        <div className={styles.statePanel} role="status">
          <Loader2 size={22} aria-hidden="true" />
          {copy.matches.loading}
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className={styles.statePanel} role="alert">
          <AlertTriangle size={22} aria-hidden="true" />
          {state.error}
        </div>
      ) : null}

      {state.status === 'ready' && groupedMatches.length === 0 ? (
        <div className={styles.statePanel}>
          <CalendarDays size={22} aria-hidden="true" />
          {copy.matches.empty}
        </div>
      ) : null}

      <div className={styles.matchGroups}>
        {groupedMatches.map((group) => (
          <section key={group.dateLabel} className={styles.matchGroup} aria-labelledby={`date-${group.dateLabel}`}>
            <h2 id={`date-${group.dateLabel}`}>{group.dateLabel}</h2>
            <div className={styles.matchList}>
              {group.matches.map((match) => (
                <article key={match.id} className={styles.matchCard}>
                  <div className={styles.matchTime}>
                    <Clock3 size={16} aria-hidden="true" />
                    <strong>{formatLocalTime(match, language, copy.matches.noTime)}</strong>
                    <span>{getSourceSchedule(match, copy.matches.noTime)}</span>
                  </div>

                  <div className={styles.matchMain}>
                    <div className={styles.teams}>
                      <TeamLabel teamName={match.team1} language={language} />
                      <span className={styles.vsLabel}>{copy.matches.vs}</span>
                      <TeamLabel teamName={match.team2} language={language} />
                    </div>
                    <div className={styles.matchMeta}>
                      <span>
                        <Users size={14} aria-hidden="true" />
                        {match.group ?? match.round}
                      </span>
                      <span>
                        <MapPin size={14} aria-hidden="true" />
                        {match.ground ?? match.city ?? copy.matches.cityFallback}
                      </span>
                    </div>
                  </div>

                  <MatchAnalysisAction className={styles.matchAction} match={match} />
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
