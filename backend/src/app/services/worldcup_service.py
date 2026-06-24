from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
from itertools import product
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.connectors.worldcup.openfootball import (
    FetchedWorldCupPayload,
    OpenFootballWorldCupConnector,
    WorldCupFetchError,
)
from app.core.app_config import AppConfig, WorldCupSourceName
from app.models.worldcup import (
    MatchStatus,
    Score,
    SimulationTargetRound,
    WorldCupDataset,
    WorldCupGroupQualificationScenario,
    WorldCupGroupSimulation,
    WorldCupMatch,
    WorldCupScenarioOutcome,
    WorldCupSimulatedFixture,
    WorldCupSimulationResponse,
    WorldCupSimulationSlot,
    WorldCupSourceInfo,
    WorldCupTeamStanding,
)


class WorldCupDataUnavailableError(RuntimeError):
    """Raised when neither the network source nor local cache can supply data."""


@dataclass(frozen=True)
class CachedWorldCupPayload:
    year: int
    source_name: str
    source_url: str
    fetched_at: datetime
    payload: dict[str, Any]


@dataclass
class TeamStandingState:
    group: str
    team: str
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    goals_for: int = 0
    goals_against: int = 0
    points: int = 0

    @property
    def goal_difference(self) -> int:
        return self.goals_for - self.goals_against

    def copy(self) -> TeamStandingState:
        return TeamStandingState(
            group=self.group,
            team=self.team,
            played=self.played,
            won=self.won,
            drawn=self.drawn,
            lost=self.lost,
            goals_for=self.goals_for,
            goals_against=self.goals_against,
            points=self.points,
        )


@dataclass
class GroupScenarioAccumulator:
    first: str
    second: str
    third: str
    outcomes: list[WorldCupScenarioOutcome]
    tie_breaker_required: bool
    outcome_count: int = 0


class FileWorldCupCacheRepository:
    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir

    def read(self, year: int) -> CachedWorldCupPayload | None:
        path = self._cache_path(year)
        if not path.exists():
            return None

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            fetched_at = datetime.fromisoformat(data["fetched_at"])
            return CachedWorldCupPayload(
                year=int(data["year"]),
                source_name=str(data["source_name"]),
                source_url=str(data["source_url"]),
                fetched_at=fetched_at,
                payload=data["payload"],
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            return None

    def write(self, fetched: FetchedWorldCupPayload, fetched_at: datetime) -> CachedWorldCupPayload:
        self._data_dir.mkdir(parents=True, exist_ok=True)
        cached = CachedWorldCupPayload(
            year=fetched.year,
            source_name=fetched.source_name,
            source_url=fetched.source_url,
            fetched_at=fetched_at,
            payload=fetched.payload,
        )
        path = self._cache_path(fetched.year)
        path.write_text(
            json.dumps(
                {
                    "year": cached.year,
                    "source_name": cached.source_name,
                    "source_url": cached.source_url,
                    "fetched_at": cached.fetched_at.isoformat(),
                    "payload": cached.payload,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return cached

    def _cache_path(self, year: int) -> Path:
        return self._data_dir / f"worldcup_{year}.json"


class WorldCupService:
    def __init__(
        self,
        *,
        config: AppConfig,
        connector: OpenFootballWorldCupConnector,
        cache: FileWorldCupCacheRepository,
    ) -> None:
        self._config = config
        self._connector = connector
        self._cache = cache

    async def get_dataset(
        self,
        *,
        year: int | None = None,
        source: WorldCupSourceName = "auto",
        force_refresh: bool = False,
    ) -> WorldCupDataset:
        resolved_year = year or self._config.worldcup_default_year
        cached = None if force_refresh else self._cache.read(resolved_year)

        if cached and self._cache_matches_source(cached, source) and not self._is_expired(cached):
            return self._normalize(cached, cache_hit=True, stale_cache=False)

        try:
            fetched_at = datetime.now(UTC)
            fetched = await self._connector.fetch_dataset(year=resolved_year, source=source)
            cached = self._cache.write(fetched, fetched_at)
            return self._normalize(cached, cache_hit=False, stale_cache=False)
        except WorldCupFetchError as exc:
            fallback = self._cache.read(resolved_year)
            if fallback and self._cache_matches_source(fallback, source):
                return self._normalize(fallback, cache_hit=True, stale_cache=True)
            raise WorldCupDataUnavailableError(str(exc)) from exc

    async def list_matches(
        self,
        *,
        year: int | None = None,
        source: WorldCupSourceName = "auto",
        status: MatchStatus | None = None,
        team: str | None = None,
        group: str | None = None,
        date: str | None = None,
        round_name: str | None = None,
        force_refresh: bool = False,
    ) -> WorldCupDataset:
        dataset = await self.get_dataset(year=year, source=source, force_refresh=force_refresh)
        matches = [
            match
            for match in dataset.matches
            if self._match_filter(
                match,
                status=status,
                team=team,
                group=group,
                date=date,
                round_name=round_name,
            )
        ]
        dataset.source.match_count = len(matches)
        return WorldCupDataset(source=dataset.source, matches=matches)

    async def get_match(
        self,
        *,
        match_id: str,
        year: int | None = None,
        source: WorldCupSourceName = "auto",
        force_refresh: bool = False,
    ) -> WorldCupMatch | None:
        dataset = await self.get_dataset(year=year, source=source, force_refresh=force_refresh)
        return next((match for match in dataset.matches if match.id == match_id), None)

    async def simulate_tournament(
        self,
        *,
        year: int | None = None,
        source: WorldCupSourceName = "auto",
        target_round: str = "Round of 32",
        scenario_limit: int = 8,
        pairing_limit: int = 48,
        force_refresh: bool = False,
    ) -> WorldCupSimulationResponse:
        dataset = await self.get_dataset(year=year, source=source, force_refresh=force_refresh)
        groups = self._simulate_groups(dataset.matches, scenario_limit=max(1, scenario_limit))
        group_lookup = self._group_lookup(groups)
        resolved_target_round = self._simulation_target_round(target_round, dataset.matches)
        matches_by_number = {match.source_index + 1: match for match in dataset.matches}
        bracket_matches = [
            match
            for match in dataset.matches
            if match.round.casefold() == resolved_target_round.casefold()
        ]
        bracket = [
            self._simulate_fixture(
                match,
                matches_by_number=matches_by_number,
                group_lookup=group_lookup,
                pairing_limit=max(1, pairing_limit),
            )
            for match in bracket_matches
        ]
        third_place_candidates = sorted(
            {team for group in groups for team in group.possible_third_place},
            key=str.casefold,
        )
        return WorldCupSimulationResponse(
            source=dataset.source,
            generated_at=datetime.now(UTC),
            target_round=resolved_target_round,
            groups=groups,
            third_place_candidates=third_place_candidates,
            bracket=bracket,
            data_quality_notes=[],
        )

    def _normalize(
        self,
        cached: CachedWorldCupPayload,
        *,
        cache_hit: bool,
        stale_cache: bool,
    ) -> WorldCupDataset:
        name = str(cached.payload.get("name") or f"World Cup {cached.year}")
        raw_matches = cached.payload.get("matches", [])
        if not isinstance(raw_matches, list):
            raise WorldCupDataUnavailableError("Cached World Cup payload is missing matches")

        matches: list[WorldCupMatch] = []
        for index, raw_match in enumerate(raw_matches):
            if not isinstance(raw_match, dict):
                continue
            try:
                matches.append(self._normalize_match(cached.year, name, index, raw_match))
            except ValidationError as exc:
                raise WorldCupDataUnavailableError(
                    f"World Cup {cached.year} match #{index + 1} failed validation: {exc}"
                ) from exc

        source = WorldCupSourceInfo(
            name=name,
            year=cached.year,
            source_name=cached.source_name,
            source_url=cached.source_url,
            source_text_url=self._config.source_text_url(cached.year),
            fetched_at=cached.fetched_at,
            cache_hit=cache_hit,
            stale_cache=stale_cache,
            match_count=len(matches),
        )
        return WorldCupDataset(source=source, matches=matches)

    def _normalize_match(
        self,
        year: int,
        competition: str,
        source_index: int,
        raw_match: dict[str, Any],
    ) -> WorldCupMatch:
        team1 = str(raw_match.get("team1") or "").strip()
        team2 = str(raw_match.get("team2") or "").strip()
        score = self._parse_score(raw_match.get("score"))
        status: MatchStatus = "finished" if score and score.ft else "scheduled"

        return WorldCupMatch(
            id=self._match_id(year, source_index, team1, team2),
            source_index=source_index,
            competition=competition,
            round=str(raw_match.get("round") or "").strip(),
            date=str(raw_match.get("date") or "").strip(),
            time=self._optional_str(raw_match.get("time")),
            kickoff_utc=self._parse_kickoff_utc(raw_match.get("date"), raw_match.get("time")),
            team1=team1,
            team2=team2,
            group=self._optional_str(raw_match.get("group")),
            ground=self._optional_str(raw_match.get("ground")),
            city=self._city_from_ground(raw_match.get("ground")),
            status=status,
            score=score,
            goals1=raw_match.get("goals1") or [],
            goals2=raw_match.get("goals2") or [],
            winner=self._winner(team1, team2, score),
            raw=raw_match,
        )

    def _simulate_groups(
        self,
        matches: list[WorldCupMatch],
        *,
        scenario_limit: int,
    ) -> list[WorldCupGroupSimulation]:
        groups: dict[str, list[WorldCupMatch]] = {}
        for match in matches:
            if match.group:
                groups.setdefault(match.group, []).append(match)

        simulations = []
        for group, group_matches in sorted(
            groups.items(),
            key=lambda item: self._group_sort_key(item[0]),
        ):
            simulations.append(
                self._simulate_group(
                    group,
                    sorted(group_matches, key=lambda item: item.source_index),
                    scenario_limit,
                )
            )
        return simulations

    def _simulate_group(
        self,
        group: str,
        matches: list[WorldCupMatch],
        scenario_limit: int,
    ) -> WorldCupGroupSimulation:
        base_standings = self._base_group_standings(group, matches)
        remaining_matches = [match for match in matches if not (match.score and match.score.ft)]
        current_ranked, current_tied_teams = self._rank_standings(base_standings)
        scenario_map: dict[tuple[str, str, str, bool], GroupScenarioAccumulator] = {}
        outcome_options = ("team1", "draw", "team2")
        paths = (
            product(outcome_options, repeat=len(remaining_matches))
            if remaining_matches
            else [()]
        )

        total_outcome_paths = 0
        for path in paths:
            total_outcome_paths += 1
            standings = {team: state.copy() for team, state in base_standings.items()}
            outcomes: list[WorldCupScenarioOutcome] = []

            for match, outcome in zip(remaining_matches, path, strict=False):
                home_goals, away_goals = self._score_for_scenario_outcome(outcome)
                self._apply_result(
                    standings,
                    group=group,
                    team1=match.team1,
                    team2=match.team2,
                    team1_goals=home_goals,
                    team2_goals=away_goals,
                )
                outcomes.append(
                    WorldCupScenarioOutcome(
                        match_id=match.id,
                        team1=match.team1,
                        team2=match.team2,
                        outcome=outcome,
                        label=self._scenario_outcome_label(match, outcome),
                    )
                )

            ranked, tied_teams = self._rank_standings(standings)
            first, second, third = self._podium(ranked)
            tie_breaker_required = self._tie_breaker_affects_qualification(ranked, tied_teams)
            key = (first, second, third, tie_breaker_required)
            scenario = scenario_map.get(key)
            if scenario is None:
                scenario = GroupScenarioAccumulator(
                    first=first,
                    second=second,
                    third=third,
                    outcomes=outcomes,
                    tie_breaker_required=tie_breaker_required,
                )
                scenario_map[key] = scenario
            scenario.outcome_count += 1

        scenario_items = sorted(
            scenario_map.values(),
            key=lambda item: (
                -item.outcome_count,
                item.first.casefold(),
                item.second.casefold(),
                item.third.casefold(),
            ),
        )
        scenario_count = len(scenario_items)
        limited_scenarios = scenario_items[:scenario_limit]
        possible_winners = sorted(
            {item.first for item in scenario_items if item.first},
            key=str.casefold,
        )
        possible_runners_up = sorted(
            {item.second for item in scenario_items if item.second},
            key=str.casefold,
        )
        possible_third_place = sorted(
            {item.third for item in scenario_items if item.third},
            key=str.casefold,
        )

        return WorldCupGroupSimulation(
            group=group,
            standings=[
                self._standing_model(state, position=index + 1, tied_teams=current_tied_teams)
                for index, state in enumerate(current_ranked)
            ],
            remaining_matches=remaining_matches,
            possible_winners=possible_winners,
            possible_runners_up=possible_runners_up,
            possible_third_place=possible_third_place,
            scenarios=[
                WorldCupGroupQualificationScenario(
                    id=f"{self._group_letter(group).lower()}-{index + 1}",
                    title=self._scenario_title(index + 1, item),
                    first=item.first,
                    second=item.second,
                    third=item.third,
                    advancing_teams=[team for team in (item.first, item.second) if team],
                    outcomes=item.outcomes,
                    outcome_count=item.outcome_count,
                    outcome_share=(
                        item.outcome_count / total_outcome_paths if total_outcome_paths else 0
                    ),
                    tie_breaker_required=item.tie_breaker_required,
                    notes=self._scenario_notes(item),
                )
                for index, item in enumerate(limited_scenarios)
            ],
            total_outcome_paths=total_outcome_paths,
            scenario_count=scenario_count,
            truncated=scenario_count > len(limited_scenarios),
        )

    def _base_group_standings(
        self,
        group: str,
        matches: list[WorldCupMatch],
    ) -> dict[str, TeamStandingState]:
        standings: dict[str, TeamStandingState] = {}
        for match in matches:
            self._ensure_team(standings, group, match.team1)
            self._ensure_team(standings, group, match.team2)
            if match.score and match.score.ft:
                team1_goals, team2_goals = match.score.ft
                self._apply_result(
                    standings,
                    group=group,
                    team1=match.team1,
                    team2=match.team2,
                    team1_goals=team1_goals,
                    team2_goals=team2_goals,
                )
        return standings

    def _simulate_fixture(
        self,
        match: WorldCupMatch,
        *,
        matches_by_number: dict[int, WorldCupMatch],
        group_lookup: dict[str, WorldCupGroupSimulation],
        pairing_limit: int,
    ) -> WorldCupSimulatedFixture:
        team1 = self._resolve_simulation_slot(
            match.team1,
            matches_by_number=matches_by_number,
            group_lookup=group_lookup,
            seen=set(),
        )
        team2 = self._resolve_simulation_slot(
            match.team2,
            matches_by_number=matches_by_number,
            group_lookup=group_lookup,
            seen=set(),
        )
        pairings = [
            (first, second)
            for first in team1.candidates
            for second in team2.candidates
            if first and second and first != second
        ]
        return WorldCupSimulatedFixture(
            match_id=match.id,
            match_number=match.source_index + 1,
            round=match.round,
            date=match.date,
            time=match.time,
            team1=team1,
            team2=team2,
            possible_pairings=pairings[:pairing_limit],
            possible_pairing_count=len(pairings),
            pairings_truncated=len(pairings) > pairing_limit,
        )

    def _resolve_simulation_slot(
        self,
        label: str,
        *,
        matches_by_number: dict[int, WorldCupMatch],
        group_lookup: dict[str, WorldCupGroupSimulation],
        seen: set[str],
    ) -> WorldCupSimulationSlot:
        text = label.strip()
        reference = re.fullmatch(r"(?P<kind>[WL])(?P<number>\d+)", text)
        if reference:
            if text in seen:
                return WorldCupSimulationSlot(label=text, source="unresolved")
            upstream = matches_by_number.get(int(reference.group("number")))
            if upstream is None:
                return WorldCupSimulationSlot(label=text, source="unresolved")

            winner = upstream.winner
            if reference.group("kind") == "L" and upstream.score and upstream.score.ft:
                winner = self._loser(upstream)
            if winner:
                return WorldCupSimulationSlot(
                    label=text,
                    resolved_team=winner,
                    candidates=[winner],
                    source="actual",
                )

            next_seen = {*seen, text}
            left = self._resolve_simulation_slot(
                upstream.team1,
                matches_by_number=matches_by_number,
                group_lookup=group_lookup,
                seen=next_seen,
            )
            right = self._resolve_simulation_slot(
                upstream.team2,
                matches_by_number=matches_by_number,
                group_lookup=group_lookup,
                seen=next_seen,
            )
            candidates = sorted({*left.candidates, *right.candidates}, key=str.casefold)
            return WorldCupSimulationSlot(
                label=text,
                candidates=candidates,
                source="match_reference",
            )

        seed = re.fullmatch(r"(?P<rank>[123])(?P<groups>[A-L](?:/[A-L])*)", text)
        if seed:
            rank = int(seed.group("rank"))
            candidates: set[str] = set()
            for group_letter in seed.group("groups").split("/"):
                group = group_lookup.get(group_letter)
                if group is None:
                    continue
                if rank == 1:
                    candidates.update(group.possible_winners)
                elif rank == 2:
                    candidates.update(group.possible_runners_up)
                else:
                    candidates.update(group.possible_third_place)
            sorted_candidates = sorted(candidates, key=str.casefold)
            return WorldCupSimulationSlot(
                label=text,
                resolved_team=sorted_candidates[0] if len(sorted_candidates) == 1 else None,
                candidates=sorted_candidates,
                source="seed",
            )

        if text:
            return WorldCupSimulationSlot(
                label=text,
                resolved_team=text,
                candidates=[text],
                source="actual",
            )
        return WorldCupSimulationSlot(label=label, source="unresolved")

    @staticmethod
    def _ensure_team(
        standings: dict[str, TeamStandingState],
        group: str,
        team: str,
    ) -> TeamStandingState:
        if team not in standings:
            standings[team] = TeamStandingState(group=group, team=team)
        return standings[team]

    def _apply_result(
        self,
        standings: dict[str, TeamStandingState],
        *,
        group: str,
        team1: str,
        team2: str,
        team1_goals: int,
        team2_goals: int,
    ) -> None:
        first = self._ensure_team(standings, group, team1)
        second = self._ensure_team(standings, group, team2)
        first.played += 1
        second.played += 1
        first.goals_for += team1_goals
        first.goals_against += team2_goals
        second.goals_for += team2_goals
        second.goals_against += team1_goals

        if team1_goals > team2_goals:
            first.won += 1
            second.lost += 1
            first.points += 3
        elif team1_goals < team2_goals:
            second.won += 1
            first.lost += 1
            second.points += 3
        else:
            first.drawn += 1
            second.drawn += 1
            first.points += 1
            second.points += 1

    @classmethod
    def _rank_standings(
        cls,
        standings: dict[str, TeamStandingState],
    ) -> tuple[list[TeamStandingState], set[str]]:
        ranked = sorted(standings.values(), key=cls._standing_sort_key)
        tied_teams: set[str] = set()
        for index, current in enumerate(ranked):
            neighbors = []
            if index > 0:
                neighbors.append(ranked[index - 1])
            if index < len(ranked) - 1:
                neighbors.append(ranked[index + 1])
            if any(cls._same_primary_metrics(current, neighbor) for neighbor in neighbors):
                tied_teams.add(current.team)
        return ranked, tied_teams

    @staticmethod
    def _standing_sort_key(standing: TeamStandingState) -> tuple[int, int, int, str]:
        return (
            -standing.points,
            -standing.goal_difference,
            -standing.goals_for,
            standing.team.casefold(),
        )

    @staticmethod
    def _same_primary_metrics(first: TeamStandingState, second: TeamStandingState) -> bool:
        return (
            first.points == second.points
            and first.goal_difference == second.goal_difference
            and first.goals_for == second.goals_for
        )

    @classmethod
    def _tie_breaker_affects_qualification(
        cls,
        ranked: list[TeamStandingState],
        tied_teams: set[str],
    ) -> bool:
        if not tied_teams:
            return False
        qualification_band = ranked[:4]
        return any(team.team in tied_teams for team in qualification_band)

    @staticmethod
    def _standing_model(
        standing: TeamStandingState,
        *,
        position: int,
        tied_teams: set[str],
    ) -> WorldCupTeamStanding:
        return WorldCupTeamStanding(
            group=standing.group,
            position=position,
            team=standing.team,
            played=standing.played,
            won=standing.won,
            drawn=standing.drawn,
            lost=standing.lost,
            goals_for=standing.goals_for,
            goals_against=standing.goals_against,
            goal_difference=standing.goal_difference,
            points=standing.points,
            tied_on_primary_metrics=standing.team in tied_teams,
        )

    @staticmethod
    def _score_for_scenario_outcome(outcome: str) -> tuple[int, int]:
        if outcome == "team1":
            return 1, 0
        if outcome == "team2":
            return 0, 1
        return 0, 0

    @staticmethod
    def _scenario_outcome_label(match: WorldCupMatch, outcome: str) -> str:
        if outcome == "team1":
            return f"{match.team1} win"
        if outcome == "team2":
            return f"{match.team2} win"
        return "Draw"

    @staticmethod
    def _podium(ranked: list[TeamStandingState]) -> tuple[str, str, str]:
        first = ranked[0].team if len(ranked) > 0 else ""
        second = ranked[1].team if len(ranked) > 1 else ""
        third = ranked[2].team if len(ranked) > 2 else ""
        return first, second, third

    @staticmethod
    def _scenario_title(index: int, scenario: GroupScenarioAccumulator) -> str:
        return f"Scenario {index}: {scenario.first}, {scenario.second}"

    @staticmethod
    def _scenario_notes(scenario: GroupScenarioAccumulator) -> list[str]:
        if scenario.tie_breaker_required:
            return ["Official tiebreakers may change the exact order for this scenario."]
        return []

    @staticmethod
    def _group_letter(group: str) -> str:
        text = group.strip().upper()
        match = re.search(r"([A-L])$", text)
        return match.group(1) if match else text

    @classmethod
    def _group_sort_key(cls, group: str) -> tuple[int, str]:
        letter = cls._group_letter(group)
        if len(letter) == 1 and "A" <= letter <= "L":
            return ord(letter) - ord("A"), letter
        return 99, group

    @classmethod
    def _group_lookup(
        cls,
        groups: list[WorldCupGroupSimulation],
    ) -> dict[str, WorldCupGroupSimulation]:
        lookup: dict[str, WorldCupGroupSimulation] = {}
        for group in groups:
            letter = cls._group_letter(group.group)
            lookup[letter] = group
            lookup[group.group] = group
        return lookup

    @staticmethod
    def _loser(match: WorldCupMatch) -> str | None:
        if not match.score or not match.score.ft:
            return None
        home, away = match.score.p or match.score.et or match.score.ft
        if home == away:
            return None
        return match.team2 if home > away else match.team1

    @staticmethod
    def _simulation_target_round(
        target_round: str,
        matches: list[WorldCupMatch],
    ) -> SimulationTargetRound:
        aliases: dict[str, SimulationTargetRound] = {
            "final": "Final",
            "match for third place": "Match for third place",
            "next": "Round of 32",
            "quarter": "Quarter-final",
            "quarter-final": "Quarter-final",
            "quarter_final": "Quarter-final",
            "quarterfinal": "Quarter-final",
            "round of 16": "Round of 16",
            "round of 32": "Round of 32",
            "round_16": "Round of 16",
            "round_32": "Round of 32",
            "semi": "Semi-final",
            "semi-final": "Semi-final",
            "semi_final": "Semi-final",
            "semifinal": "Semi-final",
        }
        normalized = target_round.strip().casefold().replace("-", "_")
        if normalized == "next":
            round_order: list[SimulationTargetRound] = [
                "Round of 32",
                "Round of 16",
                "Quarter-final",
                "Semi-final",
                "Final",
            ]
            for round_name in round_order:
                round_matches = [
                    match for match in matches if match.round.casefold() == round_name.casefold()
                ]
                if round_matches and any(match.status != "finished" for match in round_matches):
                    return round_name
            return "Final"

        lookup_key = target_round.strip().casefold()
        compact_key = normalized.replace("_", " ")
        return (
            aliases.get(lookup_key)
            or aliases.get(normalized)
            or aliases.get(compact_key)
            or "Round of 32"
        )

    @staticmethod
    def _parse_score(value: object) -> Score | None:
        if not isinstance(value, dict):
            return None
        return Score.model_validate(value)

    @staticmethod
    def _optional_str(value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @staticmethod
    def _city_from_ground(value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        return text.split(",")[0].strip()

    @staticmethod
    def _winner(team1: str, team2: str, score: Score | None) -> str | None:
        if not score or not score.ft:
            return None
        home, away = score.p or score.et or score.ft
        if home == away:
            return None
        return team1 if home > away else team2

    @staticmethod
    def _match_id(year: int, source_index: int, team1: str, team2: str) -> str:
        label = f"{year}-{source_index + 1:03d}-{team1}-vs-{team2}"
        normalized = unicodedata.normalize("NFKD", label).encode("ascii", "ignore").decode("ascii")
        slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
        return slug or f"{year}-{source_index + 1:03d}"

    @staticmethod
    def _parse_kickoff_utc(date_value: object, time_value: object) -> datetime | None:
        if date_value is None or time_value is None:
            return None

        date_text = str(date_value).strip()
        time_text = str(time_value).strip()
        match = re.match(
            r"^(?P<hour>\d{1,2}):(?P<minute>\d{2})(?:\s+UTC(?P<offset>[+-]\d{1,2}))?$",
            time_text,
        )
        if not match:
            return None

        offset = match.group("offset")
        if offset is None:
            return None

        try:
            base_date = datetime.strptime(date_text, "%Y-%m-%d").date()
            hour = int(match.group("hour"))
            minute = int(match.group("minute"))
            tz = timezone(timedelta(hours=int(offset)))
            local_kickoff = datetime(
                base_date.year,
                base_date.month,
                base_date.day,
                hour,
                minute,
                tzinfo=tz,
            )
            return local_kickoff.astimezone(UTC)
        except ValueError:
            return None

    def _is_expired(self, cached: CachedWorldCupPayload) -> bool:
        age = datetime.now(UTC) - cached.fetched_at.astimezone(UTC)
        return age > timedelta(seconds=self._config.worldcup_cache_ttl_seconds)

    @staticmethod
    def _cache_matches_source(cached: CachedWorldCupPayload, source: WorldCupSourceName) -> bool:
        return source == "auto" or cached.source_name == source

    @staticmethod
    def _match_filter(
        match: WorldCupMatch,
        *,
        status: MatchStatus | None,
        team: str | None,
        group: str | None,
        date: str | None,
        round_name: str | None,
    ) -> bool:
        if status and match.status != status:
            return False
        if date and match.date != date:
            return False
        if group and (match.group or "").casefold() != group.casefold():
            return False
        if round_name and match.round.casefold() != round_name.casefold():
            return False
        if team:
            needle = team.casefold()
            if needle not in match.team1.casefold() and needle not in match.team2.casefold():
                return False
        return True
