import type { DashboardData } from '@/store/features/dashboard/types'
import type { LanguageCode } from '@/i18n/languages'

export const dashboardPlaceholder: DashboardData = {
  match: {
    id: 'sample-match',
    competition: 'World Cup 2026',
    round: 'Vòng bảng',
    kickoff: 'Theo lịch',
    stadium: 'Sân vận động',
    city: 'Thành phố',
    signals: [
      {
        label: 'Lợi thế mô hình',
        value: '+2.8',
        tone: 'positive',
      },
      {
        label: 'Trạng thái dữ liệu',
        value: 'Trung bình',
        tone: 'warning',
      },
      {
        label: 'Độ mới dữ liệu',
        value: 'Theo nguồn',
        tone: 'info',
      },
    ],
    homeTeam: {
      name: 'Đội nhà',
      shortName: 'DN',
      countryCode: 'HOME',
      flagUrl:
        'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22120%22 viewBox=%220 0 160 120%22%3E%3Crect width=%22160%22 height=%22120%22 rx=%2218%22 fill=%22%23eef4ff%22/%3E%3Ctext x=%2280%22 y=%2270%22 text-anchor=%22middle%22 font-family=%22Inter,Arial,sans-serif%22 font-size=%2232%22 font-weight=%22800%22 fill=%22%2312245a%22%3EHOME%3C/text%3E%3C/svg%3E',
      form: ['W', 'W', 'D', 'W', 'W'],
    },
    awayTeam: {
      name: 'Đội khách',
      shortName: 'DK',
      countryCode: 'AWAY',
      flagUrl:
        'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22120%22 viewBox=%220 0 160 120%22%3E%3Crect width=%22160%22 height=%22120%22 rx=%2218%22 fill=%22%23f3f4f6%22/%3E%3Ctext x=%2280%22 y=%2270%22 text-anchor=%22middle%22 font-family=%22Inter,Arial,sans-serif%22 font-size=%2232%22 font-weight=%22800%22 fill=%22%23263238%22%3EAWAY%3C/text%3E%3C/svg%3E',
      form: ['W', 'D', 'W', 'L', 'W'],
    },
  },
  prediction: {
    winner: 'Đội nhà',
    confidence: 8.2,
    status: 'Trực tiếp',
    lastUpdated: '18:42:21',
    summary:
      'Đội nhà đang có lợi thế nhẹ theo mô hình mẫu. Nội dung này sẽ được thay bằng dữ liệu trận thật ngay khi backend trả kết quả.',
    outcomes: [
      {
        id: 'home',
        label: 'Đội nhà',
        value: 58,
        trend: 4.2,
        direction: 'up',
      },
      {
        id: 'draw',
        label: 'Hòa',
        value: 21,
        trend: -1.1,
        direction: 'down',
      },
      {
        id: 'away',
        label: 'Đội khách',
        value: 21,
        trend: -3.1,
        direction: 'down',
      },
    ],
  },
  reasoning: {
    headline: 'Lợi thế của đội được chọn đến từ bối cảnh trận, tín hiệu xác suất và dữ liệu nguồn hiện có.',
    description:
      'Phần nhận định ưu tiên dữ liệu của trận hiện tại. Dữ liệu mẫu chỉ được dùng khi backend chưa trả được chi tiết trận đấu.',
    points: [
      {
        id: 'match-context',
        title: 'Bối cảnh trận đấu',
        detail:
          'Địa điểm, vòng đấu, lịch thi đấu và trạng thái nguồn được dùng làm nền trước khi có thêm live events.',
        impact: 'high',
      },
      {
        id: 'source-signal',
        title: 'Tín hiệu từ dữ liệu trận',
        detail:
          'Tỷ số, đội hình, sự kiện live và biến động thị trường sẽ thay thế luận điểm mẫu khi dữ liệu sẵn sàng.',
        impact: 'medium',
      },
      {
        id: 'data-confidence',
        title: 'Độ tin cậy phụ thuộc cập nhật live',
        detail:
          'Nếu nhà cung cấp live chưa liên kết trận, mô hình giữ độ tin cậy ở mức thận trọng và hiển thị trạng thái rõ ràng.',
        impact: 'medium',
      },
    ],
  },
  edgeSignals: [
    {
      id: 'lineup-uncertainty',
      label: 'Tín hiệu đội hình cần xác nhận',
      detail: 'Mô hình giữ độ tin cậy thận trọng cho tới khi có đội hình và tình trạng cầu thủ mới hơn.',
      delta: '+1.4%',
      tone: 'green',
    },
    {
      id: 'probability-signal',
      label: 'Tín hiệu xác suất ổn định',
      detail: 'Cửa đội được chọn đang nhỉnh hơn trong bộ xác suất hiện tại.',
      delta: '+1.0%',
      tone: 'green',
    },
    {
      id: 'venue-context',
      label: 'Bối cảnh sân và lịch thi đấu',
      detail: 'Địa điểm, thời gian và trạng thái nguồn được dùng làm nền trước khi có live event chi tiết.',
      delta: '+0.5%',
      tone: 'green',
    },
    {
      id: 'market-noise',
      label: 'Dòng cược công chúng cần kiểm chứng',
      detail: 'Chưa đủ dữ liệu public split đáng tin cậy, nên mô hình không cho tín hiệu thị trường lấn át dữ liệu trận.',
      delta: '-0.7%',
      tone: 'red',
    },
  ],
  netEdge: '+2.9%',
  markets: [
    {
      id: 'asian-handicap',
      name: 'Kèo Châu Á: Đội nhà -0.25',
      probability: 61,
      edge: 5.8,
      risk: 'Medium',
      signal: 'Đội nhà đang là cửa nghiêng trong mô hình mẫu',
      detail:
        'Dòng handicap sẽ được tính lại theo trận thật khi nguồn dự đoán thị trường trả dữ liệu hợp lệ.',
    },
    {
      id: 'over-under',
      name: 'Tài/Xỉu: Over 2.5 bàn',
      probability: 57,
      edge: 4.2,
      risk: 'High',
      signal: 'Mô hình bàn thắng tăng sau khi quét đội hình',
      detail:
        'Kèo tài/xỉu phụ thuộc mạnh vào đội hình tấn công ban đầu. Over 2.5 sáng hơn nếu hai đội giữ cấu trúc pressing cao và không hạ thấp khối phòng ngự sớm.',
    },
    {
      id: 'match-result',
      name: '1X2: Đội nhà thắng',
      probability: 58,
      edge: 3.4,
      risk: 'Low',
      signal: 'Xác suất thắng cao hơn hai cửa còn lại',
      detail:
        '1X2 là kèo kết quả trận đấu cơ bản: đội nhà thắng, hòa hoặc đội khách thắng. Mô hình mẫu đang nghiêng về đội nhà.',
    },
    {
      id: 'cards',
      name: 'Thẻ phạt: Over 4.5 thẻ',
      probability: 54,
      edge: 2.6,
      risk: 'Medium',
      signal: 'Trận loại trực tiếp có rủi ro va chạm cao',
      detail:
        'Kèo thẻ thuộc nhóm sự kiện trận đấu. Xác suất tăng khi nhịp pressing cao, chuyển trạng thái nhiều và hai đội phải phạm lỗi để chặn phản công.',
    },
    {
      id: 'corners',
      name: 'Corner: Over 9.5 góc',
      probability: 59,
      edge: 2.3,
      risk: 'Medium',
      signal: 'Cần thêm dữ liệu hướng tấn công hai biên',
      detail:
        'Kèo corner sẽ cập nhật tốt hơn khi có số pha tạt bóng, sút bị chặn và khu vực tấn công chủ đạo của hai đội.',
    },
  ],
  movement: [
    { label: '12:00', home: 52, draw: 24, away: 24 },
    { label: '13:30', home: 53, draw: 23, away: 24 },
    { label: '15:00', home: 55, draw: 22, away: 23 },
    { label: '16:30', home: 56, draw: 22, away: 22 },
    { label: '18:00', home: 58, draw: 21, away: 21 },
  ],
  feed: [
    {
      id: 'feed-1',
      time: '18:42',
      title: 'Cập nhật dự đoán',
      detail: 'Xác suất đội được chọn tăng nhẹ sau khi mô hình đồng bộ dữ liệu trận.',
      type: 'model',
    },
    {
      id: 'feed-2',
      time: '18:27',
      title: 'Phát hiện bất định đội hình',
      detail: 'Một số vị trí trong đội hình vẫn cần xác nhận. Tác động lên độ tin cậy hiện ở mức trung bình.',
      type: 'lineup',
    },
    {
      id: 'feed-3',
      time: '18:08',
      title: 'Thị trường dịch chuyển',
      detail: 'Kèo đi tiếp lệch khỏi mô hình 2.4 điểm, tạo tín hiệu lợi thế lớn hơn.',
      type: 'market',
    },
    {
      id: 'feed-4',
      time: '17:54',
      title: 'Thời tiết ổn định',
      detail: 'Rủi ro gió và mưa vẫn thấp nên mô hình chưa điều chỉnh đáng kể.',
      type: 'news',
    },
  ],
  chat: [
    {
      id: 'chat-1',
      sender: 'ai',
      message:
        'Đội nhà đang nhỉnh hơn với xác suất 58%. Đây là câu trả lời mẫu và sẽ được thay bằng dữ liệu trận thật khi backend sẵn sàng.',
    },
    {
      id: 'chat-2',
      sender: 'user',
      message: 'Điều gì sẽ khiến đội khách trở thành lựa chọn số một của mô hình?',
    },
    {
      id: 'chat-3',
      sender: 'ai',
      message:
        'Nếu dữ liệu live, đội hình và thị trường nghiêng rõ về đội khách, xác suất của đội khách sẽ được mô hình nâng lên.',
    },
  ],
  prompts: [
    'Giải thích lợi thế của đội được chọn',
    'Điều gì thay đổi trong giờ qua?',
    'Kèo nào có rủi ro thấp nhất?',
  ],
}

export function getDashboardPlaceholder(language: LanguageCode = 'vi'): DashboardData {
  if (language === 'en') {
    return {
      ...dashboardPlaceholder,
      match: {
        ...dashboardPlaceholder.match,
        round: 'Group Stage',
        kickoff: 'Scheduled',
        stadium: 'Stadium',
        city: 'City',
        signals: [
          {
            label: 'Model edge',
            value: '+2.8',
            tone: 'positive',
          },
          {
            label: 'Data status',
            value: 'Medium',
            tone: 'warning',
          },
          {
            label: 'Data freshness',
            value: 'From source',
            tone: 'info',
          },
        ],
        homeTeam: {
          ...dashboardPlaceholder.match.homeTeam,
          name: 'Home team',
          shortName: 'HOM',
        },
        awayTeam: {
          ...dashboardPlaceholder.match.awayTeam,
          name: 'Away team',
          shortName: 'AWY',
        },
      },
      prediction: {
        ...dashboardPlaceholder.prediction,
        winner: 'Home team',
        status: 'Live',
        summary:
          'Home team has a slight edge in the sample model. This content will be replaced by real match data as soon as the backend responds.',
        outcomes: [
          {
            id: 'home',
            label: 'Home team',
            value: 58,
            trend: 4.2,
            direction: 'up',
          },
          {
            id: 'draw',
            label: 'Draw',
            value: 21,
            trend: -1.1,
            direction: 'down',
          },
          {
            id: 'away',
            label: 'Away team',
            value: 21,
            trend: -3.1,
            direction: 'down',
          },
        ],
      },
      reasoning: {
        headline: 'The selected side edge comes from match context, probability signals and available source data.',
        description:
          'The match read prioritizes current fixture data. Sample data is only used when the backend cannot return match details yet.',
        points: [
          {
            id: 'match-context',
            title: 'Match context',
            detail:
              'Venue, round, schedule and source status are used as the baseline before more live events are available.',
            impact: 'high',
          },
          {
            id: 'source-signal',
            title: 'Match data signal',
            detail:
              'Score, lineups, live events and market movement will replace the sample thesis when the data is ready.',
            impact: 'medium',
          },
          {
            id: 'data-confidence',
            title: 'Confidence depends on live updates',
            detail:
              'If the live provider is not mapped to this match yet, the model keeps confidence conservative and shows the status clearly.',
            impact: 'medium',
          },
        ],
      },
      edgeSignals: [
        {
          id: 'lineup-uncertainty',
          label: 'Lineup signal needs confirmation',
          detail: 'The model keeps confidence conservative until fresher lineup and player-status data is available.',
          delta: '+1.4%',
          tone: 'green',
        },
        {
          id: 'probability-signal',
          label: 'Probability signal is stable',
          detail: 'The selected side is slightly ahead in the current probability set.',
          delta: '+1.0%',
          tone: 'green',
        },
        {
          id: 'venue-context',
          label: 'Venue and schedule context',
          detail: 'Venue, time and source status are used as the baseline before detailed live events are available.',
          delta: '+0.5%',
          tone: 'green',
        },
        {
          id: 'market-noise',
          label: 'Public betting flow needs verification',
          detail: 'Reliable public split data is not available yet, so the model does not let market noise override match data.',
          delta: '-0.7%',
          tone: 'red',
        },
      ],
      markets: [
        {
          id: 'asian-handicap',
          name: 'Asian Handicap: Home team -0.25',
          probability: 61,
          edge: 5.8,
          risk: 'Medium',
          signal: 'Home team is the model lean in the sample view',
          detail:
            'The handicap line will be recalculated for the real match when valid market prediction data arrives.',
        },
        {
          id: 'over-under',
          name: 'Over/Under: Over 2.5 goals',
          probability: 57,
          edge: 4.2,
          risk: 'High',
          signal: 'Goal model increases after lineup scan',
          detail:
            'The total depends heavily on the starting attacking shape. Over 2.5 improves if both teams keep high pressing structures and do not drop too deep early.',
        },
        {
          id: 'match-result',
          name: '1X2: Home team win',
          probability: 58,
          edge: 3.4,
          risk: 'Low',
          signal: 'Win probability is higher than the other two outcomes',
          detail:
            '1X2 is the basic match-result market: home win, draw or away win. The sample model currently leans home.',
        },
        {
          id: 'cards',
          name: 'Cards: Over 4.5 cards',
          probability: 54,
          edge: 2.6,
          risk: 'Medium',
          signal: 'Knockout-style intensity raises contact risk',
          detail:
            'Cards are an in-match event market. Probability increases when pressing is high, transitions are frequent and teams need tactical fouls to stop counters.',
        },
        {
          id: 'corners',
          name: 'Corners: Over 9.5 corners',
          probability: 59,
          edge: 2.3,
          risk: 'Medium',
          signal: 'Wide attack data is still needed',
          detail:
            'The corners market updates better when crosses, blocked shots and the main attacking zones for both teams are available.',
        },
      ],
      feed: [
        {
          id: 'feed-1',
          time: '18:42',
          title: 'Prediction update',
          detail: 'The selected side probability rose slightly after the model synced match data.',
          type: 'model',
        },
        {
          id: 'feed-2',
          time: '18:27',
          title: 'Lineup uncertainty detected',
          detail: 'Some lineup positions still need confirmation. Current confidence impact is medium.',
          type: 'lineup',
        },
        {
          id: 'feed-3',
          time: '18:08',
          title: 'Market movement',
          detail: 'The advancement market moved 2.4 points away from the model, creating a stronger edge signal.',
          type: 'market',
        },
        {
          id: 'feed-4',
          time: '17:54',
          title: 'Weather stable',
          detail: 'Wind and rain risk remains low, so the model has not adjusted heavily.',
          type: 'news',
        },
      ],
      chat: [
        {
          id: 'chat-1',
          sender: 'ai',
          message:
            'Home team is ahead at 58%. This is a sample answer and will be replaced by real match data when the backend is ready.',
        },
        {
          id: 'chat-2',
          sender: 'user',
          message: 'What would make the away team the model favorite?',
        },
        {
          id: 'chat-3',
          sender: 'ai',
          message:
            'If live data, lineups and markets lean clearly toward the away team, the model will raise the away probability.',
        },
      ],
      prompts: [
        'Explain the selected side edge',
        'What changed in the last hour?',
        'Which market has the lowest risk?',
      ],
    }
  }

  return dashboardPlaceholder
}
