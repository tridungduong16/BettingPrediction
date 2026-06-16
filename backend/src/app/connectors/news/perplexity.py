from __future__ import annotations

from typing import Any

import httpx

from app.connectors.news.base import NewsSearchFetchError, NewsSearchNotConfiguredError
from app.core.app_config import AppConfig
from app.models.news import NewsSearchResult, SearchRecency


class PerplexityNewsSearchConnector:
    provider_name = "perplexity"

    def __init__(
        self,
        *,
        config: AppConfig,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._config = config
        self._transport = transport

    @property
    def configured(self) -> bool:
        return bool(self._config.perplexity_api_key)

    async def search(
        self,
        *,
        query: str,
        max_results: int,
        country: str | None = None,
        language_filter: list[str] | None = None,
        recency: SearchRecency | None = None,
    ) -> tuple[list[NewsSearchResult], str | None, str | None]:
        if not self.configured:
            raise NewsSearchNotConfiguredError("Perplexity API key is not configured")

        body: dict[str, Any] = {
            "query": query,
            "max_results": max_results,
            "search_context_size": "medium",
        }
        if country:
            body["country"] = country.upper()
        if language_filter:
            body["search_language_filter"] = language_filter
        if recency:
            body["search_recency_filter"] = recency

        async with self._client() as client:
            payload = await self._post(client, body)

        results = [
            self._result_from_payload(item)
            for item in payload.get("results", [])
            if isinstance(item, dict)
        ]
        return (
            results,
            self._optional_str(payload.get("id")),
            self._optional_str(payload.get("server_time")),
        )

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {self._config.perplexity_api_key or ''}",
                "Content-Type": "application/json",
            },
            timeout=self._config.perplexity_search_timeout_seconds,
            transport=self._transport,
        )

    async def _post(self, client: httpx.AsyncClient, body: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await client.post(self._config.perplexity_search_url, json=body)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise NewsSearchFetchError(str(exc)) from exc

        if not isinstance(payload, dict):
            raise NewsSearchFetchError("Perplexity returned a non-object response")

        results = payload.get("results")
        if not isinstance(results, list):
            raise NewsSearchFetchError("Perplexity response is missing results[]")
        return payload

    @classmethod
    def _result_from_payload(cls, item: dict[str, Any]) -> NewsSearchResult:
        return NewsSearchResult(
            title=cls._required_str(item.get("title"), "Untitled result"),
            url=cls._required_str(item.get("url"), ""),
            snippet=cls._optional_str(item.get("snippet")),
            date=cls._optional_str(item.get("date")),
            last_updated=cls._optional_str(item.get("last_updated")),
            raw=item,
        )

    @staticmethod
    def _optional_str(value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @classmethod
    def _required_str(cls, value: object, default: str) -> str:
        return cls._optional_str(value) or default
