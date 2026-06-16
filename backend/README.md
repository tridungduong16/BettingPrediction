# Futbolia Backend

FastAPI service that fetches World Cup fixtures/results from public `worldcup.json` mirrors, normalizes match data, and caches the raw payload locally.

## Run locally

```bash
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Scrape once

```bash
uv run python scripts/scrape_worldcup.py --year 2026 --force
```

## API

- `GET /health`
- `GET /api/worldcup/source?year=2026`
- `GET /api/worldcup/matches?year=2026&status=scheduled`
- `GET /api/worldcup/matches/{match_id}?year=2026`
- `POST /api/worldcup/refresh?year=2026`
- `GET /api/live/matches/{match_id}/snapshot`
- `GET /api/live/matches/{match_id}/events`
- `GET /api/live/provider-fixtures/search?date=2026-06-11&team=Mexico`
- `WS /api/live/matches/{match_id}/events/ws`
- `GET /api/news/match?home_team=Pháp&away_team=Senegal`
- `GET /api/predictions/matches/{match_id}/insight`
- `GET /api/predictions/matches/{match_id}/markets`

Default source order is the `upbound-web/worldcup-live.json` mirror first, then the official `openfootball/worldcup.json` generated dataset.

## Live Events

Live events are implemented behind the API-Football adapter. Without `API_FOOTBALL_API_KEY`,
live routes return `provider_status=not_configured` instead of failing.

After getting a key:

```bash
export API_FOOTBALL_API_KEY=...
```

For quick testing, pass the provider fixture id directly:

```bash
curl 'http://127.0.0.1:8000/api/live/matches/2026-001-mexico-vs-south-africa/snapshot?provider_fixture_id=123456'
```

For stable app usage, create `backend/data/live_fixture_map.json`:

```json
{
  "2026-001-mexico-vs-south-africa": {
    "provider": "api_football",
    "provider_fixture_id": "123456"
  }
}
```

## Agents

Reusable agent scaffolding has been ported from the `incept_arena` backend into
`src/app/agents` and adapted for Futbolia:

- `BasePydanticAgent` with tool events, streaming, thread history, and MCP-compatible hooks.
- Bifrost/OpenAI-compatible model adapters, including reasoning-model aliases.
- `FutboliaPredictionAgent`, a football prediction chat agent that accepts match and live-event
  context.

Set these before calling model-backed agent methods:

```bash
export BIFROST_ENDPOINT_URL=https://bifrost.azaps.net/v1
export BIFROST_API_KEY=...
export MODEL_NAME=openainexira/gpt-5.4-mini
```

The agent package can be imported without keys; keys are only required when running model calls.

## News Search

Match news search is implemented behind Perplexity Search API. Without `PERPLEXITY_API_KEY`,
news routes return `provider_status=not_configured` instead of failing.

The query is built from the two team names:

```text
thông tin trận {home_team} và {away_team}
```

After getting a key:

```bash
export PERPLEXITY_API_KEY=...
```

Example:

```bash
curl 'http://127.0.0.1:8000/api/news/match?home_team=Pháp&away_team=Senegal&max_results=5'
```

### Market predictions

`GET /api/predictions/matches/{match_id}/insight` calls a structured LLM agent for the main
dashboard prediction: winner, confidence, win probabilities, reasoning, probability signals, and
net edge.

`GET /api/predictions/matches/{match_id}/markets` calls a separate structured LLM market
prediction agent and returns one prediction with reasoning for each default Vietnamese football
market:

- Kèo Châu Á: `{home} -1.0`
- Tài/Xỉu: `Over 2.5 bàn`
- 1X2: `{home} thắng`, `Hòa`, `{away} thắng`
- Thẻ phạt: `Over 4.5 thẻ`
- Corner: `Over 9.5 góc`

Optional query params:

- `year=2026`
- `source=auto`
- `provider_fixture_id=123456`
- `force_refresh=true`
- `include_live=false`
- `include_news=false`
- `news_max_results=5`
