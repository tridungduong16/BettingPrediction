import { dashboardPlaceholder } from '@/data/placeholder'
import type {
  LiveEventType,
  LiveMatchEvent,
  LiveMatchPhase,
  LiveMatchSnapshot,
  LiveProviderStatus,
  WorldCupMatch,
} from '@/store/features/dashboard/apiTypes'
import type { DashboardData, FeedItem, MatchSignal, Team } from '@/store/features/dashboard/types'

const teamCountryCodes: Record<string, string> = {
  Argentina: 'ar',
  Australia: 'au',
  Belgium: 'be',
  Brazil: 'br',
  Canada: 'ca',
  Chile: 'cl',
  Colombia: 'co',
  Croatia: 'hr',
  Denmark: 'dk',
  Ecuador: 'ec',
  England: 'gb-eng',
  France: 'fr',
  Germany: 'de',
  Ghana: 'gh',
  Italy: 'it',
  Japan: 'jp',
  Mexico: 'mx',
  Morocco: 'ma',
  Netherlands: 'nl',
  Poland: 'pl',
  Portugal: 'pt',
  Senegal: 'sn',
  Serbia: 'rs',
  Spain: 'es',
  'South Africa': 'za',
  'South Korea': 'kr',
  Switzerland: 'ch',
  Uruguay: 'uy',
  USA: 'us',
}

const teamDisplayNames: Record<string, string> = {
  Argentina: 'Argentina',
  Australia: 'Úc',
  Belgium: 'Bỉ',
  Brazil: 'Brazil',
  Canada: 'Canada',
  Chile: 'Chile',
  Colombia: 'Colombia',
  Croatia: 'Croatia',
  Denmark: 'Đan Mạch',
  Draw: 'Hòa',
  Ecuador: 'Ecuador',
  England: 'Anh',
  France: 'Pháp',
  Germany: 'Đức',
  Ghana: 'Ghana',
  Italy: 'Ý',
  Japan: 'Nhật Bản',
  Mexico: 'Mexico',
  Morocco: 'Morocco',
  Netherlands: 'Hà Lan',
  Poland: 'Ba Lan',
  Portugal: 'Bồ Đào Nha',
  Senegal: 'Senegal',
  Serbia: 'Serbia',
  Spain: 'Tây Ban Nha',
  'South Africa': 'Nam Phi',
  'South Korea': 'Hàn Quốc',
  Switzerland: 'Thụy Sĩ',
  Uruguay: 'Uruguay',
  USA: 'Mỹ',
}

const roundLabels: Record<string, string> = {
  Final: 'Chung kết',
  Finals: 'Chung kết',
  'Group Stage': 'Vòng bảng',
  'Quarter Finals': 'Tứ kết',
  'Quarter-finals': 'Tứ kết',
  'Round of 16': 'Vòng 16 đội',
  'Semi Finals': 'Bán kết',
  'Semi-finals': 'Bán kết',
  'Third Place': 'Tranh hạng ba',
}

const phaseLabels: Record<LiveMatchPhase, string> = {
  extra_time: 'Hiệp phụ',
  finished: 'Hết trận',
  first_half: 'Hiệp 1',
  halftime: 'Nghỉ giữa hiệp',
  penalties: 'Luân lưu',
  scheduled: 'Sắp diễn ra',
  second_half: 'Hiệp 2',
  suspended: 'Tạm hoãn',
  unknown: 'Trực tiếp',
}

const providerStatusLabels: Record<LiveProviderStatus, string> = {
  not_configured: 'Chưa cấu hình nhà cung cấp live',
  provider_error: 'Lỗi nhà cung cấp live',
  ready: 'Trực tiếp',
  unmapped: 'Chưa liên kết fixture live',
}

const eventTitles: Record<LiveEventType, string> = {
  card: 'Thẻ phạt',
  corner: 'Phạt góc',
  goal: 'Bàn thắng',
  injury: 'Cập nhật chấn thương',
  other: 'Sự kiện live',
  penalty: 'Phạt đền',
  period: 'Cập nhật thời gian',
  shot: 'Cú sút',
  substitution: 'Thay người',
  var: 'Kiểm tra VAR',
}

function formatClock(snapshot: LiveMatchSnapshot) {
  const elapsed = snapshot.clock.elapsed
  const extra = snapshot.clock.extra

  if (elapsed === undefined || elapsed === null) {
    return phaseLabels[snapshot.clock.phase]
  }

  return `${phaseLabels[snapshot.clock.phase]} ${elapsed}${extra ? `+${extra}` : ''}'`
}

function formatTime(value?: string | null) {
  if (!value) {
    return 'Bây giờ'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatKickoff(match: WorldCupMatch) {
  if (match.kickoff_utc) {
    const date = new Date(match.kickoff_utc)

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        hour12: false,
      }).format(date)
    }
  }

  return [match.date, match.time].filter(Boolean).join(' ')
}

function shortName(name: string) {
  const words = name.replace(/&/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase()
  }

  return words.map((word) => word[0]).join('').slice(0, 3).toUpperCase()
}

function displayTeamName(name?: string | null) {
  if (!name) {
    return ''
  }

  return teamDisplayNames[name] ?? name
}

function displayRound(round: string) {
  return roundLabels[round] ?? round
}

function fallbackFlag(name: string) {
  const initials = shortName(name).slice(0, 2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120"><rect width="160" height="120" rx="18" fill="#eef4ff"/><text x="80" y="70" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="38" font-weight="800" fill="#12245a">${initials}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function mapTeam(name: string): Team {
  const countryCode = teamCountryCodes[name]
  const displayName = displayTeamName(name)

  return {
    name: displayName,
    shortName: shortName(name),
    countryCode: countryCode?.toUpperCase() ?? shortName(name),
    flagUrl: countryCode ? `https://flagcdn.com/w160/${countryCode}.png` : fallbackFlag(name),
    form: dashboardPlaceholder.match.homeTeam.form,
  }
}

function matchSignals(match: WorldCupMatch, base: DashboardData): MatchSignal[] {
  const score = match.score?.ft
  if (!score) {
    return base.match.signals
  }

  return [
    { label: 'Tỷ số chung cuộc', value: `${score[0]}-${score[1]}`, tone: 'info' },
    { label: 'Đội thắng', value: displayTeamName(match.winner) || 'Hòa', tone: match.winner ? 'positive' : 'warning' },
    { label: 'Trạng thái nguồn', value: match.status === 'finished' ? 'Đã kết thúc' : 'Theo lịch', tone: 'info' },
  ]
}

export function mapWorldCupMatchToDashboardData(
  match: WorldCupMatch,
  base: DashboardData = dashboardPlaceholder,
): DashboardData {
  const homeTeam = mapTeam(match.team1)
  const awayTeam = mapTeam(match.team2)

  return {
    ...base,
    match: {
      ...base.match,
      id: match.id,
      competition: match.competition || base.match.competition,
      round: displayRound(match.round || base.match.round),
      kickoff: formatKickoff(match),
      stadium: match.ground || base.match.stadium,
      city: match.city || match.group || base.match.city,
      signals: matchSignals(match, base),
      homeTeam,
      awayTeam,
    },
    prediction: {
      ...base.prediction,
      lastUpdated: formatTime(match.kickoff_utc),
      outcomes: base.prediction.outcomes.map((outcome) => {
        if (outcome.id === 'home') {
          return { ...outcome, label: homeTeam.name }
        }
        if (outcome.id === 'away') {
          return { ...outcome, label: awayTeam.name }
        }
        return outcome
      }),
      status: match.status === 'finished' ? 'Đã tải kết quả cuối cùng' : 'Đã tải lịch thi đấu',
      winner: homeTeam.name,
    },
  }
}

function feedTypeForEvent(event: LiveMatchEvent): FeedItem['type'] {
  if (event.type === 'goal' || event.type === 'penalty') {
    return 'goal'
  }
  if (event.type === 'card') {
    return 'card'
  }
  if (event.type === 'substitution') {
    return 'substitution'
  }
  if (event.type === 'var') {
    return 'var'
  }
  return 'news'
}

function eventDetail(event: LiveMatchEvent) {
  const team = event.team.name ? `${displayTeamName(event.team.name)}: ` : ''
  const player = event.player?.name ?? 'Chưa có cầu thủ'
  const assist = event.assist_player?.name ? ` Kiến tạo bởi ${event.assist_player.name}.` : ''
  const detail = event.detail ? ` ${event.detail}.` : ''
  const comments = event.comments ? ` ${event.comments}` : ''

  return `${team}${player}.${detail}${assist}${comments}`.replace(/\s+/g, ' ').trim()
}

function mapEventToFeedItem(event: LiveMatchEvent): FeedItem {
  return {
    id: event.id,
    time: event.minute !== null && event.minute !== undefined ? `${event.minute}'` : formatTime(event.occurred_at),
    title: eventTitles[event.type],
    detail: eventDetail(event),
    type: feedTypeForEvent(event),
  }
}

function liveSignals(snapshot: LiveMatchSnapshot): MatchSignal[] {
  const liveReady = snapshot.provider_status === 'ready'
  const score =
    liveReady &&
    snapshot.score.home !== undefined &&
    snapshot.score.home !== null &&
    snapshot.score.away !== undefined &&
    snapshot.score.away !== null
      ? `${snapshot.score.home}-${snapshot.score.away}`
      : 'Đang chờ'

  return [
    { label: 'Tỷ số live', value: score, tone: 'info' },
    { label: 'Đồng hồ', value: liveReady ? formatClock(snapshot) : 'Chưa có dữ liệu', tone: liveReady ? 'positive' : 'warning' },
    { label: 'Nhà cung cấp', value: providerStatusLabels[snapshot.provider_status], tone: liveReady ? 'positive' : 'warning' },
  ]
}

export function applyLiveSnapshotToDashboardData(
  snapshot: LiveMatchSnapshot,
  base: DashboardData,
): DashboardData {
  const feed = snapshot.events.length
    ? [...snapshot.events].sort((left, right) => right.sequence - left.sequence).map(mapEventToFeedItem)
    : base.feed

  return {
    ...base,
    feed,
    match: {
      ...base.match,
      signals: liveSignals(snapshot),
    },
    prediction: {
      ...base.prediction,
      lastUpdated: formatTime(snapshot.observed_at),
      status:
        snapshot.provider_status === 'ready'
          ? formatClock(snapshot)
          : providerStatusLabels[snapshot.provider_status],
    },
  }
}

export function liveStatusMessage(status: LiveProviderStatus, error?: string | null) {
  if (status === 'ready') {
    return undefined
  }

  if (error) {
    return error
  }

  return providerStatusLabels[status]
}
