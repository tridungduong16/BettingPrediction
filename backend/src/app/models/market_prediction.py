from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.live_events import LiveMatchSnapshot
from app.models.worldcup import WorldCupMatch

MarketFamily = Literal["asian_handicap", "over_under", "one_x_two", "cards", "corners"]
MarketRisk = Literal["low", "medium", "high"]
PredictionConfidence = Literal["low", "medium", "high"]
PredictionMode = Literal["pre_match", "live", "post_match_evaluation"]
ResponseLanguage = Literal["vi", "en"]
TrendDirection = Literal["up", "down", "flat"]
OutcomeId = Literal["home", "draw", "away"]
ReasoningImpact = Literal["high", "medium", "low"]
EdgeTone = Literal["green", "blue", "red", "orange", "purple", "gray"]


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


class MarketPredictionAgentOutput(BaseModel):
    summary: str
    predictions: list[MarketPrediction] = Field(min_length=1)
    data_quality_notes: list[str] = Field(default_factory=list)


class MatchInsightOutcome(BaseModel):
    id: OutcomeId
    label: str
    value: int = Field(ge=0, le=100)
    trend: float = 0
    direction: TrendDirection = "flat"


class MatchInsightReasoningPoint(BaseModel):
    id: str
    title: str
    detail: str
    impact: ReasoningImpact


class MatchInsightReasoning(BaseModel):
    headline: str
    description: str
    points: list[MatchInsightReasoningPoint] = Field(min_length=1)


class MatchInsightEdgeSignal(BaseModel):
    id: str
    label: str
    detail: str
    delta: str
    tone: EdgeTone


class MatchInsightAgentOutput(BaseModel):
    winner: str
    confidence: float = Field(ge=0, le=10)
    status: str
    summary: str
    outcomes: list[MatchInsightOutcome] = Field(min_length=3, max_length=3)
    reasoning: MatchInsightReasoning
    edge_signals: list[MatchInsightEdgeSignal] = Field(min_length=1)
    net_edge: str
    data_quality_notes: list[str] = Field(default_factory=list)


class MarketPredictionResponse(BaseModel):
    match_id: str
    generated_at: datetime
    language: ResponseLanguage = "vi"
    model_name: str | None = None
    prediction_mode: PredictionMode = "pre_match"
    match: WorldCupMatch
    live_snapshot: LiveMatchSnapshot | None = None
    prediction_context: dict[str, Any] | None = None
    markets: list[MarketPredictionCandidate] = Field(min_length=1)
    summary: str
    predictions: list[MarketPrediction] = Field(min_length=1)
    data_quality_notes: list[str] = Field(default_factory=list)


class MatchInsightResponse(BaseModel):
    match_id: str
    generated_at: datetime
    language: ResponseLanguage = "vi"
    model_name: str | None = None
    prediction_mode: PredictionMode = "pre_match"
    match: WorldCupMatch
    live_snapshot: LiveMatchSnapshot | None = None
    prediction_context: dict[str, Any] | None = None
    insight: MatchInsightAgentOutput
