from __future__ import annotations

import importlib
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app import server as app_server
from app.connectors.odds.the_odds_api import TheOddsAPIConnector
from app.core.app_config import AppConfig
from app.models.odds import MatchOddsResponse, OddsEvent, OddsListResponse
from app.models.worldcup import WorldCupMatch
from app.services.odds_service import OddsService


class FakeWorldCupService:
    def __init__(self, match: WorldCupMatch | None = None) -> None:
        self.match = match

    async def get_match(
        self,
        *,
        match_id: str,
        year: int | None = None,
        source: str = "auto",
        force_refresh: bool = False,
    ) -> WorldCupMatch | None:
        return self.match


def _match() -> WorldCupMatch:
    return WorldCupMatch(
        id="2026-001-mexico-vs-south-africa",
        source_index=0,
        competition="World Cup 2026",
        round="Matchday 1",
        date="2026-06-11",
        time="13:00 UTC-6",
        kickoff_utc=datetime(2026, 6, 11, 19, 0, tzinfo=UTC),
        team1="Mexico",
        team2="South Africa",
        group="Group A",
        ground="Mexico City",
        status="scheduled",
    )


def test_app_config_reads_odd_api_alias(monkeypatch):
    app_config_module = importlib.import_module("app.core.app_config")
    app_config_module.get_app_config.cache_clear()
    monkeypatch.delenv("ODDS_API_KEY", raising=False)
    monkeypatch.delenv("ODD_API", raising=False)

    def fake_load_dotenv(path, *, override=False):
        monkeypatch.setenv("ODD_API", "odd-api-key")
        return True

    monkeypatch.setattr(app_config_module, "load_dotenv", fake_load_dotenv)

    try:
        config = app_config_module.get_app_config()
    finally:
        app_config_module.get_app_config.cache_clear()

    assert config.odds_api_key == "odd-api-key"


@pytest.mark.asyncio
async def test_odds_service_returns_not_configured_without_api_key():
    config = AppConfig(odds_api_key=None)
    service = OddsService(
        config=config,
        connector=TheOddsAPIConnector(config=config),
        worldcup_service=FakeWorldCupService(_match()),
    )

    response = await service.get_match_odds(match_id="2026-001-mexico-vs-south-africa")

    assert response.provider_status == "not_configured"
    assert response.match_id == "2026-001-mexico-vs-south-africa"
    assert response.event is None
    assert response.error == "Set ODD_API or ODDS_API_KEY to fetch odds."


@pytest.mark.asyncio
async def test_the_odds_api_connector_fetches_odds_with_configured_query():
    captured: dict[str, Any] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["params"] = dict(request.url.params)
        return httpx.Response(
            200,
            headers={
                "x-requests-remaining": "499",
                "x-requests-used": "1",
                "x-requests-last": "1",
            },
            json=[
                {
                    "id": "event-1",
                    "sport_key": "soccer_fifa_world_cup",
                    "sport_title": "FIFA World Cup",
                    "commence_time": "2026-06-11T19:00:00Z",
                    "home_team": "Mexico",
                    "away_team": "South Africa",
                    "bookmakers": [
                        {
                            "key": "pinnacle",
                            "title": "Pinnacle",
                            "last_update": "2026-06-10T10:00:00Z",
                            "markets": [
                                {
                                    "key": "h2h",
                                    "last_update": "2026-06-10T10:00:00Z",
                                    "outcomes": [
                                        {"name": "Mexico", "price": 1.8},
                                        {"name": "South Africa", "price": 4.5},
                                        {"name": "Draw", "price": 3.2},
                                    ],
                                }
                            ],
                        }
                    ],
                }
            ],
        )

    config = AppConfig(
        odds_api_key="test-odd-key",
        odds_api_base_url="https://api.the-odds-api.test",
        odds_api_regions=["eu", "uk"],
        odds_api_markets=["h2h", "totals"],
    )
    connector = TheOddsAPIConnector(
        config=config,
        transport=httpx.MockTransport(handler),
    )

    response = await connector.fetch_odds(
        sport="soccer_fifa_world_cup",
        regions=["eu", "uk"],
        markets=["h2h", "totals"],
        odds_format="decimal",
    )

    assert captured["url"].startswith(
        "https://api.the-odds-api.test/v4/sports/soccer_fifa_world_cup/odds/"
    )
    assert captured["params"] == {
        "apiKey": "test-odd-key",
        "regions": "eu,uk",
        "markets": "h2h,totals",
        "oddsFormat": "decimal",
        "dateFormat": "iso",
    }
    assert response.provider_status == "ready"
    assert response.remaining_requests == 499
    assert response.events[0].bookmakers[0].markets[0].outcomes[0].price == 1.8


@pytest.mark.asyncio
async def test_odds_service_matches_worldcup_match_to_provider_event():
    class FakeConnector:
        configured = True

        async def fetch_odds(self, **kwargs) -> OddsListResponse:
            return OddsListResponse(
                provider_status="ready",
                generated_at=datetime.now(UTC),
                sport="soccer_fifa_world_cup",
                regions=["eu"],
                markets=["h2h"],
                odds_format="decimal",
                events=[
                    OddsEvent(
                        id="other-event",
                        sport_key="soccer_fifa_world_cup",
                        commence_time=datetime(2026, 6, 11, 19, 0, tzinfo=UTC),
                        home_team="Brazil",
                        away_team="France",
                    ),
                    OddsEvent(
                        id="event-1",
                        sport_key="soccer_fifa_world_cup",
                        commence_time=datetime(2026, 6, 11, 19, 0, tzinfo=UTC),
                        home_team="Mexico",
                        away_team="South Africa",
                    ),
                ],
            )

    config = AppConfig(odds_api_key="test-odd-key")
    service = OddsService(
        config=config,
        connector=FakeConnector(),
        worldcup_service=FakeWorldCupService(_match()),
    )

    response = await service.get_match_odds(match_id="2026-001-mexico-vs-south-africa")

    assert response.provider_status == "ready"
    assert response.match_id == "2026-001-mexico-vs-south-africa"
    assert response.event is not None
    assert response.event.id == "event-1"


def test_match_odds_route_returns_service_response(monkeypatch):
    from app.api.routes import odds as odds_routes
    from app.dependencies import get_odds_service

    class FakeOddsService:
        async def get_match_odds(self, **kwargs) -> MatchOddsResponse:
            return MatchOddsResponse(
                provider_status="ready",
                match_id=kwargs["match_id"],
                sport="soccer_fifa_world_cup",
                regions=["eu"],
                markets=["h2h"],
                odds_format="decimal",
                generated_at=datetime.now(UTC),
                event=OddsEvent(
                    id="event-1",
                    sport_key="soccer_fifa_world_cup",
                    commence_time=datetime(2026, 6, 11, 19, 0, tzinfo=UTC),
                    home_team="Mexico",
                    away_team="South Africa",
                ),
            )

    app = app_server.create_app()
    app.dependency_overrides[get_odds_service] = lambda: FakeOddsService()
    app.dependency_overrides[odds_routes.get_odds_service] = lambda: FakeOddsService()
    client = TestClient(app)

    response = client.get("/api/odds/matches/2026-001-mexico-vs-south-africa")

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider_status"] == "ready"
    assert payload["event"]["id"] == "event-1"
