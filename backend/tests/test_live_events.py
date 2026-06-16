from __future__ import annotations

import json

import httpx
import pytest

from app.connectors.live_events.api_football import APIFootballLiveEventsConnector
from app.core.app_config import AppConfig
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

