import { getDashboardPlaceholder } from '@/data/placeholder'
import { displayTeamName, getTeamIdentity } from '@/helpers/teamIdentity'
import { localeForLanguage, type LanguageCode } from '@/i18n/languages'
import type {
  LiveEventType,
  LiveMatchEvent,
  LiveMatchPhase,
  LiveMatchSnapshot,
  LiveProviderStatus,
  MatchInsightResponse,
  WorldCupMatch,
} from '@/store/features/dashboard/apiTypes'
import type {
  DashboardData,
  EdgeSignal,
  FeedItem,
  MarketInfo,
  MatchSignal,
  ReasoningInfo,
  Team,
} from '@/store/features/dashboard/types'

const roundLabels = {
  en: {
    Final: 'Final',
    Finals: 'Final',
    'Group Stage': 'Group Stage',
    'Quarter Finals': 'Quarter-finals',
    'Quarter-finals': 'Quarter-finals',
    'Round of 16': 'Round of 16',
    'Semi Finals': 'Semi-finals',
    'Semi-finals': 'Semi-finals',
    'Third Place': 'Third-place match',
  },
  vi: {
    Final: 'Chung kết',
    Finals: 'Chung kết',
    'Group Stage': 'Vòng bảng',
    'Quarter Finals': 'Tứ kết',
    'Quarter-finals': 'Tứ kết',
    'Round of 16': 'Vòng 16 đội',
    'Semi Finals': 'Bán kết',
    'Semi-finals': 'Bán kết',
    'Third Place': 'Tranh hạng ba',
  },
} satisfies Record<LanguageCode, Record<string, string>>

const phaseLabels = {
  en: {
    extra_time: 'Extra time',
    finished: 'Full time',
    first_half: 'First half',
    halftime: 'Half-time',
    penalties: 'Penalties',
    scheduled: 'Scheduled',
    second_half: 'Second half',
    suspended: 'Suspended',
    unknown: 'Live',
  },
  vi: {
    extra_time: 'Hiệp phụ',
    finished: 'Hết trận',
    first_half: 'Hiệp 1',
    halftime: 'Nghỉ giữa hiệp',
    penalties: 'Luân lưu',
    scheduled: 'Sắp diễn ra',
    second_half: 'Hiệp 2',
    suspended: 'Tạm hoãn',
    unknown: 'Trực tiếp',
  },
} satisfies Record<LanguageCode, Record<LiveMatchPhase, string>>

const providerStatusLabels = {
  en: {
    not_configured: 'Live provider not configured',
    provider_error: 'Live provider error',
    ready: 'Live',
    unmapped: 'Live data not mapped',
  },
  vi: {
    not_configured: 'Chưa cấu hình nhà cung cấp live',
    provider_error: 'Lỗi nhà cung cấp live',
    ready: 'Trực tiếp',
    unmapped: 'Chưa liên kết dữ liệu live',
  },
} satisfies Record<LanguageCode, Record<LiveProviderStatus, string>>

const providerStatusMessages = {
  en: {
    not_configured: 'Live provider is not configured.',
    provider_error: 'The live provider is failing or has no data for this match.',
    unmapped: 'This match has not been mapped to live provider data.',
  },
  vi: {
    not_configured: 'Chưa cấu hình nhà cung cấp live.',
    provider_error: 'Nhà cung cấp live đang lỗi hoặc chưa trả dữ liệu cho trận này.',
    unmapped: 'Trận này chưa được liên kết dữ liệu live từ nhà cung cấp.',
  },
} satisfies Record<LanguageCode, Record<Exclude<LiveProviderStatus, 'ready'>, string>>

const eventTitles = {
  en: {
    card: 'Card',
    corner: 'Corner',
    goal: 'Goal',
    injury: 'Injury update',
    other: 'Live event',
    penalty: 'Penalty',
    period: 'Time update',
    shot: 'Shot',
    substitution: 'Substitution',
    var: 'VAR check',
  },
  vi: {
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
  },
} satisfies Record<LanguageCode, Record<LiveEventType, string>>

const mapperCopy = {
  en: {
    awayTeam: 'Away team',
    confirmLineup: (team: string) => `${team} lineup information needs confirmation`,
    dataConfidenceTitle: 'Confidence depends on live updates',
    dataFreshness: 'Data freshness',
    draw: 'Draw',
    eventAssist: (player: string) => ` Assisted by ${player}.`,
    finalResultLoaded: 'Final result loaded',
    finalScore: 'Final score',
    fromSource: 'From source',
    homeTeam: 'Home team',
    liveClock: 'Clock',
    liveDataMissing: 'No data yet',
    liveScore: 'Live score',
    marketWatchTitle: 'Market watch',
    modelFavorite: 'Model lean',
    modelSyncTitle: 'Match read update',
    noLiveEvents:
      'No live events from the provider yet, so the analysis still uses the schedule and available match data.',
    noPlayer: 'Player pending',
    probabilityStable: (team: string) => `${team} probability signal is stable`,
    promptExplain: (winner: string) => `Explain ${winner}'s edge`,
    promptMarket: 'Which market has the lowest risk?',
    promptRecent: 'What changed in the last hour?',
    publicMarketNoise: 'Public betting flow needs verification',
    sourceSignalTitle: 'Match data signal',
    sourceStatus: 'Source status',
    sourceStatusTitle: 'Data status',
    scheduled: 'Scheduled',
    selectedTeam: 'Selected team',
    venueContext: 'Venue and schedule context',
    winnerTeam: 'Winning team',
  },
  vi: {
    awayTeam: 'Đội khách',
    confirmLineup: (team: string) => `Thông tin đội hình của ${team} cần xác nhận`,
    dataConfidenceTitle: 'Độ tin cậy phụ thuộc cập nhật live',
    dataFreshness: 'Độ mới dữ liệu',
    draw: 'Hòa',
    eventAssist: (player: string) => ` Kiến tạo bởi ${player}.`,
    finalResultLoaded: 'Đã tải kết quả cuối cùng',
    finalScore: 'Tỷ số chung cuộc',
    fromSource: 'Theo nguồn',
    homeTeam: 'Đội nhà',
    liveClock: 'Đồng hồ',
    liveDataMissing: 'Chưa có dữ liệu',
    liveScore: 'Tỷ số live',
    marketWatchTitle: 'Theo dõi thị trường',
    modelFavorite: 'Cửa mô hình',
    modelSyncTitle: 'Cập nhật nhận định',
    noLiveEvents:
      'Chưa có sự kiện live từ nhà cung cấp, nên phần phân tích vẫn dựa trên lịch thi đấu và dữ liệu hiện có.',
    noPlayer: 'Chưa có cầu thủ',
    probabilityStable: (team: string) => `Tín hiệu xác suất của ${team} ổn định`,
    promptExplain: (winner: string) => `Giải thích lợi thế của ${winner}`,
    promptMarket: 'Kèo nào có rủi ro thấp nhất?',
    promptRecent: 'Điều gì thay đổi trong giờ qua?',
    publicMarketNoise: 'Dòng cược công chúng cần kiểm chứng',
    sourceSignalTitle: 'Tín hiệu từ dữ liệu trận',
    sourceStatus: 'Trạng thái nguồn',
    sourceStatusTitle: 'Trạng thái dữ liệu',
    scheduled: 'Theo lịch',
    selectedTeam: 'Đội được chọn',
    venueContext: 'Bối cảnh sân và lịch thi đấu',
    winnerTeam: 'Đội thắng',
  },
} satisfies Record<LanguageCode, Record<string, unknown>>

function formatClock(snapshot: LiveMatchSnapshot, language: LanguageCode) {
  const elapsed = snapshot.clock.elapsed
  const extra = snapshot.clock.extra

  if (elapsed === undefined || elapsed === null) {
    return phaseLabels[language][snapshot.clock.phase]
  }

  return `${phaseLabels[language][snapshot.clock.phase]} ${elapsed}${extra ? `+${extra}` : ''}'`
}

function formatTime(value?: string | null, language: LanguageCode = 'vi') {
  if (!value) {
    return language === 'vi' ? 'Bây giờ' : 'Now'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(localeForLanguage(language), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatKickoff(match: WorldCupMatch, language: LanguageCode) {
  if (match.kickoff_utc) {
    const date = new Date(match.kickoff_utc)

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(localeForLanguage(language), {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: language === 'vi' ? 'short' : 'short',
        hour12: false,
      }).format(date)
    }
  }

  return [match.date, match.time].filter(Boolean).join(' ')
}

function displayRound(round: string, language: LanguageCode) {
  const labels: Record<string, string> = roundLabels[language]
  return labels[round] ?? round
}

function mapTeam(name: string, language: LanguageCode): Team {
  const team = getTeamIdentity(name, language)
  const fallback = getDashboardPlaceholder(language)

  return {
    name: team.displayName,
    shortName: team.shortName,
    countryCode: team.countryCode,
    flagUrl: team.flagUrl,
    form: fallback.match.homeTeam.form,
  }
}

function scoreLine(match: WorldCupMatch, homeTeam: Team, awayTeam: Team) {
  const score = match.score?.ft

  if (!score) {
    return undefined
  }

  return `${homeTeam.name} ${score[0]}-${score[1]} ${awayTeam.name}`
}

function predictedWinner(match: WorldCupMatch, homeTeam: Team, language: LanguageCode) {
  const sourceWinner = displayTeamName(match.winner, language)

  if (sourceWinner && sourceWinner !== mapperCopy[language].draw) {
    return sourceWinner
  }

  return homeTeam.name
}

function opponentForWinner(winner: string, homeTeam: Team, awayTeam: Team) {
  return winner === awayTeam.name ? homeTeam.name : awayTeam.name
}

function matchSignals(match: WorldCupMatch, winner: string, language: LanguageCode): MatchSignal[] {
  const copy = mapperCopy[language]
  const score = match.score?.ft
  if (!score) {
    return [
      { label: copy.modelFavorite, value: winner, tone: 'positive' },
      { label: copy.sourceStatusTitle, value: match.status === 'finished' ? phaseLabels[language].finished : copy.scheduled, tone: 'info' },
      { label: copy.dataFreshness, value: match.kickoff_utc ? formatTime(match.kickoff_utc, language) : copy.fromSource, tone: 'info' },
    ]
  }

  return [
    { label: copy.finalScore, value: `${score[0]}-${score[1]}`, tone: 'info' },
    { label: copy.winnerTeam, value: displayTeamName(match.winner, language) || copy.draw, tone: match.winner ? 'positive' : 'warning' },
    { label: copy.sourceStatus, value: match.status === 'finished' ? phaseLabels[language].finished : copy.scheduled, tone: 'info' },
  ]
}

function buildPredictionSummary(match: WorldCupMatch, homeTeam: Team, awayTeam: Team, winner: string, language: LanguageCode) {
  const opponent = opponentForWinner(winner, homeTeam, awayTeam)
  const score = scoreLine(match, homeTeam, awayTeam)

  if (language === 'en') {
    if (match.status === 'finished' && score) {
      return `The model is synced to the source result ${score}. ${winner} is the current lean over ${opponent}, based on the result and available signals.`
    }

    return `${winner} is the temporary lean in ${homeTeam.name} vs ${awayTeam.name}. The model prioritizes match context, live data status and probability movement instead of reusing another fixture's thesis.`
  }

  if (match.status === 'finished' && score) {
    return `Mô hình đang đồng bộ kết quả nguồn ${score}. ${winner} là cửa nghiêng hiện tại so với ${opponent}, dựa trên kết quả trận và các tín hiệu đã có.`
  }

  return `${winner} đang là cửa nghiêng tạm thời trong trận ${homeTeam.name} vs ${awayTeam.name}. Mô hình ưu tiên bối cảnh trận, trạng thái dữ liệu live và biến động xác suất thay vì dùng luận điểm mẫu của trận khác.`
}

function buildReasoning(
  match: WorldCupMatch,
  homeTeam: Team,
  awayTeam: Team,
  winner: string,
  language: LanguageCode,
): ReasoningInfo {
  const copy = mapperCopy[language]
  const opponent = opponentForWinner(winner, homeTeam, awayTeam)
  const score = scoreLine(match, homeTeam, awayTeam)
  const venue = [match.ground, match.city || match.group].filter(Boolean).join(', ')

  if (language === 'en') {
    return {
      headline: `${winner}'s edge comes from match context, probability signals and the available source data.`,
      description: `Reasoning is generated for ${homeTeam.name} vs ${awayTeam.name}; sample arguments are not reused for a different fixture.`,
      points: [
        {
          id: 'match-context',
          title: `Match context leans toward ${winner}`,
          detail: `${displayRound(match.round || 'Match', language)} ${venue ? `at ${venue} ` : ''}sets the baseline for comparing ${winner} with ${opponent}.`,
          impact: 'high',
        },
        {
          id: 'source-signal',
          title: copy.sourceSignalTitle,
          detail: score
            ? `The source result currently shows ${score}, so the model uses that score as the main update signal.`
            : 'The source has no final score yet, so the model keeps probability conservative and waits for fresher live or lineup data.',
          impact: 'medium',
        },
        {
          id: 'data-confidence',
          title: copy.dataConfidenceTitle,
          detail: `When the live provider returns more events, lineups or market movement, weights for ${winner} and ${opponent} will be recalculated.`,
          impact: 'medium',
        },
      ],
    }
  }

  return {
    headline: `Lợi thế của ${winner} đến từ bối cảnh trận, tín hiệu xác suất và dữ liệu nguồn hiện có.`,
    description: `Reasoning đang được tạo theo trận ${homeTeam.name} vs ${awayTeam.name}; các luận điểm mẫu sẽ không được dùng lại cho cặp đấu khác.`,
    points: [
      {
        id: 'match-context',
        title: `Bối cảnh trận nghiêng về ${winner}`,
        detail: `${displayRound(match.round || 'Trận đấu', language)} ${venue ? `tại ${venue} ` : ''}được đưa vào làm nền để so sánh ${winner} với ${opponent}.`,
        impact: 'high',
      },
      {
        id: 'source-signal',
        title: copy.sourceSignalTitle,
        detail: score
          ? `Nguồn kết quả hiện ghi nhận ${score}, nên mô hình dùng tỷ số này làm tín hiệu chính khi cập nhật xác suất.`
          : `Trận chưa có tỷ số chung cuộc trong nguồn, nên mô hình giữ xác suất ở mức thận trọng và chờ dữ liệu live/đội hình mới hơn.`,
        impact: 'medium',
      },
      {
        id: 'data-confidence',
        title: copy.dataConfidenceTitle,
        detail: `Khi nhà cung cấp live trả thêm sự kiện, đội hình hoặc biến động thị trường, trọng số của ${winner} và ${opponent} sẽ được tính lại.`,
        impact: 'medium',
      },
    ],
  }
}

function buildEdgeSignals(homeTeam: Team, awayTeam: Team, winner: string, language: LanguageCode): EdgeSignal[] {
  const copy = mapperCopy[language]
  const opponent = opponentForWinner(winner, homeTeam, awayTeam)

  if (language === 'en') {
    return [
      {
        id: 'lineup-uncertainty',
        label: copy.confirmLineup(opponent),
        detail: 'The model keeps confidence conservative until fresher lineup and player-status data is available.',
        delta: '+1.4%',
        tone: 'green',
      },
      {
        id: 'probability-signal',
        label: copy.probabilityStable(winner),
        detail: `${winner} is slightly ahead in the current probability set for ${homeTeam.name} vs ${awayTeam.name}.`,
        delta: '+1.0%',
        tone: 'green',
      },
      {
        id: 'venue-context',
        label: copy.venueContext,
        detail: 'Venue, time and source status are used as the baseline before detailed live events are available.',
        delta: '+0.5%',
        tone: 'green',
      },
      {
        id: 'market-noise',
        label: copy.publicMarketNoise,
        detail: 'Reliable public split data is not available yet, so the model does not let market noise override match data.',
        delta: '-0.7%',
        tone: 'red',
      },
    ]
  }

  return [
    {
      id: 'lineup-uncertainty',
      label: copy.confirmLineup(opponent),
      detail: 'Mô hình giữ độ tin cậy thận trọng cho tới khi có đội hình và tình trạng cầu thủ mới hơn.',
      delta: '+1.4%',
      tone: 'green',
    },
    {
      id: 'probability-signal',
      label: copy.probabilityStable(winner),
      detail: `Cửa ${winner} đang nhỉnh hơn trong bộ xác suất hiện tại của trận ${homeTeam.name} vs ${awayTeam.name}.`,
      delta: '+1.0%',
      tone: 'green',
    },
    {
      id: 'venue-context',
      label: copy.venueContext,
      detail: 'Địa điểm, thời gian và trạng thái nguồn được dùng làm nền trước khi có live event chi tiết.',
      delta: '+0.5%',
      tone: 'green',
    },
    {
      id: 'market-noise',
      label: copy.publicMarketNoise,
      detail: 'Chưa đủ dữ liệu public split đáng tin cậy, nên mô hình không cho tín hiệu thị trường lấn át dữ liệu trận.',
      delta: '-0.7%',
      tone: 'red',
    },
  ]
}

function buildMarkets(homeTeam: Team, awayTeam: Team, winner: string, language: LanguageCode): MarketInfo[] {
  const opponent = opponentForWinner(winner, homeTeam, awayTeam)

  if (language === 'en') {
    return [
      {
        id: 'asian-handicap',
        name: `Asian Handicap: ${winner} -0.25`,
        probability: 56,
        edge: 2.8,
        risk: 'Medium',
        signal: `${winner} is the current lean`,
        detail: `The handicap stays conservative because live and lineup data for ${homeTeam.name} vs ${awayTeam.name} can still change the edge.`,
      },
      {
        id: 'over-under',
        name: 'Over/Under: Over 2.5 goals',
        probability: 52,
        edge: 1.9,
        risk: 'High',
        signal: 'Goal total depends on match rhythm and starting lineups',
        detail: `The total becomes more reliable when live events, shot volume and attacking rhythm for both ${homeTeam.name} and ${awayTeam.name} are available.`,
      },
      {
        id: 'match-result',
        name: `1X2: ${winner} win`,
        probability: 56,
        edge: 2.4,
        risk: 'Low',
        signal: `${winner} is ahead of ${opponent} in the current probability set`,
        detail: '1X2 is the basic match-result market. This temporary view only reflects the current lean for this match and does not reuse another fixture.',
      },
      {
        id: 'cards',
        name: 'Cards: Over 4.5 cards',
        probability: 50,
        edge: 1.2,
        risk: 'Medium',
        signal: 'Referee and duel-intensity data are still needed',
        detail: 'The cards market still needs referee profile, match stakes and actual duel intensity before confidence can move higher.',
      },
      {
        id: 'corners',
        name: 'Corners: Over 9.5 corners',
        probability: 51,
        edge: 1.4,
        risk: 'Medium',
        signal: 'Wide attack data is still needed',
        detail: `The corners market updates better when crosses, blocked shots and attacking zones for ${homeTeam.name} or ${awayTeam.name} are available.`,
      },
    ]
  }

  return [
    {
      id: 'asian-handicap',
      name: `Kèo Châu Á: ${winner} -0.25`,
      probability: 56,
      edge: 2.8,
      risk: 'Medium',
      signal: `${winner} đang là cửa nghiêng hiện tại`,
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
      detail: `1X2 là kèo kết quả cơ bản. Nhận định tạm hiện chỉ phản ánh cửa nghiêng của trận này, không dùng lại luận điểm của cặp đội mẫu.`,
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

function buildFeed(match: WorldCupMatch, homeTeam: Team, awayTeam: Team, winner: string, language: LanguageCode): FeedItem[] {
  const copy = mapperCopy[language]
  const score = scoreLine(match, homeTeam, awayTeam)

  if (language === 'en') {
    return [
      {
        id: `${match.id}-model-sync`,
        time: formatTime(match.kickoff_utc, language),
        title: copy.modelSyncTitle,
        detail: `${winner} is the temporary lean after syncing ${homeTeam.name} vs ${awayTeam.name} match data.`,
        type: 'model',
      },
      {
        id: `${match.id}-source-status`,
        time: formatTime(match.kickoff_utc, language),
        title: copy.sourceStatusTitle,
        detail: score ? `The match source currently shows ${score}.` : copy.noLiveEvents,
        type: 'news',
      },
      {
        id: `${match.id}-market-watch`,
        time: formatTime(match.kickoff_utc, language),
        title: copy.marketWatchTitle,
        detail: 'Markets will update with fresh reads when valid market prediction data arrives.',
        type: 'market',
      },
    ]
  }

  return [
    {
      id: `${match.id}-model-sync`,
      time: formatTime(match.kickoff_utc, language),
      title: copy.modelSyncTitle,
      detail: `${winner} đang là cửa nghiêng tạm thời sau khi đồng bộ dữ liệu trận ${homeTeam.name} vs ${awayTeam.name}.`,
      type: 'model',
    },
    {
      id: `${match.id}-source-status`,
      time: formatTime(match.kickoff_utc, language),
      title: copy.sourceStatusTitle,
      detail: score
        ? `Nguồn trận đấu đang ghi nhận ${score}.`
        : copy.noLiveEvents,
      type: 'news',
    },
    {
      id: `${match.id}-market-watch`,
      time: formatTime(match.kickoff_utc, language),
      title: copy.marketWatchTitle,
      detail: 'Các kèo sẽ cập nhật bằng nhận định mới khi nguồn dự đoán thị trường trả dữ liệu hợp lệ.',
      type: 'market',
    },
  ]
}

function buildPrompts(winner: string, language: LanguageCode) {
  const copy = mapperCopy[language]

  return [
    copy.promptExplain(winner),
    copy.promptRecent,
    copy.promptMarket,
  ]
}

export function mapWorldCupMatchToDashboardData(
  match: WorldCupMatch,
  language: LanguageCode = 'vi',
  base: DashboardData = getDashboardPlaceholder(language),
): DashboardData {
  const homeTeam = mapTeam(match.team1, language)
  const awayTeam = mapTeam(match.team2, language)
  const winner = predictedWinner(match, homeTeam, language)

  return {
    ...base,
    match: {
      ...base.match,
      id: match.id,
      competition: match.competition || base.match.competition,
      round: displayRound(match.round || base.match.round, language),
      kickoff: formatKickoff(match, language),
      stadium: match.ground || base.match.stadium,
      city: match.city || match.group || base.match.city,
      signals: matchSignals(match, winner, language),
      homeTeam,
      awayTeam,
    },
    prediction: {
      ...base.prediction,
      lastUpdated: formatTime(match.kickoff_utc, language),
      summary: buildPredictionSummary(match, homeTeam, awayTeam, winner, language),
      outcomes: base.prediction.outcomes.map((outcome) => {
        if (outcome.id === 'home') {
          return { ...outcome, label: homeTeam.name }
        }
        if (outcome.id === 'away') {
          return { ...outcome, label: awayTeam.name }
        }
        return outcome
      }),
      status: match.status === 'finished'
        ? mapperCopy[language].finalResultLoaded
        : language === 'vi' ? 'Đã tải lịch thi đấu' : 'Schedule loaded',
      winner,
    },
    reasoning: buildReasoning(match, homeTeam, awayTeam, winner, language),
    edgeSignals: buildEdgeSignals(homeTeam, awayTeam, winner, language),
    netEdge: '+2.9%',
    markets: buildMarkets(homeTeam, awayTeam, winner, language),
    feed: buildFeed(match, homeTeam, awayTeam, winner, language),
    chat: [],
    prompts: buildPrompts(winner, language),
  }
}

function insightWinnerLabel(value: string, base: DashboardData, language: LanguageCode) {
  const draw = mapperCopy[language].draw
  if (value === base.match.homeTeam.name || value === base.match.awayTeam.name || value === draw || value === 'Hòa' || value === 'Draw') {
    if (value === 'Hòa' || value === 'Draw') {
      return draw
    }
    return value
  }

  return displayTeamName(value, language) || value
}

export function applyMatchInsightToDashboardData(
  response: MatchInsightResponse,
  base: DashboardData,
  language: LanguageCode = response.language,
): DashboardData {
  const insight = response.insight
  const winner = insightWinnerLabel(insight.winner, base, language)
  const outcomes = insight.outcomes.map((outcome) => {
    if (outcome.id === 'home') {
      return { ...outcome, label: base.match.homeTeam.name }
    }
    if (outcome.id === 'away') {
      return { ...outcome, label: base.match.awayTeam.name }
    }
    return { ...outcome, label: mapperCopy[language].draw }
  })

  return {
    ...base,
    prediction: {
      ...base.prediction,
      winner,
      confidence: insight.confidence,
      confidenceLevel: insight.confidence_level,
      confidenceRationale: insight.confidence_rationale,
      status: insight.status,
      lastUpdated: formatTime(response.generated_at, language),
      summary: insight.summary,
      outcomes,
    },
    reasoning: insight.reasoning,
    edgeSignals: insight.edge_signals,
    netEdge: insight.net_edge,
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

function eventDetail(event: LiveMatchEvent, language: LanguageCode) {
  const copy = mapperCopy[language]
  const team = event.team.name ? `${displayTeamName(event.team.name, language)}: ` : ''
  const player = event.player?.name ?? copy.noPlayer
  const assist = event.assist_player?.name ? copy.eventAssist(event.assist_player.name) : ''
  const detail = event.detail ? ` ${event.detail}.` : ''
  const comments = event.comments ? ` ${event.comments}` : ''

  return `${team}${player}.${detail}${assist}${comments}`.replace(/\s+/g, ' ').trim()
}

function mapEventToFeedItem(event: LiveMatchEvent, language: LanguageCode): FeedItem {
  return {
    id: event.id,
    time: event.minute !== null && event.minute !== undefined ? `${event.minute}'` : formatTime(event.occurred_at, language),
    title: eventTitles[language][event.type],
    detail: eventDetail(event, language),
    type: feedTypeForEvent(event),
  }
}

function liveSignals(snapshot: LiveMatchSnapshot, language: LanguageCode): MatchSignal[] {
  const copy = mapperCopy[language]
  const liveReady = snapshot.provider_status === 'ready'
  const score =
    liveReady &&
    snapshot.score.home !== undefined &&
    snapshot.score.home !== null &&
    snapshot.score.away !== undefined &&
    snapshot.score.away !== null
      ? `${snapshot.score.home}-${snapshot.score.away}`
      : language === 'vi' ? 'Đang chờ' : 'Pending'

  return [
    { label: copy.liveScore, value: score, tone: 'info' },
    { label: copy.liveClock, value: liveReady ? formatClock(snapshot, language) : copy.liveDataMissing, tone: liveReady ? 'positive' : 'warning' },
    { label: language === 'vi' ? 'Nhà cung cấp' : 'Provider', value: providerStatusLabels[language][snapshot.provider_status], tone: liveReady ? 'positive' : 'warning' },
  ]
}

export function applyLiveSnapshotToDashboardData(
  snapshot: LiveMatchSnapshot,
  base: DashboardData,
  language: LanguageCode = 'vi',
): DashboardData {
  const feed = snapshot.events.length
    ? [...snapshot.events].sort((left, right) => right.sequence - left.sequence).map((event) => mapEventToFeedItem(event, language))
    : base.feed

  return {
    ...base,
    feed,
    match: {
      ...base.match,
      signals: liveSignals(snapshot, language),
    },
    prediction: {
      ...base.prediction,
      lastUpdated: formatTime(snapshot.observed_at, language),
      status:
        snapshot.provider_status === 'ready'
          ? formatClock(snapshot, language)
          : providerStatusLabels[language][snapshot.provider_status],
    },
  }
}

export function liveStatusMessage(status: LiveProviderStatus, error?: string | null, language: LanguageCode = 'vi') {
  if (status === 'ready') {
    return undefined
  }

  if (status === 'provider_error' && error) {
    return error
  }

  return providerStatusMessages[language][status]
}
