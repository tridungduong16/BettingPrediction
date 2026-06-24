from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

MatchStatus = Literal["scheduled", "finished"]
SimulationSlotSource = Literal["actual", "match_reference", "seed", "unresolved"]
SimulationTargetRound = Literal[
    "Final",
    "Match for third place",
    "Quarter-final",
    "Round of 16",
    "Round of 32",
    "Semi-final",
]


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


class WorldCupTeamStanding(BaseModel):
    group: str
    position: int
    team: str
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    goals_for: int = 0
    goals_against: int = 0
    goal_difference: int = 0
    points: int = 0
    tied_on_primary_metrics: bool = False


class WorldCupScenarioOutcome(BaseModel):
    match_id: str
    team1: str
    team2: str
    outcome: Literal["draw", "team1", "team2"]
    label: str


class WorldCupGroupQualificationScenario(BaseModel):
    id: str
    title: str
    first: str
    second: str
    third: str
    advancing_teams: list[str]
    outcomes: list[WorldCupScenarioOutcome]
    outcome_count: int
    outcome_share: float
    tie_breaker_required: bool = False
    notes: list[str] = Field(default_factory=list)


class WorldCupGroupSimulation(BaseModel):
    group: str
    standings: list[WorldCupTeamStanding]
    remaining_matches: list[WorldCupMatch]
    possible_winners: list[str]
    possible_runners_up: list[str]
    possible_third_place: list[str]
    scenarios: list[WorldCupGroupQualificationScenario]
    total_outcome_paths: int
    scenario_count: int
    truncated: bool = False


class WorldCupSimulationSlot(BaseModel):
    label: str
    resolved_team: str | None = None
    candidates: list[str] = Field(default_factory=list)
    source: SimulationSlotSource = "unresolved"


class WorldCupSimulatedFixture(BaseModel):
    match_id: str
    match_number: int
    round: str
    date: str
    time: str | None = None
    team1: WorldCupSimulationSlot
    team2: WorldCupSimulationSlot
    possible_pairings: list[tuple[str, str]] = Field(default_factory=list)
    possible_pairing_count: int = 0
    pairings_truncated: bool = False


class WorldCupSimulationResponse(BaseModel):
    source: WorldCupSourceInfo
    generated_at: datetime
    target_round: SimulationTargetRound
    groups: list[WorldCupGroupSimulation]
    third_place_candidates: list[str]
    bracket: list[WorldCupSimulatedFixture]
    data_quality_notes: list[str] = Field(default_factory=list)
