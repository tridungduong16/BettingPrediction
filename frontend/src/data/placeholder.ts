import type { DashboardData } from '@/store/features/dashboard/types'

export const dashboardPlaceholder: DashboardData = {
  match: {
    id: 'bra-fra-2026-quarter',
    competition: 'World Cup 2026',
    round: 'Tứ kết',
    kickoff: 'Hôm nay 20:00',
    stadium: 'Lusail Stadium',
    city: 'Qatar',
    signals: [
      {
        label: 'Lợi thế mô hình',
        value: '+6.8',
        tone: 'positive',
      },
      {
        label: 'Rủi ro nhịp độ',
        value: 'Trung bình',
        tone: 'warning',
      },
      {
        label: 'Độ mới dữ liệu',
        value: 'Trực tiếp',
        tone: 'info',
      },
    ],
    homeTeam: {
      name: 'Brazil',
      shortName: 'BRA',
      countryCode: 'BR',
      flagUrl: 'https://flagcdn.com/w160/br.png',
      form: ['W', 'W', 'D', 'W', 'W'],
    },
    awayTeam: {
      name: 'Pháp',
      shortName: 'FRA',
      countryCode: 'FR',
      flagUrl: 'https://flagcdn.com/w160/fr.png',
      form: ['W', 'D', 'W', 'L', 'W'],
    },
  },
  prediction: {
    winner: 'Brazil',
    confidence: 8.2,
    status: 'Trực tiếp',
    lastUpdated: '18:42:21',
    summary:
      'Brazil đang có lợi thế nhẹ theo mô hình vì khả năng tạo cơ hội vẫn ổn định, trong khi Pháp biến động hơn ở hàng thủ khi gặp các pha tấn công tốc độ cao.',
    outcomes: [
      {
        id: 'home',
        label: 'Brazil',
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
        label: 'Pháp',
        value: 21,
        trend: -3.1,
        direction: 'down',
      },
    ],
  },
  reasoning: {
    headline: 'Lợi thế của Brazil đến từ khả năng kiểm soát chuyển trạng thái và chất lượng dứt điểm rõ ràng hơn.',
    description:
      'Mô hình đang đặt trọng số cao hơn vào hiệu suất tấn công gần đây, khả năng thu hồi bóng ở tuyến giữa và rủi ro chấn thương thay vì lịch sử đối đầu.',
    points: [
      {
        id: 'shot-quality',
        title: 'Chênh lệch chất lượng dứt điểm',
        detail:
          'Brazil tạo nhiều hơn 0.34 bàn thắng kỳ vọng mỗi 90 phút từ khu vực trung lộ trong bốn trận chính thức gần nhất.',
        impact: 'high',
      },
      {
        id: 'press-resistance',
        title: 'Áp lực lên khâu triển khai của Pháp',
        detail:
          'Pháp mất bóng ở phần sân nhà nhiều hơn 18% khi gặp các đội pressing quyết liệt.',
        impact: 'medium',
      },
      {
        id: 'lineup-risk',
        title: 'Đội hình còn bất định',
        detail:
          'Hai hậu vệ Pháp vẫn bị đánh dấu hạn chế thể trạng, khiến mô hình tăng trọng số cho xác nhận đội hình muộn.',
        impact: 'medium',
      },
    ],
  },
  markets: [
    {
      id: 'asian-handicap',
      name: 'Kèo Châu Á: Brazil -1.0',
      probability: 61,
      edge: 5.8,
      risk: 'Medium',
      signal: 'Brazil có lợi thế kiểm soát nhịp và tạo cơ hội',
      detail:
        'Dòng handicap phù hợp với người chơi quen kèo Châu Á. Mô hình đánh giá Brazil có đủ biên thắng để vượt mốc -1.0 nếu duy trì pressing trung lộ.',
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
      name: '1X2: Brazil thắng',
      probability: 58,
      edge: 3.4,
      risk: 'Low',
      signal: 'Xác suất thắng cao hơn hai cửa còn lại',
      detail:
        '1X2 là kèo kết quả trận đấu cơ bản: Brazil thắng, hòa hoặc Pháp thắng. Mô hình vẫn nghiêng về Brazil nhờ chất lượng cơ hội trung lộ.',
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
      signal: 'Brazil có xu hướng ép biên và tạo tạt bóng',
      detail:
        'Kèo corner phù hợp khi Brazil được dự báo tạo nhiều pha vào bóng hai biên, sút bị chặn và ép Pháp phòng ngự sâu trong phần lớn thời lượng trận.',
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
      detail: 'Xác suất Brazil thắng tăng 1.6 điểm sau khi mô hình điều chỉnh trọng số cho chỉ số thu hồi bóng tuyến giữa.',
      type: 'model',
    },
    {
      id: 'feed-2',
      time: '18:27',
      title: 'Phát hiện bất định đội hình',
      detail: 'Trung vệ lệch trái của Pháp vẫn cần theo dõi. Tác động lên độ tin cậy hiện ở mức trung bình.',
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
        'Brazil đang nhỉnh hơn với xác suất 58%. Yếu tố mạnh nhất là chất lượng dứt điểm từ trung lộ, không phải tỷ lệ kiểm soát bóng.',
    },
    {
      id: 'chat-2',
      sender: 'user',
      message: 'Điều gì sẽ khiến Pháp trở thành lựa chọn số một của mô hình?',
    },
    {
      id: 'chat-3',
      sender: 'ai',
      message:
        'Nếu hàng thủ mạnh nhất của Pháp được xác nhận và ước tính cường độ pressing của Brazil giảm, xác suất của Pháp sẽ tiến gần 29%.',
    },
  ],
  prompts: [
    'Giải thích lợi thế của Brazil',
    'Điều gì thay đổi trong giờ qua?',
    'Kèo nào có rủi ro thấp nhất?',
  ],
}
