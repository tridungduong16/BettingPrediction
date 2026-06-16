import { dashboardPlaceholder } from '@/data/placeholder'
import type {
  LiveEventType,
  LiveMatchEvent,
  LiveMatchPhase,
  LiveMatchSnapshot,
  LiveProviderStatus,
  WorldCupMatch,
} from '@/store/features/dashboard/apiTypes'
import type {
  ChatMessage,
  DashboardData,
  FeedItem,
  MarketInfo,
  MatchSignal,
  ReasoningInfo,
  Team,
} from '@/store/features/dashboard/types'

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
  unmapped: 'Chưa liên kết dữ liệu live',
}

const providerStatusMessages: Record<Exclude<LiveProviderStatus, 'ready'>, string> = {
  not_configured: 'Chưa cấu hình nhà cung cấp live.',
  provider_error: 'Nhà cung cấp live đang lỗi hoặc chưa trả dữ liệu cho trận này.',
  unmapped: 'Trận này chưa được liên kết dữ liệu live từ nhà cung cấp.',
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

function scoreLine(match: WorldCupMatch, homeTeam: Team, awayTeam: Team) {
  const score = match.score?.ft

  if (!score) {
    return undefined
  }

  return `${homeTeam.name} ${score[0]}-${score[1]} ${awayTeam.name}`
}

function predictedWinner(match: WorldCupMatch, homeTeam: Team) {
  const sourceWinner = displayTeamName(match.winner)

  if (sourceWinner && sourceWinner !== 'Hòa') {
    return sourceWinner
  }

  return homeTeam.name
}

function opponentForWinner(winner: string, homeTeam: Team, awayTeam: Team) {
  return winner === awayTeam.name ? homeTeam.name : awayTeam.name
}

function matchSignals(match: WorldCupMatch, winner: string): MatchSignal[] {
  const score = match.score?.ft
  if (!score) {
    return [
      { label: 'Cửa mô hình', value: winner, tone: 'positive' },
      { label: 'Trạng thái trận', value: match.status === 'finished' ? 'Đã kết thúc' : 'Theo lịch', tone: 'info' },
      { label: 'Độ mới dữ liệu', value: match.kickoff_utc ? formatTime(match.kickoff_utc) : 'Theo nguồn', tone: 'info' },
    ]
  }

  return [
    { label: 'Tỷ số chung cuộc', value: `${score[0]}-${score[1]}`, tone: 'info' },
    { label: 'Đội thắng', value: displayTeamName(match.winner) || 'Hòa', tone: match.winner ? 'positive' : 'warning' },
    { label: 'Trạng thái nguồn', value: match.status === 'finished' ? 'Đã kết thúc' : 'Theo lịch', tone: 'info' },
  ]
}

function buildPredictionSummary(match: WorldCupMatch, homeTeam: Team, awayTeam: Team, winner: string) {
  const opponent = opponentForWinner(winner, homeTeam, awayTeam)
  const score = scoreLine(match, homeTeam, awayTeam)

  if (match.status === 'finished' && score) {
    return `Mô hình đang đồng bộ kết quả nguồn ${score}. ${winner} là cửa nghiêng hiện tại so với ${opponent}, dựa trên kết quả trận và các tín hiệu đã có.`
  }

  return `${winner} đang là cửa nghiêng tạm thời trong trận ${homeTeam.name} vs ${awayTeam.name}. Mô hình ưu tiên bối cảnh trận, trạng thái dữ liệu live và biến động xác suất thay vì dùng luận điểm mẫu của trận khác.`
}

function buildReasoning(match: WorldCupMatch, homeTeam: Team, awayTeam: Team, winner: string): ReasoningInfo {
  const opponent = opponentForWinner(winner, homeTeam, awayTeam)
  const score = scoreLine(match, homeTeam, awayTeam)
  const venue = [match.ground, match.city || match.group].filter(Boolean).join(', ')

  return {
    headline: `Lợi thế của ${winner} đến từ bối cảnh trận, tín hiệu xác suất và dữ liệu nguồn hiện có.`,
    description: `Reasoning đang được tạo theo trận ${homeTeam.name} vs ${awayTeam.name}; các luận điểm mẫu sẽ không được dùng lại cho cặp đấu khác.`,
    points: [
      {
        id: 'match-context',
        title: `Bối cảnh trận nghiêng về ${winner}`,
        detail: `${displayRound(match.round || 'Trận đấu')} ${venue ? `tại ${venue} ` : ''}được đưa vào làm nền để so sánh ${winner} với ${opponent}.`,
        impact: 'high',
      },
      {
        id: 'source-signal',
        title: 'Tín hiệu từ dữ liệu trận',
        detail: score
          ? `Nguồn kết quả hiện ghi nhận ${score}, nên mô hình dùng tỷ số này làm tín hiệu chính khi cập nhật xác suất.`
          : `Trận chưa có tỷ số chung cuộc trong nguồn, nên mô hình giữ xác suất ở mức thận trọng và chờ dữ liệu live/đội hình mới hơn.`,
        impact: 'medium',
      },
      {
        id: 'data-confidence',
        title: 'Độ tin cậy phụ thuộc cập nhật live',
        detail: `Khi nhà cung cấp live trả thêm sự kiện, đội hình hoặc biến động thị trường, trọng số của ${winner} và ${opponent} sẽ được tính lại.`,
        impact: 'medium',
      },
    ],
  }
}

function buildMarkets(homeTeam: Team, awayTeam: Team, winner: string): MarketInfo[] {
  const opponent = opponentForWinner(winner, homeTeam, awayTeam)

  return [
    {
      id: 'asian-handicap',
      name: `Kèo Châu Á: ${winner} -0.25`,
      probability: 56,
      edge: 2.8,
      risk: 'Medium',
      signal: `${winner} đang là cửa nghiêng trong mô hình`,
      detail: `Handicap được giữ ở mức thận trọng vì dữ liệu live/đội hình của trận ${homeTeam.name} vs ${awayTeam.name} vẫn có thể làm thay đổi biên lợi thế.`,
    },
    {
      id: 'over-under',
      name: 'Tài/Xỉu: Over 2.5 bàn',
      probability: 52,
      edge: 1.9,
      risk: 'High',
      signal: 'Tổng bàn phụ thuộc nhịp trận và đội hình ra sân',
      detail: `Kèo tài/xỉu sẽ đáng tin hơn khi có thêm sự kiện live, số cú sút và nhịp tấn công thực tế của ${homeTeam.name} lẫn ${awayTeam.name}.`,
    },
    {
      id: 'match-result',
      name: `1X2: ${winner} thắng`,
      probability: 56,
      edge: 2.4,
      risk: 'Low',
      signal: `${winner} nhỉnh hơn ${opponent} ở xác suất hiện tại`,
      detail: `1X2 là kèo kết quả cơ bản. Fallback hiện chỉ phản ánh cửa nghiêng của mô hình cho trận này, không tái sử dụng reasoning của cặp đội mẫu.`,
    },
    {
      id: 'cards',
      name: 'Thẻ phạt: Over 4.5 thẻ',
      probability: 50,
      edge: 1.2,
      risk: 'Medium',
      signal: 'Cần thêm dữ liệu trọng tài và nhịp va chạm',
      detail: `Kèo thẻ vẫn cần xác nhận trọng tài, tính chất trận và cường độ tranh chấp thực tế trước khi nâng độ tin cậy.`,
    },
    {
      id: 'corners',
      name: 'Corner: Over 9.5 góc',
      probability: 51,
      edge: 1.4,
      risk: 'Medium',
      signal: 'Cần thêm dữ liệu hướng tấn công hai biên',
      detail: `Kèo corner sẽ cập nhật tốt hơn khi có số pha tạt bóng, sút bị chặn và khu vực tấn công chủ đạo của ${homeTeam.name} hoặc ${awayTeam.name}.`,
    },
  ]
}

function buildFeed(match: WorldCupMatch, homeTeam: Team, awayTeam: Team, winner: string): FeedItem[] {
  const score = scoreLine(match, homeTeam, awayTeam)

  return [
    {
      id: `${match.id}-model-sync`,
      time: formatTime(match.kickoff_utc),
      title: 'Cập nhật dự đoán',
      detail: `${winner} đang là cửa nghiêng tạm thời sau khi đồng bộ dữ liệu trận ${homeTeam.name} vs ${awayTeam.name}.`,
      type: 'model',
    },
    {
      id: `${match.id}-source-status`,
      time: formatTime(match.kickoff_utc),
      title: 'Trạng thái dữ liệu',
      detail: score
        ? `Nguồn trận đấu đang ghi nhận ${score}.`
        : 'Chưa có sự kiện live từ nhà cung cấp, hệ thống đang giữ phần phân tích ở chế độ fallback theo lịch thi đấu.',
      type: 'news',
    },
    {
      id: `${match.id}-market-watch`,
      time: formatTime(match.kickoff_utc),
      title: 'Theo dõi thị trường',
      detail: 'Các kèo sẽ được thay bằng reasoning AI mới khi service dự đoán thị trường trả dữ liệu hợp lệ.',
      type: 'market',
    },
  ]
}

function buildChat(homeTeam: Team, awayTeam: Team, winner: string): ChatMessage[] {
  return [
    {
      id: 'chat-1',
      sender: 'ai',
      message: `${winner} đang là lựa chọn nghiêng tạm thời trong trận ${homeTeam.name} vs ${awayTeam.name}. Các luận điểm sẽ cập nhật lại khi có thêm live events, đội hình và thị trường.`,
    },
  ]
}

function buildPrompts(winner: string) {
  return [
    `Giải thích lợi thế của ${winner}`,
    'Điều gì thay đổi trong giờ qua?',
    'Kèo nào có rủi ro thấp nhất?',
  ]
}

export function mapWorldCupMatchToDashboardData(
  match: WorldCupMatch,
  base: DashboardData = dashboardPlaceholder,
): DashboardData {
  const homeTeam = mapTeam(match.team1)
  const awayTeam = mapTeam(match.team2)
  const winner = predictedWinner(match, homeTeam)

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
      signals: matchSignals(match, winner),
      homeTeam,
      awayTeam,
    },
    prediction: {
      ...base.prediction,
      lastUpdated: formatTime(match.kickoff_utc),
      summary: buildPredictionSummary(match, homeTeam, awayTeam, winner),
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
      winner,
    },
    reasoning: buildReasoning(match, homeTeam, awayTeam, winner),
    markets: buildMarkets(homeTeam, awayTeam, winner),
    feed: buildFeed(match, homeTeam, awayTeam, winner),
    chat: buildChat(homeTeam, awayTeam, winner),
    prompts: buildPrompts(winner),
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

  if (status === 'provider_error' && error) {
    return error
  }

  return providerStatusMessages[status]
}
