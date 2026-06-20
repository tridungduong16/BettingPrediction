from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.connectors.odds.base import OddsFetchError, OddsNotConfiguredError
from app.connectors.odds.the_odds_api import TheOddsAPIConnector
from app.core.app_config import AppConfig, WorldCupSourceName
from app.models.odds import MatchOddsResponse, OddsEvent, OddsListResponse, OddsSportsResponse
from app.services.worldcup_service import WorldCupService


class OddsUnavailableError(RuntimeError):
    """Raised when an odds request cannot be completed."""


class OddsMatchNotFoundError(RuntimeError):
    """Raised when a match cannot be resolved before fetching odds."""


@dataclass(frozen=True)
class CachedOddsResponse:
    expires_at: datetime
    response: OddsListResponse | OddsSportsResponse


class OddsService:
    def __init__(
        self,
        *,
        config: AppConfig,
        connector: TheOddsAPIConnector,
        worldcup_service: WorldCupService,
    ) -> None:
        self._config = config
        self._connector = connector
        self._worldcup_service = worldcup_service
        self._cache: dict[str, CachedOddsResponse] = {}

    async def list_sports(
        self,
        *,
        all_sports: bool = False,
        force_refresh: bool = False,
    ) -> OddsSportsResponse:
        if not self._connector.configured:
            return OddsSportsResponse(
                provider_status="not_configured",
                generated_at=datetime.now(UTC),
                error=_not_configured_message(),
            )

        cache_key = f"sports:{all_sports}"
        cached = self._cache.get(cache_key)
        if cached and not force_refresh and cached.expires_at > datetime.now(UTC):
            return cached.response

        try:
            response = await self._connector.fetch_sports(all_sports=all_sports)
        except OddsNotConfiguredError as exc:
            return OddsSportsResponse(
                provider_status="not_configured",
                generated_at=datetime.now(UTC),
                error=str(exc),
            )
        except OddsFetchError as exc:
            return OddsSportsResponse(
                provider_status="provider_error",
                generated_at=datetime.now(UTC),
                error=str(exc),
            )

        self._cache[cache_key] = CachedOddsResponse(
            expires_at=datetime.now(UTC)
            + timedelta(seconds=self._config.odds_api_cache_ttl_seconds),
            response=response,
        )
        return response

    async def list_odds(
        self,
        *,
        sport: str | None = None,
        regions: list[str] | None = None,
        markets: list[str] | None = None,
        odds_format: str | None = None,
        bookmakers: list[str] | None = None,
        event_ids: list[str] | None = None,
        commence_time_from: datetime | None = None,
        commence_time_to: datetime | None = None,
        force_refresh: bool = False,
    ) -> OddsListResponse:
        resolved_sport = _clean_token(sport) or self._config.odds_api_sport_key
        resolved_regions = _clean_tokens(regions) or self._config.odds_api_regions
        resolved_markets = _clean_tokens(markets) or self._config.odds_api_markets
        resolved_odds_format = _clean_token(odds_format) or self._config.odds_api_odds_format

        if not self._connector.configured:
            return OddsListResponse(
                provider_status="not_configured",
                generated_at=datetime.now(UTC),
                sport=resolved_sport,
                regions=resolved_regions,
                markets=resolved_markets,
                odds_format=resolved_odds_format,
                error=_not_configured_message(),
            )

        cache_key = ":".join(
            [
                "odds",
                resolved_sport,
                ",".join(resolved_regions),
                ",".join(resolved_markets),
                resolved_odds_format,
                ",".join(_clean_tokens(bookmakers) or []),
                ",".join(_clean_tokens(event_ids) or []),
                str(commence_time_from or ""),
                str(commence_time_to or ""),
            ]
        )
        cached = self._cache.get(cache_key)
        if cached and not force_refresh and cached.expires_at > datetime.now(UTC):
            return cached.response

        try:
            response = await self._connector.fetch_odds(
                sport=resolved_sport,
                regions=resolved_regions,
                markets=resolved_markets,
                odds_format=resolved_odds_format,
                bookmakers=_clean_tokens(bookmakers),
                event_ids=_clean_tokens(event_ids),
                commence_time_from=commence_time_from,
                commence_time_to=commence_time_to,
            )
        except OddsNotConfiguredError as exc:
            return OddsListResponse(
                provider_status="not_configured",
                generated_at=datetime.now(UTC),
                sport=resolved_sport,
                regions=resolved_regions,
                markets=resolved_markets,
                odds_format=resolved_odds_format,
                error=str(exc),
            )
        except OddsFetchError as exc:
            return OddsListResponse(
                provider_status="provider_error",
                generated_at=datetime.now(UTC),
                sport=resolved_sport,
                regions=resolved_regions,
                markets=resolved_markets,
                odds_format=resolved_odds_format,
                error=str(exc),
            )

        self._cache[cache_key] = CachedOddsResponse(
            expires_at=datetime.now(UTC)
            + timedelta(seconds=self._config.odds_api_cache_ttl_seconds),
            response=response,
        )
        return response

    async def get_match_odds(
        self,
        *,
        match_id: str,
        year: int | None = None,
        source: WorldCupSourceName = "auto",
        sport: str | None = None,
        regions: list[str] | None = None,
        markets: list[str] | None = None,
        odds_format: str | None = None,
        force_refresh: bool = False,
    ) -> MatchOddsResponse:
        resolved_sport = _clean_token(sport) or self._config.odds_api_sport_key
        resolved_regions = _clean_tokens(regions) or self._config.odds_api_regions
        resolved_markets = _clean_tokens(markets) or self._config.odds_api_markets
        resolved_odds_format = _clean_token(odds_format) or self._config.odds_api_odds_format

        if not self._connector.configured:
            return MatchOddsResponse(
                provider_status="not_configured",
                match_id=match_id,
                sport=resolved_sport,
                regions=resolved_regions,
                markets=resolved_markets,
                odds_format=resolved_odds_format,
                generated_at=datetime.now(UTC),
                error=_not_configured_message(),
            )

        match = await self._worldcup_service.get_match(
            match_id=match_id,
            year=year,
            source=source,
            force_refresh=force_refresh,
        )
        if match is None:
            raise OddsMatchNotFoundError(f"Match not found: {match_id}")

        commence_from: datetime | None = None
        commence_to: datetime | None = None
        if match.kickoff_utc:
            commence_from = match.kickoff_utc - timedelta(hours=18)
            commence_to = match.kickoff_utc + timedelta(hours=18)

        odds = await self.list_odds(
            sport=resolved_sport,
            regions=resolved_regions,
            markets=resolved_markets,
            odds_format=resolved_odds_format,
            commence_time_from=commence_from,
            commence_time_to=commence_to,
            force_refresh=force_refresh,
        )
        matched_event = _find_matching_event(
            odds.events,
            home_team=match.team1,
            away_team=match.team2,
        )

        if odds.provider_status != "ready":
            status = odds.provider_status
            error = odds.error
        elif matched_event is None:
            status = "unmapped"
            error = "No The Odds API event matched this World Cup fixture."
        else:
            status = "ready"
            error = None

        return MatchOddsResponse(
            provider_status=status,
            match_id=match_id,
            sport=resolved_sport,
            regions=resolved_regions,
            markets=resolved_markets,
            odds_format=resolved_odds_format,
            generated_at=datetime.now(UTC),
            home_team=match.team1,
            away_team=match.team2,
            event=matched_event,
            candidate_events=odds.events[:10],
            error=error,
            remaining_requests=odds.remaining_requests,
            used_requests=odds.used_requests,
            last_request_cost=odds.last_request_cost,
        )


def _find_matching_event(
    events: list[OddsEvent],
    *,
    home_team: str,
    away_team: str,
) -> OddsEvent | None:
    target_home = _normalize_team_name(home_team)
    target_away = _normalize_team_name(away_team)
    target_pair = {target_home, target_away}

    for event in events:
        event_home = _normalize_team_name(event.home_team)
        event_away = _normalize_team_name(event.away_team)
        if event_home == target_home and event_away == target_away:
            return event
        if {event_home, event_away} == target_pair:
            return event
    return None


def _normalize_team_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", ascii_text.lower()).strip()


def _clean_tokens(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    tokens = [_clean_token(value) for value in values]
    cleaned = [token for token in tokens if token]
    return cleaned or None


def _clean_token(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _not_configured_message() -> str:
    return "Set ODD_API or ODDS_API_KEY to fetch odds."
