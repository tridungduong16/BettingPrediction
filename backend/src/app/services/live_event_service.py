from __future__ import annotations

import json
import logging
import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol

from app.connectors.live_events.api_football import APIFootballLiveEventsConnector
from app.connectors.live_events.base import (
    LiveEventsFetchError,
    LiveEventsNotConfiguredError,
)
from app.core.app_config import AppConfig
from app.models.live_events import (
    LiveEventProviderFixtureSearchResult,
    LiveEventsProvider,
    LiveMatchClock,
    LiveMatchLineups,
    LiveMatchScore,
    LiveMatchSnapshot,
    ProviderFixtureMapping,
)
from app.models.worldcup import WorldCupMatch


class WorldCupMatchLookup(Protocol):
    async def get_match(
        self,
        *,
        match_id: str,
        year: int | None = None,
        source: str = "auto",
        force_refresh: bool = False,
    ) -> WorldCupMatch | None: ...


class LiveEventsUnavailableError(RuntimeError):
    """Raised when a live event snapshot cannot be built."""


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CachedLiveSnapshot:
    expires_at: datetime
    snapshot: LiveMatchSnapshot


@dataclass(frozen=True)
class CachedLiveLineups:
    expires_at: datetime
    lineups: LiveMatchLineups


class FileLiveFixtureMapRepository:
    def __init__(self, mapping_file: Path) -> None:
        self._mapping_file = mapping_file

    def get(self, match_id: str) -> ProviderFixtureMapping | None:
        mappings = self._read_all()
        value = mappings.get(match_id)
        if isinstance(value, str):
            return ProviderFixtureMapping(provider_fixture_id=value)
        if isinstance(value, dict):
            return ProviderFixtureMapping.model_validate(value)
        return None

    def _read_all(self) -> dict[str, Any]:
        if not self._mapping_file.exists():
            return {}
        try:
            data = json.loads(self._mapping_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        return data if isinstance(data, dict) else {}


class LiveEventService:
    def __init__(
        self,
        *,
        config: AppConfig,
        api_football_connector: APIFootballLiveEventsConnector,
        fixture_map: FileLiveFixtureMapRepository,
        worldcup_service: WorldCupMatchLookup | None = None,
    ) -> None:
        self._config = config
        self._api_football_connector = api_football_connector
        self._fixture_map = fixture_map
        self._worldcup_service = worldcup_service
        self._auto_fixture_map: dict[str, ProviderFixtureMapping] = {}
        self._cache: dict[str, CachedLiveSnapshot] = {}
        self._lineups_cache: dict[str, CachedLiveLineups] = {}

    async def get_snapshot(
        self,
        *,
        match_id: str,
        provider_fixture_id: str | None = None,
        force_refresh: bool = False,
    ) -> LiveMatchSnapshot:
        provider: LiveEventsProvider = "api_football"
        mapped_fixture_id = provider_fixture_id or self._mapped_fixture_id(match_id, provider)
        logger.info(
            "live snapshot requested match_id=%s force_refresh=%s "
            "query_fixture_id=%s mapped_fixture_id=%s",
            match_id,
            force_refresh,
            provider_fixture_id,
            mapped_fixture_id,
        )

        if not self._api_football_connector.configured:
            logger.warning(
                "live snapshot skipped provider not configured match_id=%s mapped_fixture_id=%s",
                match_id,
                mapped_fixture_id,
            )
            return self._empty_snapshot(
                match_id=match_id,
                provider_fixture_id=mapped_fixture_id,
                provider_status="not_configured",
                error="Set API_FOOTBALL_API_KEY to fetch live match events.",
            )

        resolved_fixture_id = mapped_fixture_id or await self._auto_resolve_fixture_id(
            match_id,
            provider,
        )

        if not resolved_fixture_id:
            logger.warning("live snapshot unmapped match_id=%s", match_id)
            return self._empty_snapshot(
                match_id=match_id,
                provider_fixture_id=None,
                provider_status="unmapped",
                error="Trận này chưa được liên kết dữ liệu live từ nhà cung cấp.",
            )

        cache_key = f"{provider}:{match_id}:{resolved_fixture_id}"
        cached = self._cache.get(cache_key)
        if cached and not force_refresh and cached.expires_at > datetime.now(UTC):
            logger.info(
                "live snapshot cache hit match_id=%s provider_fixture_id=%s events=%s status=%s",
                match_id,
                resolved_fixture_id,
                len(cached.snapshot.events),
                cached.snapshot.provider_status,
            )
            return cached.snapshot

        try:
            logger.info(
                "live snapshot provider fetch started match_id=%s provider_fixture_id=%s",
                match_id,
                resolved_fixture_id,
            )
            snapshot = await self._api_football_connector.fetch_snapshot(
                match_id=match_id,
                provider_fixture_id=resolved_fixture_id,
            )
        except LiveEventsNotConfiguredError as exc:
            logger.warning(
                "live snapshot provider not configured match_id=%s provider_fixture_id=%s error=%s",
                match_id,
                resolved_fixture_id,
                exc,
            )
            return self._empty_snapshot(
                match_id=match_id,
                provider_fixture_id=resolved_fixture_id,
                provider_status="not_configured",
                error=str(exc),
            )
        except LiveEventsFetchError as exc:
            logger.warning(
                "live snapshot provider error match_id=%s provider_fixture_id=%s error=%s",
                match_id,
                resolved_fixture_id,
                exc,
            )
            return self._empty_snapshot(
                match_id=match_id,
                provider_fixture_id=resolved_fixture_id,
                provider_status="provider_error",
                error=str(exc),
            )

        self._cache[cache_key] = CachedLiveSnapshot(
            expires_at=datetime.now(UTC)
            + timedelta(seconds=self._config.live_events_cache_ttl_seconds),
            snapshot=snapshot,
        )
        logger.info(
            "live snapshot provider fetch completed match_id=%s provider_fixture_id=%s "
            "status=%s phase=%s elapsed=%s score=%s-%s events=%s error=%s",
            match_id,
            resolved_fixture_id,
            snapshot.provider_status,
            snapshot.clock.phase,
            snapshot.clock.elapsed,
            snapshot.score.home,
            snapshot.score.away,
            len(snapshot.events),
            snapshot.error,
        )
        return snapshot

    async def get_lineups(
        self,
        *,
        match_id: str,
        provider_fixture_id: str | None = None,
        force_refresh: bool = False,
    ) -> LiveMatchLineups:
        provider: LiveEventsProvider = "api_football"
        mapped_fixture_id = provider_fixture_id or self._mapped_fixture_id(match_id, provider)

        if not self._api_football_connector.configured:
            return self._empty_lineups(
                match_id=match_id,
                provider_fixture_id=mapped_fixture_id,
                provider_status="not_configured",
                error="Set API_FOOTBALL_API_KEY to fetch match lineups.",
            )

        resolved_fixture_id = mapped_fixture_id or await self._auto_resolve_fixture_id(
            match_id,
            provider,
        )

        if not resolved_fixture_id:
            return self._empty_lineups(
                match_id=match_id,
                provider_fixture_id=None,
                provider_status="unmapped",
                error="Trận này chưa được liên kết dữ liệu live từ nhà cung cấp.",
            )

        cache_key = f"{provider}:{match_id}:{resolved_fixture_id}:lineups"
        cached = self._lineups_cache.get(cache_key)
        if cached and not force_refresh and cached.expires_at > datetime.now(UTC):
            return cached.lineups

        try:
            lineups = await self._api_football_connector.fetch_lineups(
                match_id=match_id,
                provider_fixture_id=resolved_fixture_id,
            )
        except LiveEventsNotConfiguredError as exc:
            return self._empty_lineups(
                match_id=match_id,
                provider_fixture_id=resolved_fixture_id,
                provider_status="not_configured",
                error=str(exc),
            )
        except LiveEventsFetchError as exc:
            return self._empty_lineups(
                match_id=match_id,
                provider_fixture_id=resolved_fixture_id,
                provider_status="provider_error",
                error=str(exc),
            )

        self._lineups_cache[cache_key] = CachedLiveLineups(
            expires_at=datetime.now(UTC)
            + timedelta(seconds=self._config.live_events_cache_ttl_seconds),
            lineups=lineups,
        )
        return lineups

    async def list_events(
        self,
        *,
        match_id: str,
        provider_fixture_id: str | None = None,
        force_refresh: bool = False,
    ) -> list:
        snapshot = await self.get_snapshot(
            match_id=match_id,
            provider_fixture_id=provider_fixture_id,
            force_refresh=force_refresh,
        )
        return snapshot.events

    async def search_provider_fixtures(
        self,
        *,
        date: str,
        team: str | None = None,
        league: int | None = None,
        season: int | None = None,
    ) -> list[LiveEventProviderFixtureSearchResult]:
        try:
            return await self._api_football_connector.search_fixtures(
                date=date,
                team=team,
                league=league,
                season=season,
            )
        except LiveEventsNotConfiguredError as exc:
            raise LiveEventsUnavailableError(str(exc)) from exc
        except LiveEventsFetchError as exc:
            raise LiveEventsUnavailableError(str(exc)) from exc

    def _mapped_fixture_id(self, match_id: str, provider: LiveEventsProvider) -> str | None:
        mapping = self._fixture_map.get(match_id)
        if mapping and mapping.provider == provider:
            return mapping.provider_fixture_id
        auto_mapping = self._auto_fixture_map.get(match_id)
        if auto_mapping and auto_mapping.provider == provider:
            return auto_mapping.provider_fixture_id
        return None

    async def _auto_resolve_fixture_id(
        self,
        match_id: str,
        provider: LiveEventsProvider,
    ) -> str | None:
        if provider != "api_football" or self._worldcup_service is None:
            logger.info(
                "live auto-resolve skipped match_id=%s provider=%s has_worldcup_service=%s",
                match_id,
                provider,
                self._worldcup_service is not None,
            )
            return None

        try:
            match = await self._worldcup_service.get_match(match_id=match_id)
        except RuntimeError as exc:
            logger.warning(
                "live auto-resolve match lookup failed match_id=%s error=%s",
                match_id,
                exc,
            )
            return None

        if match is None or not match.date:
            logger.warning(
                "live auto-resolve match missing match_id=%s found=%s date=%s",
                match_id,
                match is not None,
                match.date if match else None,
            )
            return None

        searches = self._fixture_searches(match)
        if not searches:
            logger.warning("live auto-resolve match has no teams match_id=%s", match_id)
            return None

        candidates: list[LiveEventProviderFixtureSearchResult] = []
        for search_date, team in searches:
            try:
                logger.info(
                    "live auto-resolve search started match_id=%s date=%s team=%s",
                    match_id,
                    search_date,
                    team,
                )
                search_results = await self.search_provider_fixtures(date=search_date, team=team)
            except LiveEventsUnavailableError as exc:
                logger.warning(
                    "live auto-resolve search failed match_id=%s date=%s team=%s error=%s",
                    match_id,
                    search_date,
                    team,
                    exc,
                )
                continue

            logger.info(
                "live auto-resolve search returned match_id=%s date=%s team=%s candidates=%s",
                match_id,
                search_date,
                team,
                [
                    {
                        "fixture_id": candidate.provider_fixture_id,
                        "home": candidate.home_team,
                        "away": candidate.away_team,
                        "status": candidate.status,
                    }
                    for candidate in search_results[:8]
                ],
            )
            candidates.extend(search_results)
            if self._matching_fixture_candidate(match, search_results):
                break

        candidate = self._best_fixture_candidate(match, candidates)
        if candidate is None:
            logger.warning("live auto-resolve found no fixture match_id=%s", match_id)
            return None

        mapping = ProviderFixtureMapping(
            provider=provider,
            provider_fixture_id=candidate.provider_fixture_id,
        )
        self._auto_fixture_map[match_id] = mapping
        logger.info(
            "live auto-resolve selected match_id=%s provider_fixture_id=%s "
            "provider_home=%s provider_away=%s provider_status=%s",
            match_id,
            candidate.provider_fixture_id,
            candidate.home_team,
            candidate.away_team,
            candidate.status,
        )
        return mapping.provider_fixture_id

    @staticmethod
    def _fixture_searches(match: WorldCupMatch) -> list[tuple[str, str]]:
        dates: list[str] = []
        if match.kickoff_utc:
            dates.append(match.kickoff_utc.astimezone(UTC).date().isoformat())
        if match.date:
            dates.append(match.date)

        teams = [team for team in [match.team1, match.team2] if team]
        searches: list[tuple[str, str]] = []
        seen: set[tuple[str, str]] = set()
        for search_date in dates:
            for team in teams:
                key = (search_date, team)
                if key in seen:
                    continue
                seen.add(key)
                searches.append(key)
        return searches

    @classmethod
    def _best_fixture_candidate(
        cls,
        match: WorldCupMatch,
        candidates: list[LiveEventProviderFixtureSearchResult],
    ) -> LiveEventProviderFixtureSearchResult | None:
        matched = cls._matching_fixture_candidate(match, candidates)
        if matched:
            return matched
        return candidates[0] if candidates else None

    @classmethod
    def _matching_fixture_candidate(
        cls,
        match: WorldCupMatch,
        candidates: list[LiveEventProviderFixtureSearchResult],
    ) -> LiveEventProviderFixtureSearchResult | None:
        for candidate in candidates:
            if cls._teams_match(match.team1, match.team2, candidate.home_team, candidate.away_team):
                return candidate
            if cls._teams_match(match.team1, match.team2, candidate.away_team, candidate.home_team):
                return candidate
        return None

    @classmethod
    def _teams_match(
        cls,
        first_expected: str,
        second_expected: str,
        first_candidate: str | None,
        second_candidate: str | None,
    ) -> bool:
        return cls._team_name_matches(first_expected, first_candidate) and cls._team_name_matches(
            second_expected,
            second_candidate,
        )

    @classmethod
    def _team_name_matches(cls, expected: str, candidate: str | None) -> bool:
        expected_key = cls._team_name_key(expected)
        candidate_key = cls._team_name_key(candidate or "")
        return bool(
            expected_key
            and candidate_key
            and (expected_key in candidate_key or candidate_key in expected_key)
        )

    @staticmethod
    def _team_name_key(value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
        return re.sub(r"[^a-z0-9]+", "", normalized.casefold())

    @staticmethod
    def _empty_snapshot(
        *,
        match_id: str,
        provider_fixture_id: str | None,
        provider_status: str,
        error: str | None,
    ) -> LiveMatchSnapshot:
        return LiveMatchSnapshot(
            match_id=match_id,
            provider="api_football",
            provider_fixture_id=provider_fixture_id,
            provider_status=provider_status,
            observed_at=datetime.now(UTC),
            score=LiveMatchScore(),
            clock=LiveMatchClock(),
            events=[],
            error=error,
        )

    @staticmethod
    def _empty_lineups(
        *,
        match_id: str,
        provider_fixture_id: str | None,
        provider_status: str,
        error: str | None,
    ) -> LiveMatchLineups:
        return LiveMatchLineups(
            match_id=match_id,
            provider="api_football",
            provider_fixture_id=provider_fixture_id,
            provider_status=provider_status,
            observed_at=datetime.now(UTC),
            lineups=[],
            error=error,
        )
