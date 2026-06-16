from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.live_events import LiveMatchSnapshot
from app.models.worldcup import WorldCupMatch

MarketFamily = Literal["asian_handicap", "over_under", "one_x_two", "cards", "corners"]
MarketRisk = Literal["low", "medium", "high"]
PredictionConfidence = Literal["low", "medium", "high"]


class MarketPredictionCandidate(BaseModel):
    id: str
    family: MarketFamily
    name: str
    line: str | None = None
    description: str
    candidate_outcomes: list[str] = Field(min_length=1)


class MarketPrediction(BaseModel):
    id: str
    family: MarketFamily
    name: str
    selection: str
    line: str | None = None
    probability: int = Field(ge=0, le=100)
    confidence: PredictionConfidence
    risk: MarketRisk
    reasoning: str
    drivers: list[str] = Field(default_factory=list)
    data_gaps: list[str] = Field(default_factory=list)


class MarketPredictionAgentOutput(BaseModel):
    summary: str
    predictions: list[MarketPrediction] = Field(min_length=1)
    data_quality_notes: list[str] = Field(default_factory=list)


class MarketPredictionResponse(BaseModel):
    match_id: str
    generated_at: datetime
    model_name: str | None = None
    match: WorldCupMatch
    live_snapshot: LiveMatchSnapshot | None = None
    markets: list[MarketPredictionCandidate] = Field(min_length=1)
    summary: str
    predictions: list[MarketPrediction] = Field(min_length=1)
    data_quality_notes: list[str] = Field(default_factory=list)
