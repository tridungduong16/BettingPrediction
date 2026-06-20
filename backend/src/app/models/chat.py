from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models.live_events import LiveMatchSnapshot
from app.models.market_prediction import PredictionMode, ResponseLanguage
from app.models.worldcup import WorldCupMatch


class PredictionChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    thread_id: str | None = Field(default=None, max_length=128)
    prediction_context: dict[str, Any] | None = None

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("message must not be blank")
        return stripped


class PredictionChatRecommendedQuestionsOutput(BaseModel):
    questions: list[str] = Field(min_length=3, max_length=3)

    @field_validator("questions")
    @classmethod
    def strip_questions(cls, value: list[str]) -> list[str]:
        stripped = [question.strip() for question in value]
        if any(not question for question in stripped):
            raise ValueError("questions must not contain blanks")
        return stripped


class PredictionChatResponse(BaseModel):
    match_id: str
    generated_at: datetime
    language: ResponseLanguage = "vi"
    model_name: str | None = None
    prediction_mode: PredictionMode = "pre_match"
    thread_id: str | None = None
    message: str
    answer: str
    match: WorldCupMatch
    live_snapshot: LiveMatchSnapshot | None = None
    prediction_context: dict[str, Any] | None = None


class PredictionChatRecommendedQuestionsResponse(BaseModel):
    match_id: str
    generated_at: datetime
    language: ResponseLanguage = "vi"
    model_name: str | None = None
    prediction_mode: PredictionMode = "pre_match"
    match: WorldCupMatch
    live_snapshot: LiveMatchSnapshot | None = None
    prediction_context: dict[str, Any] | None = None
    questions: list[str] = Field(min_length=3, max_length=3)
