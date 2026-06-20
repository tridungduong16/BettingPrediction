from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

OddsProviderStatus = Literal["ready", "not_configured", "unmapped", "provider_error"]
OddsProvider = Literal["the_odds_api"]


class OddsQuota(BaseModel):
    remaining_requests: int | None = None
    used_requests: int | None = None
    last_request_cost: int | None = None


class OddsSport(BaseModel):
    key: str
    group: str | None = None
    title: str
    description: str | None = None
    active: bool | None = None
    has_outrights: bool | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class OddsOutcome(BaseModel):
    name: str
    price: float
    point: float | None = None
    description: str | None = None
    link: str | None = None
    sid: str | None = None
    bet_limit: float | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class OddsMarket(BaseModel):
    key: str
    last_update: datetime | None = None
    outcomes: list[OddsOutcome] = Field(default_factory=list)
    link: str | None = None
    sid: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class OddsBookmaker(BaseModel):
    key: str
    title: str
    last_update: datetime | None = None
    markets: list[OddsMarket] = Field(default_factory=list)
    link: str | None = None
    sid: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class OddsEvent(BaseModel):
    id: str
    sport_key: str
    sport_title: str | None = None
    commence_time: datetime
    home_team: str
    away_team: str
    bookmakers: list[OddsBookmaker] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)


class OddsSportsResponse(OddsQuota):
    provider: OddsProvider = "the_odds_api"
    provider_status: OddsProviderStatus
    generated_at: datetime
    sports: list[OddsSport] = Field(default_factory=list)
    error: str | None = None


class OddsListResponse(OddsQuota):
    provider: OddsProvider = "the_odds_api"
    provider_status: OddsProviderStatus
    generated_at: datetime
    sport: str
    regions: list[str] = Field(default_factory=list)
    markets: list[str] = Field(default_factory=list)
    odds_format: str = "decimal"
    events: list[OddsEvent] = Field(default_factory=list)
    error: str | None = None


class MatchOddsResponse(OddsQuota):
    provider: OddsProvider = "the_odds_api"
    provider_status: OddsProviderStatus
    match_id: str
    sport: str
    regions: list[str] = Field(default_factory=list)
    markets: list[str] = Field(default_factory=list)
    odds_format: str = "decimal"
    generated_at: datetime
    home_team: str | None = None
    away_team: str | None = None
    event: OddsEvent | None = None
    candidate_events: list[OddsEvent] = Field(default_factory=list)
    error: str | None = None
