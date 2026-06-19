from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.connectors.news.base import NewsSearchFetchError, NewsSearchNotConfiguredError
from app.connectors.news.perplexity import PerplexityNewsSearchConnector
from app.core.app_config import AppConfig
from app.models.news import LatestInformationSearchResponse, MatchNewsSearchResponse, SearchRecency


class NewsSearchUnavailableError(RuntimeError):
    """Raised when a news search request cannot be completed."""


@dataclass(frozen=True)
class CachedNewsSearch:
    expires_at: datetime
    response: LatestInformationSearchResponse | MatchNewsSearchResponse


class NewsSearchService:
    def __init__(
        self,
        *,
        config: AppConfig,
        perplexity_connector: PerplexityNewsSearchConnector,
    ) -> None:
        self._config = config
        self._perplexity_connector = perplexity_connector
        self._cache: dict[str, CachedNewsSearch] = {}

    async def search_match_news(
        self,
        *,
        home_team: str,
        away_team: str,
        max_results: int | None = None,
        force_refresh: bool = False,
        recency: SearchRecency | None = None,
    ) -> MatchNewsSearchResponse:
        query = build_match_news_query(home_team=home_team, away_team=away_team)
        max_results = _bounded_max_results(
            max_results or self._config.perplexity_search_max_results
        )

        if not self._perplexity_connector.configured:
            return self._empty_response(
                query=query,
                home_team=home_team,
                away_team=away_team,
                provider_status="not_configured",
                error="Set PERPLEXITY_API_KEY to fetch match news.",
            )

        cache_key = f"{query}:{max_results}:{recency or ''}"
        cached = self._cache.get(cache_key)
        if cached and not force_refresh and cached.expires_at > datetime.now(UTC):
            return cached.response

        try:
            results, source_id, server_time = await self._perplexity_connector.search(
                query=query,
                max_results=max_results,
                country=self._config.perplexity_search_country,
                language_filter=self._config.perplexity_search_language_filter,
                recency=recency,
            )
        except NewsSearchNotConfiguredError as exc:
            return self._empty_response(
                query=query,
                home_team=home_team,
                away_team=away_team,
                provider_status="not_configured",
                error=str(exc),
            )
        except NewsSearchFetchError as exc:
            return self._empty_response(
                query=query,
                home_team=home_team,
                away_team=away_team,
                provider_status="provider_error",
                error=str(exc),
            )

        response = MatchNewsSearchResponse(
            provider_status="ready",
            query=query,
            home_team=home_team,
            away_team=away_team,
            generated_at=datetime.now(UTC),
            results=results,
            source_id=source_id,
            server_time=server_time,
        )
        self._cache[cache_key] = CachedNewsSearch(
            expires_at=datetime.now(UTC)
            + timedelta(seconds=self._config.perplexity_search_cache_ttl_seconds),
            response=response,
        )
        return response

    async def search_latest_information(
        self,
        *,
        query: str,
        max_results: int | None = None,
        force_refresh: bool = False,
        recency: SearchRecency | None = None,
    ) -> LatestInformationSearchResponse:
        query = _clean_query(query)
        max_results = _bounded_max_results(
            max_results or self._config.perplexity_search_max_results
        )

        if not self._perplexity_connector.configured:
            return self._empty_latest_information_response(
                query=query,
                provider_status="not_configured",
                error="Set PERPLEXITY_API_KEY to fetch latest information.",
            )

        cache_key = f"latest:{query}:{max_results}:{recency or ''}"
        cached = self._cache.get(cache_key)
        if cached and not force_refresh and cached.expires_at > datetime.now(UTC):
            return cached.response

        try:
            results, source_id, server_time = await self._perplexity_connector.search(
                query=query,
                max_results=max_results,
                country=self._config.perplexity_search_country,
                language_filter=self._config.perplexity_search_language_filter,
                recency=recency,
            )
        except NewsSearchNotConfiguredError as exc:
            return self._empty_latest_information_response(
                query=query,
                provider_status="not_configured",
                error=str(exc),
            )
        except NewsSearchFetchError as exc:
            return self._empty_latest_information_response(
                query=query,
                provider_status="provider_error",
                error=str(exc),
            )

        response = LatestInformationSearchResponse(
            provider_status="ready",
            query=query,
            generated_at=datetime.now(UTC),
            results=results,
            source_id=source_id,
            server_time=server_time,
        )
        self._cache[cache_key] = CachedNewsSearch(
            expires_at=datetime.now(UTC)
            + timedelta(seconds=self._config.perplexity_search_cache_ttl_seconds),
            response=response,
        )
        return response

    @staticmethod
    def _empty_response(
        *,
        query: str,
        home_team: str,
        away_team: str,
        provider_status: str,
        error: str | None,
    ) -> MatchNewsSearchResponse:
        return MatchNewsSearchResponse(
            provider_status=provider_status,
            query=query,
            home_team=home_team,
            away_team=away_team,
            generated_at=datetime.now(UTC),
            results=[],
            error=error,
        )

    @staticmethod
    def _empty_latest_information_response(
        *,
        query: str,
        provider_status: str,
        error: str | None,
    ) -> LatestInformationSearchResponse:
        return LatestInformationSearchResponse(
            provider_status=provider_status,
            query=query,
            generated_at=datetime.now(UTC),
            results=[],
            error=error,
        )


def build_match_news_query(*, home_team: str, away_team: str) -> str:
    home = _clean_team_name(home_team)
    away = _clean_team_name(away_team)
    return f"thông tin trận {home} và {away}"


def _clean_team_name(value: str) -> str:
    return " ".join(value.strip().split())


def _clean_query(value: str) -> str:
    return " ".join(value.strip().split())


def _bounded_max_results(value: int) -> int:
    return max(1, min(value, 20))
