from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

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
    LiveMatchScore,
    LiveMatchSnapshot,
    ProviderFixtureMapping,
)


class LiveEventsUnavailableError(RuntimeError):
    """Raised when a live event snapshot cannot be built."""


@dataclass(frozen=True)
class CachedLiveSnapshot:
    expires_at: datetime
    snapshot: LiveMatchSnapshot


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
    ) -> None:
        self._config = config
        self._api_football_connector = api_football_connector
        self._fixture_map = fixture_map
        self._cache: dict[str, CachedLiveSnapshot] = {}

    async def get_snapshot(
        self,
        *,
        match_id: str,
        provider_fixture_id: str | None = None,
        force_refresh: bool = False,
    ) -> LiveMatchSnapshot:
        provider: LiveEventsProvider = "api_football"
        resolved_fixture_id = provider_fixture_id or self._mapped_fixture_id(match_id, provider)

        if not self._api_football_connector.configured:
            return self._empty_snapshot(
                match_id=match_id,
                provider_fixture_id=resolved_fixture_id,
                provider_status="not_configured",
                error="Set API_FOOTBALL_API_KEY to fetch live match events.",
            )

        if not resolved_fixture_id:
            return self._empty_snapshot(
                match_id=match_id,
                provider_fixture_id=None,
                provider_status="unmapped",
                error="Trận này chưa được liên kết dữ liệu live từ nhà cung cấp.",
            )

        cache_key = f"{provider}:{match_id}:{resolved_fixture_id}"
        cached = self._cache.get(cache_key)
        if cached and not force_refresh and cached.expires_at > datetime.now(UTC):
            return cached.snapshot

        try:
            snapshot = await self._api_football_connector.fetch_snapshot(
                match_id=match_id,
                provider_fixture_id=resolved_fixture_id,
            )
        except LiveEventsNotConfiguredError as exc:
            return self._empty_snapshot(
                match_id=match_id,
                provider_fixture_id=resolved_fixture_id,
                provider_status="not_configured",
                error=str(exc),
            )
        except LiveEventsFetchError as exc:
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
        return snapshot

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
        return None

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
