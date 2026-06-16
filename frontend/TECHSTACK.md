# Frontend Tech Stack

Tài liệu này mô tả tech stack frontend đề xuất cho Futbolia - AI World Cup Prediction Platform, dựa trên `frontend/DESIGN.md` và cấu trúc frontend chuẩn đang dùng ở project tham chiếu `landing_page_skrice`.

## Tổng quan

Frontend nên là một React single page application, build bằng Vite, viết bằng TypeScript và tổ chức theo hướng component/page/layout. App tập trung vào trải nghiệm prediction-first: hiển thị match context, AI prediction, confidence, reasoning, market insight, probability movement, AI feed và chat theo thứ tự ưu tiên rõ ràng.

Baseline nên follow cấu trúc của `landing_page_skrice`: `src/main.tsx` làm entry point, `App.tsx` làm app shell, `routes` quản lý route tree, `pages` chứa màn hình theo route, `components` chứa UI block dùng lại, `layouts` chứa wrapper, `store` quản lý global state và `styles` chứa SCSS nền tảng.

## Stack chính

| Nhóm | Công nghệ | Vai trò trong project |
| --- | --- | --- |
| UI runtime | React, React DOM | Xây dựng component UI và render app vào DOM tại `src/main.tsx`. |
| Build tool | Vite, `@vitejs/plugin-react` | Dev server, production build, preview build và React transform. |
| Ngôn ngữ | TypeScript | Type-safe source code cho `.ts` và `.tsx`; nên bật strict mode ngay từ đầu. |
| Routing | React Router DOM | Route tree, nested routes, route-level pages và fallback `NotFound`. |
| State management | Redux Toolkit, React Redux | Store global cho app state, prediction state, selected match, feed/chat state nếu cần dùng xuyên app. |
| Side effects | Redux Saga | Quản lý async flow, polling, websocket/event stream, prediction refresh và AI feed side effects. |
| Styling | Sass, SCSS Modules | Style chính cho page/component, colocate theo folder như `MatchHero.module.scss`. |
| Utility CSS pipeline | Tailwind CSS, PostCSS, Autoprefixer | Pipeline utility CSS nếu cần, nhưng style chính vẫn nên ưu tiên SCSS Modules để giữ nhất quán. |
| CSS-in-JS | styled-components | Chỉ dùng cho dynamic CSS/animation hoặc component đã có nhu cầu runtime style rõ ràng. |
| Class composition | clsx | Ghép class có điều kiện cho state như active, selected, loading, positive/negative movement. |
| Static assets | `public/images`, `public/fonts`, `public/icons` | Chứa flag, logo, font, icon, illustration hoặc asset public khác. |
| Linting | ESLint, TypeScript ESLint, React Hooks, React Refresh | Flat config tại `eslint.config.js`, lint toàn frontend bằng `npm run lint`. |
| Deploy | Vercel hoặc static hosting tương đương | Rewrite SPA route về `index.html` nếu deploy bằng static hosting. |

## Luồng chạy app

```text
src/main.tsx
└── React StrictMode
    └── Redux Provider
        └── RouterProvider
            └── App.tsx
                ├── App providers / bootstrapping
                ├── Header hoặc AppShell
                ├── Outlet
                └── Global overlays
```

- `src/main.tsx` là entry point, import global style từ `src/styles/main.scss`.
- `src/App.tsx` là app shell, xử lý app-level bootstrapping và render route outlet.
- `src/routes/index.tsx` định nghĩa route tree bằng React Router.
- `src/constants/routes.ts` gom route segment, route path và navigation item để tránh hard-code URL rải rác.
- Các provider cấp app như Redux, router, theme hoặc error boundary nên được đặt ở tầng entry/app shell.

## Cấu trúc frontend đề xuất

```text
frontend/
├── public/
│   ├── fonts/
│   ├── icons/
│   └── images/
├── src/
│   ├── components/
│   │   ├── Common/
│   │   ├── Header/
│   │   ├── MatchHero/
│   │   ├── PredictionCard/
│   │   ├── ReasoningPanel/
│   │   ├── MarketList/
│   │   ├── ProbabilityChart/
│   │   ├── AiFeed/
│   │   └── ChatPanel/
│   ├── config/
│   ├── constants/
│   ├── helpers/
│   ├── hooks/
│   ├── layouts/
│   ├── pages/
│   │   ├── Home/
│   │   ├── MatchDetail/
│   │   └── NotFound/
│   ├── routes/
│   ├── store/
│   ├── styles/
│   ├── App.tsx
│   └── main.tsx
├── docs/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Không cần tạo toàn bộ folder ngay từ đầu nếu chưa dùng tới. Tuy nhiên khi thêm feature mới, nên đặt đúng nhóm trách nhiệm để project không bị dồn logic vào một page lớn.

## Page và component organization

- `src/pages` chứa màn hình cấp route, ví dụ `Home`, `MatchDetail`, `NotFound`.
- Mỗi page đặt trong một folder riêng, export chính từ `index.tsx` và colocate style bằng `*.module.scss`.
- `src/components` chứa UI block dùng lại hoặc block lớn của product như `MatchHero`, `PredictionCard`, `ReasoningPanel`, `MarketList`, `AiFeed`, `ChatPanel`.
- Component dùng lại rộng rãi nên đặt trong `components/Common`.
- Component nên nhận dữ liệu qua props hoặc selector rõ ràng, tránh tự hard-code route, API endpoint hoặc global state shape.
- Layout wrapper như max-width container, dashboard shell hoặc split view nên đặt trong `src/layouts`.

## Styling strategy

- Dark mode là mặc định, bám theo design token trong `frontend/DESIGN.md`.
- Style chính đặt cạnh component/page dưới dạng `*.module.scss`.
- Global style đi qua `src/styles/main.scss`, import reset, variables, mixins, common và global rules.
- Token màu, spacing, radius, typography nên đặt trong `src/styles/abstracts/_variables.scss`.
- Vite nên cấu hình inject SCSS abstracts vào mọi SCSS module để component style dùng chung biến/mixin mà không cần import lặp lại.
- `clsx` dùng cho class có điều kiện như prediction trend, confidence level, active tab, selected market.
- `styled-components` chỉ nên dùng khi cần dynamic animation/runtime style; không dùng thay SCSS Modules làm style mặc định.
- Tailwind có thể giữ trong pipeline nếu cần utility nhanh, nhưng không nên trộn quá nhiều style strategy trong cùng một component.

## State management

Store nên tạo tại `src/store/index.ts` bằng Redux Toolkit:

- `configureStore` là entry tạo store.
- Tắt thunk mặc định nếu dùng Redux Saga làm side-effect layer chính.
- Gắn `redux-saga` middleware.
- `rootReducer.ts` gom reducer theo feature.
- `rootSaga.ts` gom saga theo feature bằng `all`.
- `selectors.ts` gom selector cấp app hoặc re-export selector theo feature.

Feature state đề xuất:

- `app`: loaded state, viewport state, global UI state.
- `matches`: danh sách match, selected match, loading/error.
- `prediction`: winner probability, confidence, reasoning, movement history.
- `markets`: suggested markets, odds/probability comparison nếu có.
- `feed`: AI updates, real-time events, refresh status.
- `chat`: messages, streaming status, user prompt state.

Local UI state vẫn nên nằm trong component nếu chỉ dùng trong một chỗ, ví dụ tab đang mở, accordion expanded hoặc hover state.

## Environment config

Project nên dùng Vite env, nên mọi biến môi trường frontend cần có prefix `VITE_`.

Các biến đề xuất:

```text
VITE_API_URL=
VITE_WS_URL=
VITE_PUBLIC_STATICS_URL=
VITE_APP_ENV=
```

- `src/config/env.ts` nên là nơi duy nhất đọc `import.meta.env`.
- Component/page không nên đọc trực tiếp env variable.
- URL API, websocket và static asset nên được normalize qua helper/config để tránh hard-code.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

- `npm run dev`: chạy Vite dev server.
- `npm run build`: type-check bằng TypeScript, sau đó build production bằng Vite.
- `npm run lint`: chạy ESLint.
- `npm run preview`: preview production build local.

Nên chọn một package manager chính cho frontend. Nếu dùng npm thì commit `package-lock.json`; nếu dùng Yarn thì commit `yarn.lock`, tránh giữ cả hai lockfile.

## Quy ước nên giữ

- Dùng alias `@/*` cho import từ `src/*`.
- Route path nên lấy từ `src/constants/routes.ts`.
- Mỗi page/component lớn nên có folder riêng, `index.tsx` làm public entry và style module đặt cùng folder.
- Shared logic nên đưa vào `hooks`, `helpers`, `config`, `store` hoặc shared component thay vì để trong page quá lớn.
- Selector là cách đọc state chính, tránh đọc trực tiếp state shape ở nhiều component.
- API contract hoặc mock data nên đặt riêng trong `helpers`, `services` hoặc feature folder, không hard-code trong component UI.
- Product UI phải giữ thứ tự ưu tiên thông tin: match, prediction, confidence, reasoning, markets, probability movement, AI feed, chat.
