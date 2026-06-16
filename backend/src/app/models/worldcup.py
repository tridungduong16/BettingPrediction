from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

MatchStatus = Literal["scheduled", "finished"]


class Goal(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str
    minute: str | int | None = None
    penalty: bool | None = None
    own_goal: bool | None = Field(default=None, alias="ownGoal")


class Score(BaseModel):
    model_config = ConfigDict(extra="allow")

    ft: tuple[int, int] | None = None
    ht: tuple[int, int] | None = None
    et: tuple[int, int] | None = None
    p: tuple[int, int] | None = None


class WorldCupMatch(BaseModel):
    id: str
    source_index: int
    competition: str
    round: str
    date: str
    time: str | None = None
    kickoff_utc: datetime | None = None
    team1: str
    team2: str
    group: str | None = None
    ground: str | None = None
    city: str | None = None
    status: MatchStatus
    score: Score | None = None
    goals1: list[Goal] = Field(default_factory=list)
    goals2: list[Goal] = Field(default_factory=list)
    winner: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class WorldCupSourceInfo(BaseModel):
    name: str
    year: int
    source_name: str
    source_url: str
    source_text_url: str
    fetched_at: datetime
    cache_hit: bool
    stale_cache: bool
    match_count: int


class WorldCupDataset(BaseModel):
    source: WorldCupSourceInfo
    matches: list[WorldCupMatch]

