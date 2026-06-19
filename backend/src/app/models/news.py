from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

NewsProviderStatus = Literal["ready", "not_configured", "provider_error"]
SearchRecency = Literal["hour", "day", "week", "month", "year"]


class NewsSearchResult(BaseModel):
    title: str
    url: str
    snippet: str | None = None
    date: str | None = None
    last_updated: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class MatchNewsSearchResponse(BaseModel):
    provider: Literal["perplexity"] = "perplexity"
    provider_status: NewsProviderStatus
    query: str
    home_team: str
    away_team: str
    generated_at: datetime
    results: list[NewsSearchResult] = Field(default_factory=list)
    error: str | None = None
    source_id: str | None = None
    server_time: str | None = None


class LatestInformationSearchResponse(BaseModel):
    provider: Literal["perplexity"] = "perplexity"
    provider_status: NewsProviderStatus
    query: str
    generated_at: datetime
    results: list[NewsSearchResult] = Field(default_factory=list)
    error: str | None = None
    source_id: str | None = None
    server_time: str | None = None
