from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.app_config import AppConfig, WorldCupSourceName


class WorldCupFetchError(RuntimeError):
    """Raised when no configured World Cup source can be fetched."""


@dataclass(frozen=True)
class FetchedWorldCupPayload:
    year: int
    source_name: str
    source_url: str
    payload: dict[str, Any]


class OpenFootballWorldCupConnector:
    def __init__(self, config: AppConfig) -> None:
        self._config = config

    async def fetch_dataset(
        self,
        *,
        year: int,
        source: WorldCupSourceName = "auto",
    ) -> FetchedWorldCupPayload:
        errors: list[str] = []

        async with httpx.AsyncClient(timeout=self._config.worldcup_http_timeout_seconds) as client:
            for source_name, url in self._config.source_urls(source, year):
                try:
                    response = await client.get(url, headers={"Accept": "application/json"})
                    response.raise_for_status()
                    payload = response.json()
                    self._validate_payload(payload, source_name)
                    return FetchedWorldCupPayload(
                        year=year,
                        source_name=source_name,
                        source_url=url,
                        payload=payload,
                    )
                except (httpx.HTTPError, ValueError, TypeError) as exc:
                    errors.append(f"{source_name} ({url}): {exc}")

        joined_errors = "; ".join(errors) if errors else "no source URLs configured"
        raise WorldCupFetchError(f"Unable to fetch World Cup {year} data: {joined_errors}")

    @staticmethod
    def _validate_payload(payload: object, source_name: str) -> None:
        if not isinstance(payload, dict):
            raise ValueError(f"{source_name} returned a non-object JSON payload")
        matches = payload.get("matches")
        if not isinstance(matches, list):
            raise ValueError(f"{source_name} payload is missing a matches list")

