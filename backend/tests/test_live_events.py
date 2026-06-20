from __future__ import annotations

import json
from datetime import UTC, datetime

import httpx
import pytest
from fastapi import FastAPI

from app.api.routes import live_events
from app.connectors.live_events.api_football import APIFootballLiveEventsConnector
from app.core.app_config import AppConfig
from app.dependencies import get_live_event_service
from app.services.live_event_service import FileLiveFixtureMapRepository, LiveEventService


@pytest.mark.asyncio
async def test_live_event_service_returns_not_configured_without_api_key(tmp_path):
    config = AppConfig(
        api_football_api_key=None,
        live_events_fixture_map_file=tmp_path / "live_fixture_map.json",
    )
    service = LiveEventService(
        config=config,
        api_football_connector=APIFootballLiveEventsConnector(config=config),
        fixture_map=FileLiveFixtureMapRepository(mapping_file=config.live_events_fixture_map_file),
    )

    snapshot = await service.get_snapshot(match_id="2026-001-mexico-vs-south-africa")

    assert snapshot.provider_status == "not_configured"
    assert snapshot.events == []
    assert snapshot.error == "Set API_FOOTBALL_API_KEY to fetch live match events."


@pytest.mark.asyncio
async def test_live_event_service_returns_lineups_not_configured_without_api_key(tmp_path):
    config = AppConfig(
        api_football_api_key=None,
        live_events_fixture_map_file=tmp_path / "live_fixture_map.json",
    )
    service = LiveEventService(
        config=config,
        api_football_connector=APIFootballLiveEventsConnector(config=config),
        fixture_map=FileLiveFixtureMapRepository(mapping_file=config.live_events_fixture_map_file),
    )

    lineups = await service.get_lineups(match_id="2026-001-mexico-vs-south-africa")

    assert lineups.provider_status == "not_configured"
    assert lineups.lineups == []
    assert lineups.error == "Set API_FOOTBALL_API_KEY to fetch match lineups."


@pytest.mark.asyncio
async def test_live_event_service_uses_mapping_file(tmp_path):
    mapping_file = tmp_path / "live_fixture_map.json"
    mapping_file.write_text(
        json.dumps(
            {
                "2026-001-mexico-vs-south-africa": {
                    "provider": "api_football",
                    "provider_fixture_id": "123456",
                }
            }
        ),
        encoding="utf-8",
    )
    config = AppConfig(api_football_api_key=None, live_events_fixture_map_file=mapping_file)
    service = LiveEventService(
        config=config,
        api_football_connector=APIFootballLiveEventsConnector(config=config),
        fixture_map=FileLiveFixtureMapRepository(mapping_file=config.live_events_fixture_map_file),
    )

    snapshot = await service.get_snapshot(match_id="2026-001-mexico-vs-south-africa")

    assert snapshot.provider_status == "not_configured"
    assert snapshot.provider_fixture_id == "123456"


@pytest.mark.asyncio
async def test_live_event_service_returns_product_message_without_fixture_mapping(tmp_path):
    config = AppConfig(
        api_football_api_key="test-key",
        live_events_fixture_map_file=tmp_path / "live_fixture_map.json",
    )
    service = LiveEventService(
        config=config,
        api_football_connector=APIFootballLiveEventsConnector(config=config),
        fixture_map=FileLiveFixtureMapRepository(mapping_file=config.live_events_fixture_map_file),
    )

    snapshot = await service.get_snapshot(match_id="2026-001-mexico-vs-south-africa")

    assert snapshot.provider_status == "unmapped"
    assert snapshot.provider_fixture_id is None
    assert snapshot.error == "Trận này chưa được liên kết dữ liệu live từ nhà cung cấp."


@pytest.mark.asyncio
async def test_api_football_connector_normalizes_fixture_and_events(tmp_path):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/fixtures":
            return httpx.Response(
                200,
                json={
                    "errors": [],
                    "response": [
                        {
                            "fixture": {
                                "id": 123456,
                                "date": "2026-06-11T19:00:00+00:00",
                                "status": {"short": "1H", "elapsed": 26, "extra": None},
                            },
                            "teams": {
                                "home": {"id": 10, "name": "Mexico"},
                                "away": {"id": 20, "name": "South Africa"},
                            },
                            "goals": {"home": 1, "away": 0},
                        }
                    ],
                },
            )
        if request.url.path == "/fixtures/events":
            return httpx.Response(
                200,
                json={
                    "errors": [],
                    "response": [
                        {
                            "time": {"elapsed": 9, "extra": None},
                            "team": {"id": 10, "name": "Mexico"},
                            "player": {"id": 99, "name": "Player One"},
                            "assist": {"id": 100, "name": "Player Two"},
                            "type": "Goal",
                            "detail": "Normal Goal",
                            "comments": None,
                        },
                        {
                            "time": {"elapsed": 22, "extra": None},
                            "team": {"id": 20, "name": "South Africa"},
                            "player": {"id": 88, "name": "Player Three"},
                            "assist": {"id": None, "name": None},
                            "type": "Card",
                            "detail": "Yellow Card",
                            "comments": None,
                        },
                    ],
                },
            )
        if request.url.path == "/fixtures/statistics":
            return httpx.Response(
                200,
                json={
                    "errors": [],
                    "response": [
                        {
                            "team": {"id": 10, "name": "Mexico"},
                            "statistics": [
                                {"type": "Shots on Goal", "value": 4},
                                {"type": "Corner Kicks", "value": 5},
                                {"type": "Ball Possession", "value": "56%"},
                                {"type": "Yellow Cards", "value": 1},
                            ],
                        },
                        {
                            "team": {"id": 20, "name": "South Africa"},
                            "statistics": [
                                {"type": "Shots on Goal", "value": 1},
                                {"type": "Corner Kicks", "value": 2},
                                {"type": "Ball Possession", "value": "44%"},
                                {"type": "Yellow Cards", "value": 1},
                            ],
                        },
                    ],
                },
            )
        return httpx.Response(404, json={"errors": ["not found"]})

    config = AppConfig(
        api_football_api_key="test-key",
        api_football_base_url="https://api-football.test",
        live_events_fixture_map_file=tmp_path / "live_fixture_map.json",
    )
    connector = APIFootballLiveEventsConnector(
        config=config,
        transport=httpx.MockTransport(handler),
    )

    snapshot = await connector.fetch_snapshot(
        match_id="2026-001-mexico-vs-south-africa",
        provider_fixture_id="123456",
    )

    assert snapshot.provider_status == "ready"
    assert snapshot.clock.phase == "first_half"
    assert snapshot.clock.elapsed == 26
    assert snapshot.score.home == 1
    assert snapshot.score.away == 0
    assert [event.type for event in snapshot.events] == ["goal", "card"]
    assert snapshot.events[0].team.side == "home"
    assert snapshot.events[0].player.name == "Player One"
    assert snapshot.events[0].assist_player.name == "Player Two"
    assert snapshot.events[1].team.side == "away"
    assert snapshot.raw["statistics"][0]["statistics"][1]["type"] == "Corner Kicks"


@pytest.mark.asyncio
async def test_api_football_connector_normalizes_fixture_lineups(tmp_path):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/fixtures/lineups"
        assert request.url.params["fixture"] == "123456"
        return httpx.Response(
            200,
            json={
                "errors": [],
                "response": [
                    {
                        "team": {"id": 10, "name": "Mexico", "logo": "https://logo.test/mexico"},
                        "coach": {"id": 7, "name": "Coach One", "photo": "https://photo.test/7"},
                        "formation": "4-3-3",
                        "startXI": [
                            {
                                "player": {
                                    "id": 99,
                                    "name": "Player One",
                                    "number": 10,
                                    "pos": "F",
                                    "grid": "4:2",
                                }
                            }
                        ],
                        "substitutes": [
                            {
                                "player": {
                                    "id": 88,
                                    "name": "Player Two",
                                    "number": 12,
                                    "pos": "M",
                                    "grid": None,
                                }
                            }
                        ],
                    }
                ],
            },
        )

    config = AppConfig(
        api_football_api_key="test-key",
        api_football_base_url="https://api-football.test",
        live_events_fixture_map_file=tmp_path / "live_fixture_map.json",
    )
    connector = APIFootballLiveEventsConnector(
        config=config,
        transport=httpx.MockTransport(handler),
    )

    lineups = await connector.fetch_lineups(
        match_id="2026-001-mexico-vs-south-africa",
        provider_fixture_id="123456",
    )

    assert lineups.provider_status == "ready"
    assert lineups.lineups[0].team.name == "Mexico"
    assert lineups.lineups[0].team.id == "10"
    assert lineups.lineups[0].coach.name == "Coach One"
    assert lineups.lineups[0].formation == "4-3-3"
    assert lineups.lineups[0].start_xi[0].name == "Player One"
    assert lineups.lineups[0].start_xi[0].number == 10
    assert lineups.lineups[0].start_xi[0].position == "F"
    assert lineups.lineups[0].start_xi[0].grid == "4:2"
    assert lineups.lineups[0].substitutes[0].name == "Player Two"


@pytest.mark.asyncio
async def test_live_lineups_route_returns_service_response():
    class FakeLiveEventService:
        async def get_lineups(
            self,
            *,
            match_id: str,
            provider_fixture_id: str | None = None,
            force_refresh: bool = False,
        ) -> dict:
            assert match_id == "2026-001-mexico-vs-south-africa"
            assert provider_fixture_id == "123456"
            assert force_refresh is True
            return {
                "match_id": match_id,
                "provider": "api_football",
                "provider_fixture_id": provider_fixture_id,
                "provider_status": "ready",
                "observed_at": datetime.now(UTC).isoformat(),
                "fetched_at": datetime.now(UTC).isoformat(),
                "lineups": [],
                "error": None,
                "raw": {},
            }

    app = FastAPI()
    app.include_router(live_events.router, prefix="/api/live")
    app.dependency_overrides[get_live_event_service] = lambda: FakeLiveEventService()

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            "/api/live/matches/2026-001-mexico-vs-south-africa/lineups",
            params={"provider_fixture_id": "123456", "force_refresh": "true"},
        )

    assert response.status_code == 200
    assert response.json()["provider_status"] == "ready"
