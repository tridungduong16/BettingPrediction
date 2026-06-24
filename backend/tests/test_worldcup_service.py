from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.connectors.worldcup.openfootball import FetchedWorldCupPayload
from app.core.app_config import AppConfig
from app.services.worldcup_service import FileWorldCupCacheRepository, WorldCupService


class FakeConnector:
    async def fetch_dataset(self, *, year: int, source: str = "auto") -> FetchedWorldCupPayload:
        return FetchedWorldCupPayload(
            year=year,
            source_name="fake",
            source_url="https://example.test/worldcup.json",
            payload={
                "name": f"World Cup {year}",
                "matches": [
                    {
                        "round": "Matchday 1",
                        "date": "2026-06-11",
                        "time": "13:00 UTC-6",
                        "team1": "Mexico",
                        "team2": "South Africa",
                        "score": {"ft": [2, 0], "ht": [1, 0]},
                        "goals1": [{"name": "Player One", "minute": 9}],
                        "goals2": [],
                        "group": "Group A",
                        "ground": "Mexico City",
                    },
                    {
                        "round": "Matchday 8",
                        "date": "2026-06-18",
                        "time": "12:00 UTC-4",
                        "team1": "Czech Republic",
                        "team2": "South Africa",
                        "group": "Group A",
                        "ground": "Atlanta",
                    },
                ],
            },
        )


class SimulationConnector:
    async def fetch_dataset(self, *, year: int, source: str = "auto") -> FetchedWorldCupPayload:
        return FetchedWorldCupPayload(
            year=year,
            source_name="fake",
            source_url="https://example.test/worldcup.json",
            payload={
                "name": f"World Cup {year}",
                "matches": [
                    {
                        "round": "Matchday 1",
                        "date": "2026-06-11",
                        "time": "13:00 UTC-6",
                        "team1": "Mexico",
                        "team2": "South Africa",
                        "score": {"ft": [2, 0]},
                        "group": "Group A",
                        "ground": "Mexico City",
                    },
                    {
                        "round": "Matchday 1",
                        "date": "2026-06-11",
                        "time": "16:00 UTC-6",
                        "team1": "South Korea",
                        "team2": "Czechia",
                        "score": {"ft": [1, 1]},
                        "group": "Group A",
                        "ground": "Mexico City",
                    },
                    {
                        "round": "Matchday 2",
                        "date": "2026-06-18",
                        "time": "12:00 UTC-4",
                        "team1": "Mexico",
                        "team2": "South Korea",
                        "group": "Group A",
                        "ground": "Atlanta",
                    },
                    {
                        "round": "Matchday 2",
                        "date": "2026-06-18",
                        "time": "15:00 UTC-4",
                        "team1": "Czechia",
                        "team2": "South Africa",
                        "group": "Group A",
                        "ground": "Atlanta",
                    },
                    {
                        "round": "Round of 32",
                        "date": "2026-06-28",
                        "time": "12:00 UTC-7",
                        "team1": "1A",
                        "team2": "2A",
                        "ground": "Los Angeles",
                    },
                ],
            },
        )


@pytest.fixture
def config(tmp_path):
    return AppConfig(worldcup_data_dir=tmp_path, worldcup_cache_ttl_seconds=3600)


@pytest.mark.asyncio
async def test_get_dataset_normalizes_matches(config):
    service = WorldCupService(
        config=config,
        connector=FakeConnector(),
        cache=FileWorldCupCacheRepository(data_dir=config.worldcup_data_dir),
    )

    dataset = await service.get_dataset(year=2026, force_refresh=True)

    assert dataset.source.match_count == 2
    assert dataset.source.cache_hit is False
    assert dataset.matches[0].id == "2026-001-mexico-vs-south-africa"
    assert dataset.matches[0].status == "finished"
    assert dataset.matches[0].winner == "Mexico"
    assert dataset.matches[0].kickoff_utc == datetime(2026, 6, 11, 19, 0, tzinfo=UTC)
    assert dataset.matches[1].status == "scheduled"


@pytest.mark.asyncio
async def test_list_matches_filters_by_status_and_team(config):
    service = WorldCupService(
        config=config,
        connector=FakeConnector(),
        cache=FileWorldCupCacheRepository(data_dir=config.worldcup_data_dir),
    )

    dataset = await service.list_matches(year=2026, status="scheduled", team="south")

    assert dataset.source.match_count == 1
    assert dataset.matches[0].team1 == "Czech Republic"
    assert dataset.matches[0].team2 == "South Africa"


@pytest.mark.asyncio
async def test_simulate_tournament_returns_group_scenarios_and_bracket_candidates(config):
    service = WorldCupService(
        config=config,
        connector=SimulationConnector(),
        cache=FileWorldCupCacheRepository(data_dir=config.worldcup_data_dir),
    )

    simulation = await service.simulate_tournament(
        year=2026,
        force_refresh=True,
        scenario_limit=4,
    )

    group = simulation.groups[0]
    assert group.group == "Group A"
    assert group.standings[0].team == "Mexico"
    assert group.standings[0].points == 3
    assert group.total_outcome_paths == 9
    assert group.scenario_count >= 1
    assert "Mexico" in group.possible_winners
    assert "South Korea" in group.possible_runners_up

    fixture = simulation.bracket[0]
    assert fixture.round == "Round of 32"
    assert fixture.team1.label == "1A"
    assert fixture.team1.candidates
    assert fixture.team2.label == "2A"
    assert fixture.possible_pairing_count > 0
