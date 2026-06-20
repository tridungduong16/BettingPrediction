from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

LiveEventsProvider = Literal["api_football"]
LiveProviderStatus = Literal["ready", "not_configured", "unmapped", "provider_error"]
LiveMatchPhase = Literal[
    "scheduled",
    "first_half",
    "halftime",
    "second_half",
    "extra_time",
    "penalties",
    "finished",
    "suspended",
    "unknown",
]
LiveEventType = Literal[
    "goal",
    "card",
    "substitution",
    "var",
    "period",
    "penalty",
    "injury",
    "shot",
    "corner",
    "other",
]
TeamSide = Literal["home", "away", "unknown"]


class ProviderFixtureMapping(BaseModel):
    provider: LiveEventsProvider = "api_football"
    provider_fixture_id: str


class LiveTeam(BaseModel):
    id: str | None = None
    name: str | None = None
    side: TeamSide = "unknown"


class LivePlayer(BaseModel):
    id: str | None = None
    name: str | None = None


class LiveLineupCoach(BaseModel):
    id: str | None = None
    name: str | None = None
    photo: str | None = None


class LiveLineupPlayer(BaseModel):
    id: str | None = None
    name: str | None = None
    number: int | None = None
    position: str | None = None
    grid: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class LiveMatchScore(BaseModel):
    home: int | None = None
    away: int | None = None


class LiveMatchClock(BaseModel):
    phase: LiveMatchPhase = "unknown"
    elapsed: int | None = None
    extra: int | None = None
    raw_status: str | None = None


class LiveMatchEvent(BaseModel):
    id: str
    match_id: str
    provider: LiveEventsProvider
    provider_fixture_id: str
    provider_event_id: str | None = None
    sequence: int
    type: LiveEventType
    detail: str | None = None
    comments: str | None = None
    minute: int | None = None
    stoppage_minute: int | None = None
    team: LiveTeam = Field(default_factory=LiveTeam)
    player: LivePlayer | None = None
    assist_player: LivePlayer | None = None
    score: LiveMatchScore | None = None
    occurred_at: datetime | None = None
    observed_at: datetime
    raw: dict[str, Any] = Field(default_factory=dict)


class LiveMatchSnapshot(BaseModel):
    match_id: str
    provider: LiveEventsProvider
    provider_fixture_id: str | None = None
    provider_status: LiveProviderStatus
    observed_at: datetime
    fetched_at: datetime | None = None
    score: LiveMatchScore = Field(default_factory=LiveMatchScore)
    clock: LiveMatchClock = Field(default_factory=LiveMatchClock)
    events: list[LiveMatchEvent] = Field(default_factory=list)
    error: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class LiveTeamLineup(BaseModel):
    team: LiveTeam = Field(default_factory=LiveTeam)
    formation: str | None = None
    coach: LiveLineupCoach | None = None
    start_xi: list[LiveLineupPlayer] = Field(default_factory=list)
    substitutes: list[LiveLineupPlayer] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)


class LiveMatchLineups(BaseModel):
    match_id: str
    provider: LiveEventsProvider
    provider_fixture_id: str | None = None
    provider_status: LiveProviderStatus
    observed_at: datetime
    fetched_at: datetime | None = None
    lineups: list[LiveTeamLineup] = Field(default_factory=list)
    error: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class LiveEventProviderFixtureSearchResult(BaseModel):
    provider: LiveEventsProvider
    provider_fixture_id: str
    name: str | None = None
    date: str | None = None
    status: str | None = None
    home_team: str | None = None
    away_team: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)
