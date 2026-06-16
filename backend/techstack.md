# Backend Tech Stack

Tài liệu này mô tả tech stack backend đề xuất cho Futbolia - AI World Cup Prediction Platform, dựa trên backend của project tham chiếu `incept_arena`.

Backend nên là một Python service dùng FastAPI, tổ chức theo hướng API-first, service-layer rõ ràng, có adapter riêng cho dữ liệu bên ngoài, có persistence/cache tách biệt và có AI agent layer để xử lý prediction, reasoning, search context và chat.

## Tổng quan

Backend chịu trách nhiệm cung cấp API cho frontend prediction experience: danh sách match, match detail, AI prediction, confidence, reasoning, market insight, probability movement, AI feed, chat và user/session state nếu cần.

Baseline nên follow kiến trúc của `incept_arena/backend`: `src/app/main.py` làm entry point, `server.py` tạo FastAPI app, `api/routes` chứa HTTP contract, `services` chứa business logic, `connectors` chứa adapter đến external provider, `models` chứa Pydantic schema, `agents` chứa AI runtime, `workers` xử lý job nền và `core` chứa cấu hình/env.

## Stack chính

| Nhóm | Công nghệ | Vai trò trong project |
| --- | --- | --- |
| Runtime | Python 3.12 | Runtime chính của backend, match với Docker image và `pyproject.toml` của `incept_arena`. |
| Package manager | uv | Cài dependency, lock version, chạy command local và build container nhanh. |
| Web framework | FastAPI | HTTP API, validation, OpenAPI docs, dependency injection và middleware. |
| ASGI server | Uvicorn | Chạy FastAPI app local, production container và health check. |
| Data validation | Pydantic | Request/response schema, domain model, config object và AI structured output. |
| AI agent runtime | Pydantic AI | Agent abstraction, model adapters, tools, streaming và structured responses. |
| LLM gateway | Bifrost/OpenAI-compatible endpoint | Routing model qua OpenAI-compatible API; hỗ trợ OpenAI, Gemini/Vertex, Qwen, DeepSeek, BytePlus hoặc provider tương thích. |
| LLM libraries | `langchain-core`, `langchain-openai`, `tiktoken` | Message utilities, OpenAI-compatible client integration và token handling. |
| Search/context | Perplexity, Google Search API hoặc Tavily | Bổ sung search/news context cho prediction và chat. |
| HTTP client | httpx | Gọi external API như sports data, odds provider, search provider hoặc model gateway. |
| Primary database | MySQL + PyMySQL | Lưu user, prediction run, bot/job config, match snapshot, prediction history và audit trail. |
| Cache/queue | Redis | Cache JSON ngắn hạn, session cache, feed state và queue job nền. |
| Document memory | MongoDB + PyMongo | Lưu agent memory, conversation memory hoặc user profile nếu cần chat dài hạn. |
| Auth | JWT + PyJWT | Access token cho browser/API clients; dùng HTTP Bearer auth ở route cần user context. |
| Background worker | Python worker + Redis queue | Chạy prediction batch, refresh probability, polling feed hoặc scheduled jobs. |
| Logging | Python logging + `logging.ini` | Structured-ish server logs, response logging middleware và log level config. |
| Testing | pytest | Unit/API tests cho route, service, connector, agent payload và persistence logic. |
| Linting | Ruff | Lint/format Python code theo một tool thống nhất. |
| Container | Docker, Docker Compose | Build backend image, chạy API service, worker và Redis local/production-like. |

## Luồng chạy app

```text
src/app/main.py
└── configure logging
└── app.server.create_app()
    ├── FastAPI metadata
    ├── CORS middleware
    ├── response logging middleware
    ├── health/root routes
    └── include app.api.router.api_router
        └── app.api.routes.*
            └── app.dependencies.*
                ├── services.*
                ├── connectors.*
                └── models.*
```

- `src/app/main.py` là import target cho Uvicorn: `app.main:app`.
- `src/app/server.py` tạo FastAPI app, cấu hình CORS, middleware và include router.
- `src/app/api/router.py` là nơi gom tất cả route module.
- `src/app/dependencies.py` cung cấp dependency provider dùng `lru_cache` cho connector/service singleton nhẹ.
- `src/app/core/app_config.py` đọc `.env`, normalize config và cung cấp object cấu hình dùng chung.

## Cấu trúc backend đề xuất

```text
backend/
├── src/
│   └── app/
│       ├── main.py
│       ├── server.py
│       ├── dependencies.py
│       ├── api/
│       │   ├── router.py
│       │   └── routes/
│       │       ├── matches.py
│       │       ├── predictions.py
│       │       ├── markets.py
│       │       ├── feed.py
│       │       ├── chat.py
│       │       └── users.py
│       ├── core/
│       │   ├── app_config.py
│       │   └── settings.py
│       ├── models/
│       │   ├── matches.py
│       │   ├── predictions.py
│       │   ├── markets.py
│       │   ├── feed.py
│       │   ├── chat.py
│       │   └── users.py
│       ├── services/
│       │   ├── prediction_context.py
│       │   ├── prediction_agent.py
│       │   ├── prediction_persistence.py
│       │   ├── market_insight.py
│       │   ├── probability_movement.py
│       │   ├── search.py
│       │   └── auth_tokens.py
│       ├── connectors/
│       │   ├── sports_data/
│       │   ├── odds/
│       │   ├── news/
│       │   └── llm/
│       ├── agents/
│       │   ├── base.py
│       │   ├── prediction_chat.py
│       │   ├── model_adapters/
│       │   ├── memory/
│       │   ├── prompts/
│       │   └── search_service/
│       └── workers/
│           └── prediction_worker.py
├── sql/
├── tests/
├── scripts/
├── Dockerfile
├── pyproject.toml
├── uv.lock
└── .env.example
```

Không cần tạo toàn bộ module ngay từ đầu. Khi thêm feature mới, nên đặt đúng boundary để route không chứa business logic nặng.

## Boundary trách nhiệm

| Folder/module | Trách nhiệm |
| --- | --- |
| `api/routes` | FastAPI route, request/response contract, auth dependency và status code. |
| `models` | Pydantic schema cho API payload, domain object và structured AI response. |
| `services` | Business logic nội bộ: prediction workflow, context building, persistence, scoring, cache, auth. |
| `connectors` | Adapter đến external API: sports fixtures/results, odds, news/search, LLM gateway. |
| `agents` | Pydantic AI base agent, prompt, tools, model adapter, memory và streaming logic. |
| `workers` | Job nền xử lý batch prediction, scheduled refresh hoặc long-running feed updates. |
| `core` | `.env`, settings, config normalization, shared constants. |
| `sql` | MySQL schema và migration file thủ công. |
| `tests` | Unit/API tests theo route, service, connector và worker. |

Rule import nên dùng package `app.*`, ví dụ:

```python
from app.core.app_config import app_config
from app.services.prediction_agent import PredictionAgentWorkflowService
```

Không nên import theo `src.*`.

## API module đề xuất

| API | Mục đích |
| --- | --- |
| `GET /health` | Readiness/liveness check cho container và deploy platform. |
| `GET /api/matches` | Danh sách match theo tournament, date, team hoặc status. |
| `GET /api/matches/{match_id}` | Match detail, lineups, stats, odds snapshot và prediction summary. |
| `POST /api/predictions/run` | Chạy AI prediction cho một match hoặc market cụ thể. |
| `GET /api/predictions/{prediction_id}` | Lấy prediction result, confidence, reasoning và audit payload. |
| `GET /api/markets` | Market list, odds, implied probability và suggested markets. |
| `GET /api/probability-movement/{match_id}` | Time series probability/odds movement. |
| `GET /api/feed` | AI feed, news event, injury/team update hoặc model update. |
| `POST /api/chat` | Chat với AI về match/prediction context. |
| `POST /api/users/sign-up` | Tạo user nếu app cần account. |
| `POST /api/users/login` | Password login, trả JWT access token. |

## AI và prediction layer

Backend nên giữ AI layer tương tự `incept_arena`:

- `BasePydanticAgent` quản lý model config, tool registry, history và streaming event.
- `model_adapters` resolve model name sang provider thực tế qua Bifrost/OpenAI-compatible endpoint.
- `prompts` chứa system prompt và prompt template cho prediction/chat.
- `search_service` gom search/news provider, tránh gọi Perplexity/Tavily trực tiếp trong route.
- `PredictionAgentWorkflowService` nhận context đã chuẩn hóa, gọi agent, validate structured output rồi lưu run result.

Luồng prediction nên tách rõ:

```text
POST /api/predictions/run
└── PredictionPersistence.start_run()
└── PredictionContextService.snapshot(match_id)
    ├── sports data connector
    ├── odds connector
    ├── news/search connector
    └── historical probability movement
└── PredictionAgentWorkflowService.run()
    ├── build prompt
    ├── call Pydantic AI agent
    ├── parse structured result
    └── compute confidence/market insight
└── PredictionPersistence.complete_run()
└── return prediction response
```

Structured AI output nên được validate bằng Pydantic model trước khi trả về frontend. Route không nên trả raw LLM text làm contract chính.

## Persistence và cache

`incept_arena` dùng MySQL cho dữ liệu nghiệp vụ, Redis cho cache/queue và MongoDB cho agent memory. Backend Futbolia nên follow cùng hướng:

- MySQL lưu user, match snapshot, prediction run, prediction decision, market snapshot, odds history, chat thread metadata và audit payload.
- Redis lưu cache JSON ngắn hạn, job queue, feed cursor, in-flight lock và batch prediction status.
- MongoDB chỉ nên dùng khi cần long-term conversation memory hoặc profile memory cho AI chat.
- SQL migration nên nằm trong `backend/sql` theo thứ tự tăng dần như `001_create_prediction_tables.sql`.
- Persistence code nên nằm trong `services/*_persistence.py` hoặc folder con `services/prediction_persistence/`, không đặt trực tiếp trong route.

## Environment config

Backend nên đọc `.env` từ folder `backend` và expose config qua `app.core.app_config`.

Biến môi trường đề xuất:

```text
APP_ENV=local
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=futbolia

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

MONGODB_URI=
MONGODB_DB_NAME=futbolia_agent
MONGODB_COLLECTION_NAME=conversation_memory
MONGODB_PROFILE_COLLECTION_NAME=memory

JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

BIFROST_ENDPOINT_URL=https://bifrost.azaps.net/v1
BIFROST_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=openainexira/gpt-5.4-mini
MODEL_NAME=openainexira/gpt-5.4-mini

PERPLEXITY_API_KEY=
TAVILY_API_KEY=
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=
NEWS_API_KEY=

SPORTS_DATA_API_KEY=
ODDS_API_KEY=
```

Không nên đọc `os.getenv` rải rác trong route/service. Mọi config nên đi qua `app_config` hoặc settings object chuyên biệt.

## Local commands

Các command nên mirror `incept_arena`:

```bash
cd backend
uv sync
PYTHONPATH=src uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Script tiện ích nên đặt trong `backend/scripts/run_fastapi.sh`:

```bash
./backend/scripts/run_fastapi.sh
```

Test và lint:

```bash
cd backend
PYTHONPATH=src uv run pytest
uv run ruff check src tests
uv run python -m compileall -q src/app
```

Docker:

```bash
docker compose up --build backend redis
```

## Docker baseline

Dockerfile nên dùng image `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`, giống `incept_arena`:

- Set `PYTHONPATH=/app/src`.
- Copy `pyproject.toml` và `uv.lock` trước để cache dependency layer.
- Chạy `uv sync --frozen --no-dev --no-install-project`.
- Copy `src`, `config`, `dataset` nếu có và `logging.ini`.
- Expose port `8000`.
- Health check gọi `GET /health`.
- CMD chạy `uvicorn app.main:app --host 0.0.0.0 --port 8000`.

Compose nên có ít nhất:

- `backend`: FastAPI API service.
- `backend-worker`: worker xử lý Redis queue nếu có batch prediction.
- `redis`: Redis 7 Alpine.
- `mysql`: có thể dùng local managed DB hoặc service compose tùy môi trường.

## Testing strategy

- `tests/api`: test route contract, status code, auth và response schema.
- `tests/services`: test prediction context, market insight, probability movement, prompt builder và persistence mapping.
- `tests/connectors`: test adapter với mocked HTTP responses.
- `tests/agents`: test model adapter, prompt payload và structured output parsing.
- `tests/workers`: test queue enqueue/dequeue, lock behavior và idempotency.

Các external provider phải được mock trong test. Không để test mặc định gọi real sports API, odds API hoặc model provider.

## Quy ước nên giữ

- Source root là `backend/src`; khi chạy local phải set `PYTHONPATH=src`.
- App import target là `app.main:app`.
- Route chỉ làm HTTP boundary, không chứa workflow dài.
- Tất cả request/response public phải có Pydantic model.
- External API luôn đi qua `connectors`, không gọi trực tiếp từ `services` nếu provider có thể thay đổi.
- AI output phải parse/validate thành structured model trước khi lưu DB hoặc trả frontend.
- Redis cache phải có TTL và fallback khi Redis unavailable.
- MySQL persistence phải dùng transaction rõ ràng cho prediction run lifecycle.
- JWT secret production phải là giá trị random dài, không dùng default local.
- Response logging phải redact token, password, API key, private key và secret.
- `.env.example` phải có đủ biến cần thiết nhưng không chứa secret thật.
