from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
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
    WorldCupDataset,
    WorldCupMatch,
    WorldCupSourceInfo,
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
