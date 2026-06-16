from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.app_config import WorldCupSourceName
from app.dependencies import get_market_prediction_service
from app.models.market_prediction import MarketPredictionResponse, PredictionMode
from app.services.market_prediction_service import (
    MarketPredictionMatchNotFoundError,
    MarketPredictionService,
    MarketPredictionUnavailableError,
)
from app.services.worldcup_service import WorldCupDataUnavailableError

router = APIRouter()


@router.get("/matches/{match_id}/markets", response_model=MarketPredictionResponse)
async def predict_match_markets(
    match_id: str,
    service: Annotated[MarketPredictionService, Depends(get_market_prediction_service)],
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    source: WorldCupSourceName = "auto",
    provider_fixture_id: str | None = None,
    force_refresh: bool = False,
    include_live: bool = True,
    include_news: bool = True,
    news_max_results: Annotated[int | None, Query(ge=1, le=20)] = None,
    prediction_mode: PredictionMode = "pre_match",
) -> MarketPredictionResponse:
    try:
        return await service.predict_match_markets(
            match_id=match_id,
            year=year,
            source=source,
            provider_fixture_id=provider_fixture_id,
            force_refresh=force_refresh,
            include_live=include_live,
            include_news=include_news,
            news_max_results=news_max_results,
            prediction_mode=prediction_mode,
        )
    except MarketPredictionMatchNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except WorldCupDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except MarketPredictionUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
