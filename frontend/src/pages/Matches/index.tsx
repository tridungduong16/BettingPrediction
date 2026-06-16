import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
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
import { ROUTES } from '@/constants/routes'
import type { WorldCupDataset, WorldCupMatch } from '@/store/features/dashboard/apiTypes'

import styles from './Matches.module.scss'

type MatchesStatus = 'error' | 'loading' | 'ready'

interface MatchesState {
  dataset?: WorldCupDataset
  error?: string
  loadedAtMs?: number
  status: MatchesStatus
}

const matchDayFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  weekday: 'long',
  year: 'numeric',
})

const matchTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const sourceTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour12: false,
})

function getKickoffDate(match: WorldCupMatch) {
  if (!match.kickoff_utc) {
    return undefined
  }

  const date = new Date(match.kickoff_utc)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function getSourceSchedule(match: WorldCupMatch) {
  return [match.date, match.time].filter(Boolean).join(' - ') || 'Chưa có giờ'
}

function formatLocalDate(match: WorldCupMatch) {
  const kickoff = getKickoffDate(match)
  return kickoff ? matchDayFormatter.format(kickoff) : match.date || 'Chưa có ngày'
}

function formatLocalTime(match: WorldCupMatch) {
  const kickoff = getKickoffDate(match)
  return kickoff ? matchTimeFormatter.format(kickoff) : match.time || 'Chưa có giờ'
}

function getSortValue(match: WorldCupMatch) {
  const parsedDate = Date.parse(match.date)
  return getKickoffDate(match)?.getTime() ?? (Number.isNaN(parsedDate) ? Number.MAX_SAFE_INTEGER : parsedDate)
}

function groupMatchesByDate(matches: WorldCupMatch[]) {
  return matches.reduce<Array<{ dateLabel: string; matches: WorldCupMatch[] }>>((groups, match) => {
    const dateLabel = formatLocalDate(match)
    const existingGroup = groups.find((group) => group.dateLabel === dateLabel)

    if (existingGroup) {
      existingGroup.matches.push(match)
      return groups
    }

    groups.push({ dateLabel, matches: [match] })
    return groups
  }, [])
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('vi-VN')
}

function matchSearchText(match: WorldCupMatch) {
  return [
    match.team1,
    match.team2,
    match.group,
    match.round,
    match.ground,
    match.city,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('vi-VN')
}

export default function Matches() {
  const [state, setState] = useState<MatchesState>({ status: 'loading' })
  const [search, setSearch] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getWorldCupMatches({ status: 'scheduled' }, { signal: controller.signal })
      .then((dataset) => {
        setState({ dataset, loadedAtMs: Date.now(), status: 'ready' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error: error instanceof Error ? error.message : 'Không thể tải lịch trận.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [reloadKey])

  const upcomingMatches = useMemo(() => {
    const now = state.loadedAtMs ?? 0
    const query = normalizeSearch(search)

    return (state.dataset?.matches ?? [])
      .filter((match) => {
        const kickoff = getKickoffDate(match)
        return !kickoff || kickoff.getTime() >= now
      })
      .filter((match) => !query || matchSearchText(match).includes(query))
      .sort((first, second) => getSortValue(first) - getSortValue(second))
  }, [search, state.dataset, state.loadedAtMs])

  const groupedMatches = useMemo(() => groupMatchesByDate(upcomingMatches), [upcomingMatches])
  const nextMatch = upcomingMatches[0]
  const source = state.dataset?.source
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
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>
            <Trophy size={15} aria-hidden="true" />
            World Cup {source?.year ?? 2026}
          </span>
          <h1 id="matches-heading">Lịch trận sắp diễn ra</h1>
          <p>
            {source
              ? `${upcomingMatches.length} trận từ backend, nguồn ${source.source_name}.`
              : 'Đang tải lịch trận từ backend.'}
          </p>
        </div>

        <div className={styles.heroPanel} aria-label="Trận tiếp theo">
          <span>Trận tiếp theo</span>
          {nextMatch ? (
            <>
              <strong>
                {nextMatch.team1} vs {nextMatch.team2}
              </strong>
              <div>
                <CalendarClock size={16} aria-hidden="true" />
                {formatLocalDate(nextMatch)} - {formatLocalTime(nextMatch)}
              </div>
              <Link to={`${ROUTES.PREDICTION_ANALYSIS}?matchId=${encodeURIComponent(nextMatch.id)}`}>
                Mở phân tích & dự đoán
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <strong>Chưa có trận phù hợp</strong>
          )}
        </div>
      </section>

      <section className={styles.toolbar} aria-label="Bộ lọc lịch trận">
        <label className={styles.searchBox}>
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Tìm trận đấu</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm đội, bảng, vòng, sân..."
          />
        </label>
        <button
          className={styles.refreshButton}
          type="button"
          onClick={refreshMatches}
          disabled={state.status === 'loading'}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Làm mới
        </button>
      </section>

      {source ? (
        <dl className={styles.sourceStrip} aria-label="Thông tin nguồn dữ liệu">
          <div>
            <dt>Tổng trận backend</dt>
            <dd>{source.match_count}</dd>
          </div>
          <div>
            <dt>Cập nhật</dt>
            <dd>{sourceTimeFormatter.format(new Date(source.fetched_at))}</dd>
          </div>
          <div>
            <dt>Cache</dt>
            <dd>{source.stale_cache ? 'cache cũ' : source.cache_hit ? 'cache' : 'mới'}</dd>
          </div>
        </dl>
      ) : null}

      {state.status === 'loading' ? (
        <div className={styles.statePanel} role="status">
          <Loader2 size={22} aria-hidden="true" />
          Đang tải lịch trận từ backend...
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
          Không có trận sắp diễn ra khớp bộ lọc.
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
                    <strong>{formatLocalTime(match)}</strong>
                    <span>{getSourceSchedule(match)}</span>
                  </div>

                  <div className={styles.matchMain}>
                    <div className={styles.teams}>
                      <strong>{match.team1}</strong>
                      <span>vs</span>
                      <strong>{match.team2}</strong>
                    </div>
                    <div className={styles.matchMeta}>
                      <span>
                        <Users size={14} aria-hidden="true" />
                        {match.group ?? match.round}
                      </span>
                      <span>
                        <MapPin size={14} aria-hidden="true" />
                        {match.ground ?? match.city ?? 'Chưa có sân'}
                      </span>
                    </div>
                  </div>

                  <Link className={styles.matchAction} to={`${ROUTES.PREDICTION_ANALYSIS}?matchId=${encodeURIComponent(match.id)}`}>
                    Phân tích & dự đoán
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
