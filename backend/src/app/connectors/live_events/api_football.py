from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

import httpx

from app.connectors.live_events.base import LiveEventsFetchError, LiveEventsNotConfiguredError
from app.core.app_config import AppConfig
from app.models.live_events import (
    LiveEventProviderFixtureSearchResult,
    LiveEventType,
    LiveMatchClock,
    LiveMatchEvent,
    LiveMatchPhase,
    LiveMatchScore,
    LiveMatchSnapshot,
    LivePlayer,
    LiveTeam,
    TeamSide,
)


class APIFootballLiveEventsConnector:
    provider_name = "api_football"

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
        return bool(self._config.api_football_api_key)

    async def fetch_snapshot(self, *, match_id: str, provider_fixture_id: str) -> LiveMatchSnapshot:
        if not self.configured:
            raise LiveEventsNotConfiguredError("API-Football key is not configured")

        observed_at = datetime.now(UTC)
        async with self._client() as client:
            fixture_payload = await self._get(
                client,
                "/fixtures",
                params={"id": provider_fixture_id},
            )
            events_payload = await self._get(
                client,
                "/fixtures/events",
                params={"fixture": provider_fixture_id},
            )

        fixture = self._first_response_item(fixture_payload)
        raw_events = self._response_list(events_payload)

        home_team_id = self._nested_str(fixture, "teams", "home", "id")
        away_team_id = self._nested_str(fixture, "teams", "away", "id")
        score = LiveMatchScore(
            home=self._nested_int(fixture, "goals", "home"),
            away=self._nested_int(fixture, "goals", "away"),
        )
        clock = LiveMatchClock(
            phase=self._phase(self._nested_str(fixture, "fixture", "status", "short")),
            elapsed=self._nested_int(fixture, "fixture", "status", "elapsed"),
            extra=self._nested_int(fixture, "fixture", "status", "extra"),
            raw_status=self._nested_str(fixture, "fixture", "status", "short"),
        )

        events = [
            self._normalize_event(
                match_id=match_id,
                provider_fixture_id=provider_fixture_id,
                sequence=index,
                raw_event=raw_event,
                home_team_id=home_team_id,
                away_team_id=away_team_id,
                observed_at=observed_at,
            )
            for index, raw_event in enumerate(raw_events)
            if isinstance(raw_event, dict)
        ]

        return LiveMatchSnapshot(
            match_id=match_id,
            provider="api_football",
            provider_fixture_id=provider_fixture_id,
            provider_status="ready",
            observed_at=observed_at,
            fetched_at=observed_at,
            score=score,
            clock=clock,
            events=events,
            raw={"fixture": fixture, "events": raw_events},
        )

    async def search_fixtures(
        self,
        *,
        date: str,
        team: str | None = None,
        league: int | None = None,
        season: int | None = None,
    ) -> list[LiveEventProviderFixtureSearchResult]:
        if not self.configured:
            raise LiveEventsNotConfiguredError("API-Football key is not configured")

        params: dict[str, str | int] = {"date": date}
        if league is not None:
            params["league"] = league
        if season is not None:
            params["season"] = season

        async with self._client() as client:
            payload = await self._get(client, "/fixtures", params=params)

        results: list[LiveEventProviderFixtureSearchResult] = []
        team_filter = team.casefold() if team else None
        for item in self._response_list(payload):
            if not isinstance(item, dict):
                continue
            home = self._nested_str(item, "teams", "home", "name")
            away = self._nested_str(item, "teams", "away", "name")
            if team_filter and team_filter not in f"{home} {away}".casefold():
                continue
            fixture_id = self._nested_str(item, "fixture", "id")
            if not fixture_id:
                continue
            results.append(
                LiveEventProviderFixtureSearchResult(
                    provider="api_football",
                    provider_fixture_id=fixture_id,
                    name=f"{home or 'TBD'} vs {away or 'TBD'}",
                    date=self._nested_str(item, "fixture", "date"),
                    status=self._nested_str(item, "fixture", "status", "short"),
                    home_team=home,
                    away_team=away,
                    raw=item,
                )
            )
        return results

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=str(self._config.api_football_base_url).rstrip("/"),
            headers={"x-apisports-key": self._config.api_football_api_key or ""},
            timeout=self._config.live_events_http_timeout_seconds,
            transport=self._transport,
        )

    @staticmethod
    async def _get(
        client: httpx.AsyncClient,
        path: str,
        *,
        params: dict[str, str | int],
    ) -> dict[str, Any]:
        try:
            response = await client.get(path, params=params)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise LiveEventsFetchError(str(exc)) from exc

        if not isinstance(payload, dict):
            raise LiveEventsFetchError("API-Football returned a non-object response")

        errors = payload.get("errors")
        if errors:
            raise LiveEventsFetchError(f"API-Football returned errors: {errors}")
        return payload

    @classmethod
    def _normalize_event(
        cls,
        *,
        match_id: str,
        provider_fixture_id: str,
        sequence: int,
        raw_event: dict[str, Any],
        home_team_id: str | None,
        away_team_id: str | None,
        observed_at: datetime,
    ) -> LiveMatchEvent:
        event_type = cls._event_type(raw_event.get("type"), raw_event.get("detail"))
        team_id = cls._nested_str(raw_event, "team", "id")
        player_id = cls._nested_str(raw_event, "player", "id")
        assist_id = cls._nested_str(raw_event, "assist", "id")
        elapsed = cls._nested_int(raw_event, "time", "elapsed")
        extra = cls._nested_int(raw_event, "time", "extra")

        return LiveMatchEvent(
            id=cls._event_id(provider_fixture_id, sequence, raw_event),
            match_id=match_id,
            provider="api_football",
            provider_fixture_id=provider_fixture_id,
            provider_event_id=None,
            sequence=sequence,
            type=event_type,
            detail=cls._optional_str(raw_event.get("detail")),
            comments=cls._optional_str(raw_event.get("comments")),
            minute=elapsed,
            stoppage_minute=extra,
            team=LiveTeam(
                id=team_id,
                name=cls._nested_str(raw_event, "team", "name"),
                side=cls._team_side(team_id, home_team_id, away_team_id),
            ),
            player=LivePlayer(
                id=player_id,
                name=cls._nested_str(raw_event, "player", "name"),
            )
            if player_id or cls._nested_str(raw_event, "player", "name")
            else None,
            assist_player=LivePlayer(
                id=assist_id,
                name=cls._nested_str(raw_event, "assist", "name"),
            )
            if assist_id or cls._nested_str(raw_event, "assist", "name")
            else None,
            occurred_at=None,
            observed_at=observed_at,
            raw=raw_event,
        )

    @staticmethod
    def _event_type(value: object, detail: object) -> LiveEventType:
        text = f"{value or ''} {detail or ''}".casefold()
        if "goal" in text:
            return "goal"
        if "card" in text:
            return "card"
        if "subst" in text:
            return "substitution"
        if "var" in text:
            return "var"
        if "penalty" in text:
            return "penalty"
        if "injury" in text:
            return "injury"
        if "shot" in text:
            return "shot"
        if "corner" in text:
            return "corner"
        return "other"

    @staticmethod
    def _phase(short_status: str | None) -> LiveMatchPhase:
        match short_status:
            case "NS" | "TBD":
                return "scheduled"
            case "1H":
                return "first_half"
            case "HT":
                return "halftime"
            case "2H":
                return "second_half"
            case "ET":
                return "extra_time"
            case "P":
                return "penalties"
            case "FT" | "AET" | "PEN":
                return "finished"
            case "SUSP" | "INT" | "PST" | "CANC" | "ABD":
                return "suspended"
            case _:
                return "unknown"

    @staticmethod
    def _team_side(
        team_id: str | None,
        home_team_id: str | None,
        away_team_id: str | None,
    ) -> TeamSide:
        if team_id and home_team_id and team_id == home_team_id:
            return "home"
        if team_id and away_team_id and team_id == away_team_id:
            return "away"
        return "unknown"

    @staticmethod
    def _event_id(provider_fixture_id: str, sequence: int, raw_event: dict[str, Any]) -> str:
        parts = [
            provider_fixture_id,
            str(sequence),
            str(raw_event.get("type") or ""),
            str(raw_event.get("detail") or ""),
            str(raw_event.get("comments") or ""),
            str(APIFootballLiveEventsConnector._nested_str(raw_event, "time", "elapsed") or ""),
            str(APIFootballLiveEventsConnector._nested_str(raw_event, "time", "extra") or ""),
            str(APIFootballLiveEventsConnector._nested_str(raw_event, "team", "id") or ""),
            str(APIFootballLiveEventsConnector._nested_str(raw_event, "player", "id") or ""),
        ]
        digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]
        return f"api-football-{provider_fixture_id}-{digest}"

    @staticmethod
    def _first_response_item(payload: dict[str, Any]) -> dict[str, Any]:
        response = payload.get("response")
        if not isinstance(response, list) or not response:
            raise LiveEventsFetchError("API-Football returned no fixture data")
        first = response[0]
        if not isinstance(first, dict):
            raise LiveEventsFetchError("API-Football fixture data is malformed")
        return first

    @staticmethod
    def _response_list(payload: dict[str, Any]) -> list[Any]:
        response = payload.get("response")
        return response if isinstance(response, list) else []

    @staticmethod
    def _nested_str(payload: dict[str, Any], *keys: str) -> str | None:
        value: Any = payload
        for key in keys:
            if not isinstance(value, dict):
                return None
            value = value.get(key)
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @staticmethod
    def _nested_int(payload: dict[str, Any], *keys: str) -> int | None:
        value: Any = payload
        for key in keys:
            if not isinstance(value, dict):
                return None
            value = value.get(key)
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _optional_str(value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None
