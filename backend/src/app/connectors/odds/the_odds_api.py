from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx

from app.connectors.odds.base import OddsFetchError, OddsNotConfiguredError
from app.core.app_config import AppConfig
from app.models.odds import (
    OddsBookmaker,
    OddsEvent,
    OddsListResponse,
    OddsMarket,
    OddsOutcome,
    OddsQuota,
    OddsSport,
    OddsSportsResponse,
)


class TheOddsAPIConnector:
    provider_name = "the_odds_api"

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
        return bool(self._config.odds_api_key)

    async def fetch_sports(self, *, all_sports: bool = False) -> OddsSportsResponse:
        if not self.configured:
            raise OddsNotConfiguredError("The Odds API key is not configured")

        params: dict[str, str] = {"apiKey": self._config.odds_api_key or ""}
        if all_sports:
            params["all"] = "true"

        async with self._client() as client:
            payload, quota = await self._get(client, "/v4/sports/", params=params)

        if not isinstance(payload, list):
            raise OddsFetchError("The Odds API sports response is not a list")

        return OddsSportsResponse(
            provider_status="ready",
            generated_at=datetime.now(UTC),
            sports=[
                self._sport_from_payload(item) for item in payload if isinstance(item, dict)
            ],
            **quota.model_dump(),
        )

    async def fetch_odds(
        self,
        *,
        sport: str,
        regions: list[str],
        markets: list[str],
        odds_format: str = "decimal",
        bookmakers: list[str] | None = None,
        event_ids: list[str] | None = None,
        commence_time_from: datetime | None = None,
        commence_time_to: datetime | None = None,
    ) -> OddsListResponse:
        if not self.configured:
            raise OddsNotConfiguredError("The Odds API key is not configured")

        params: dict[str, str] = {
            "apiKey": self._config.odds_api_key or "",
            "regions": ",".join(regions),
            "markets": ",".join(markets),
            "oddsFormat": odds_format,
            "dateFormat": "iso",
        }
        if bookmakers:
            params["bookmakers"] = ",".join(bookmakers)
        if event_ids:
            params["eventIds"] = ",".join(event_ids)
        if commence_time_from:
            params["commenceTimeFrom"] = _iso_z(commence_time_from)
        if commence_time_to:
            params["commenceTimeTo"] = _iso_z(commence_time_to)

        async with self._client() as client:
            payload, quota = await self._get(
                client,
                f"/v4/sports/{sport}/odds/",
                params=params,
            )

        if not isinstance(payload, list):
            raise OddsFetchError("The Odds API odds response is not a list")

        return OddsListResponse(
            provider_status="ready",
            generated_at=datetime.now(UTC),
            sport=sport,
            regions=regions,
            markets=markets,
            odds_format=odds_format,
            events=[
                self._event_from_payload(item) for item in payload if isinstance(item, dict)
            ],
            **quota.model_dump(),
        )

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=str(self._config.odds_api_base_url).rstrip("/"),
            timeout=self._config.odds_api_http_timeout_seconds,
            transport=self._transport,
        )

    @staticmethod
    async def _get(
        client: httpx.AsyncClient,
        path: str,
        *,
        params: dict[str, str],
    ) -> tuple[Any, OddsQuota]:
        try:
            response = await client.get(path, params=params)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise OddsFetchError(str(exc)) from exc

        return payload, OddsQuota(
            remaining_requests=_optional_int(response.headers.get("x-requests-remaining")),
            used_requests=_optional_int(response.headers.get("x-requests-used")),
            last_request_cost=_optional_int(response.headers.get("x-requests-last")),
        )

    @classmethod
    def _sport_from_payload(cls, item: dict[str, Any]) -> OddsSport:
        return OddsSport(
            key=cls._required_str(item.get("key"), ""),
            group=cls._optional_str(item.get("group")),
            title=cls._required_str(item.get("title"), "Unknown sport"),
            description=cls._optional_str(item.get("description")),
            active=_optional_bool(item.get("active")),
            has_outrights=_optional_bool(item.get("has_outrights")),
            raw=item,
        )

    @classmethod
    def _event_from_payload(cls, item: dict[str, Any]) -> OddsEvent:
        return OddsEvent(
            id=cls._required_str(item.get("id"), ""),
            sport_key=cls._required_str(item.get("sport_key"), ""),
            sport_title=cls._optional_str(item.get("sport_title")),
            commence_time=cls._datetime(item.get("commence_time")),
            home_team=cls._required_str(item.get("home_team"), ""),
            away_team=cls._required_str(item.get("away_team"), ""),
            bookmakers=[
                cls._bookmaker_from_payload(bookmaker)
                for bookmaker in item.get("bookmakers", [])
                if isinstance(bookmaker, dict)
            ],
            raw=item,
        )

    @classmethod
    def _bookmaker_from_payload(cls, item: dict[str, Any]) -> OddsBookmaker:
        return OddsBookmaker(
            key=cls._required_str(item.get("key"), ""),
            title=cls._required_str(item.get("title"), "Unknown bookmaker"),
            last_update=cls._optional_datetime(item.get("last_update")),
            markets=[
                cls._market_from_payload(market)
                for market in item.get("markets", [])
                if isinstance(market, dict)
            ],
            link=cls._optional_str(item.get("link")),
            sid=cls._optional_str(item.get("sid")),
            raw=item,
        )

    @classmethod
    def _market_from_payload(cls, item: dict[str, Any]) -> OddsMarket:
        return OddsMarket(
            key=cls._required_str(item.get("key"), ""),
            last_update=cls._optional_datetime(item.get("last_update")),
            outcomes=[
                cls._outcome_from_payload(outcome)
                for outcome in item.get("outcomes", [])
                if isinstance(outcome, dict)
            ],
            link=cls._optional_str(item.get("link")),
            sid=cls._optional_str(item.get("sid")),
            raw=item,
        )

    @classmethod
    def _outcome_from_payload(cls, item: dict[str, Any]) -> OddsOutcome:
        return OddsOutcome(
            name=cls._required_str(item.get("name"), ""),
            price=float(item.get("price") or 0),
            point=_optional_float(item.get("point")),
            description=cls._optional_str(item.get("description")),
            link=cls._optional_str(item.get("link")),
            sid=cls._optional_str(item.get("sid")),
            bet_limit=_optional_float(item.get("bet_limit")),
            raw=item,
        )

    @staticmethod
    def _optional_datetime(value: object) -> datetime | None:
        if value is None:
            return None
        return TheOddsAPIConnector._datetime(value)

    @staticmethod
    def _datetime(value: object) -> datetime:
        if isinstance(value, datetime):
            return value
        text = str(value or "").strip()
        if text.endswith("Z"):
            text = f"{text[:-1]}+00:00"
        return datetime.fromisoformat(text)

    @staticmethod
    def _optional_str(value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @classmethod
    def _required_str(cls, value: object, default: str) -> str:
        return cls._optional_str(value) or default


def _iso_z(value: datetime) -> str:
    normalized = value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)
    return normalized.isoformat().replace("+00:00", "Z")


def _optional_int(value: object) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _optional_float(value: object) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _optional_bool(value: object) -> bool | None:
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in {"1", "true", "yes"}:
        return True
    if text in {"0", "false", "no"}:
        return False
    return None
