from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_news_search_service
from app.models.news import MatchNewsSearchResponse, SearchRecency
from app.services.news_search_service import NewsSearchService

router = APIRouter()


@router.get("/match", response_model=MatchNewsSearchResponse)
async def search_match_news(
    service: Annotated[NewsSearchService, Depends(get_news_search_service)],
    home_team: Annotated[str, Query(min_length=1)],
    away_team: Annotated[str, Query(min_length=1)],
    max_results: Annotated[int | None, Query(ge=1, le=20)] = None,
    force_refresh: bool = False,
    recency: SearchRecency | None = None,
) -> MatchNewsSearchResponse:
    return await service.search_match_news(
        home_team=home_team,
        away_team=away_team,
        max_results=max_results,
        force_refresh=force_refresh,
        recency=recency,
    )
