from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from starlette.responses import StreamingResponse

from app.agents.base import StreamEvent
from app.core.app_config import WorldCupSourceName
from app.dependencies import get_market_prediction_service
from app.models.chat import (
    PredictionChatRecommendedQuestionsResponse,
    PredictionChatRequest,
    PredictionChatResponse,
)
from app.models.market_prediction import (
    MarketPredictionResponse,
    MatchInsightResponse,
    PredictionMode,
    ResponseLanguage,
)
from app.services.market_prediction_service import (
    MarketPredictionMatchNotFoundError,
    MarketPredictionService,
    MarketPredictionUnavailableError,
)
from app.services.worldcup_service import WorldCupDataUnavailableError

router = APIRouter()


def _sse_event(event: StreamEvent) -> str:
    event_type = event.type.replace("\n", "_").replace("\r", "_")
    payload = json.dumps(jsonable_encoder(event), ensure_ascii=False, default=str)
    return f"event: {event_type}\ndata: {payload}\n\n"


async def _sse_stream(events: AsyncIterator[StreamEvent]) -> AsyncIterator[str]:
    async for event in events:
        yield _sse_event(event)


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
    language: ResponseLanguage = "vi",
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
            language=language,
            news_max_results=news_max_results,
            prediction_mode=prediction_mode,
        )
    except MarketPredictionMatchNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except WorldCupDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except MarketPredictionUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/matches/{match_id}/chat", response_model=PredictionChatResponse)
async def chat_about_match(
    match_id: str,
    request: PredictionChatRequest,
    service: Annotated[MarketPredictionService, Depends(get_market_prediction_service)],
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    source: WorldCupSourceName = "auto",
    provider_fixture_id: str | None = None,
    force_refresh: bool = False,
    include_live: bool = True,
    include_news: bool = True,
    language: ResponseLanguage = "vi",
    news_max_results: Annotated[int | None, Query(ge=1, le=20)] = None,
    prediction_mode: PredictionMode = "pre_match",
) -> PredictionChatResponse:
    try:
        return await service.answer_match_chat(
            match_id=match_id,
            message=request.message,
            year=year,
            source=source,
            provider_fixture_id=provider_fixture_id,
            force_refresh=force_refresh,
            include_live=include_live,
            include_news=include_news,
            language=language,
            news_max_results=news_max_results,
            prediction_mode=prediction_mode,
            thread_id=request.thread_id,
            prediction_context=request.prediction_context,
        )
    except MarketPredictionMatchNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except WorldCupDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except MarketPredictionUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get(
    "/matches/{match_id}/chat/recommended-questions",
    response_model=PredictionChatRecommendedQuestionsResponse,
)
async def recommend_match_chat_questions(
    match_id: str,
    service: Annotated[MarketPredictionService, Depends(get_market_prediction_service)],
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    source: WorldCupSourceName = "auto",
    provider_fixture_id: str | None = None,
    force_refresh: bool = False,
    include_live: bool = True,
    include_news: bool = True,
    language: ResponseLanguage = "vi",
    news_max_results: Annotated[int | None, Query(ge=1, le=20)] = None,
    prediction_mode: PredictionMode = "pre_match",
) -> PredictionChatRecommendedQuestionsResponse:
    try:
        return await service.recommend_match_chat_questions(
            match_id=match_id,
            year=year,
            source=source,
            provider_fixture_id=provider_fixture_id,
            force_refresh=force_refresh,
            include_live=include_live,
            include_news=include_news,
            language=language,
            news_max_results=news_max_results,
            prediction_mode=prediction_mode,
        )
    except MarketPredictionMatchNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except WorldCupDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except MarketPredictionUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/matches/{match_id}/chat/stream")
async def stream_chat_about_match(
    match_id: str,
    request: PredictionChatRequest,
    service: Annotated[MarketPredictionService, Depends(get_market_prediction_service)],
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    source: WorldCupSourceName = "auto",
    provider_fixture_id: str | None = None,
    force_refresh: bool = False,
    include_live: bool = True,
    include_news: bool = True,
    language: ResponseLanguage = "vi",
    news_max_results: Annotated[int | None, Query(ge=1, le=20)] = None,
    prediction_mode: PredictionMode = "pre_match",
) -> StreamingResponse:
    try:
        events = await service.stream_match_chat_events(
            match_id=match_id,
            message=request.message,
            year=year,
            source=source,
            provider_fixture_id=provider_fixture_id,
            force_refresh=force_refresh,
            include_live=include_live,
            include_news=include_news,
            language=language,
            news_max_results=news_max_results,
            prediction_mode=prediction_mode,
            thread_id=request.thread_id,
            prediction_context=request.prediction_context,
        )
    except MarketPredictionMatchNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except WorldCupDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except MarketPredictionUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return StreamingResponse(
        _sse_stream(events),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/matches/{match_id}/insight", response_model=MatchInsightResponse)
async def predict_match_insight(
    match_id: str,
    service: Annotated[MarketPredictionService, Depends(get_market_prediction_service)],
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    source: WorldCupSourceName = "auto",
    provider_fixture_id: str | None = None,
    force_refresh: bool = False,
    include_live: bool = True,
    include_news: bool = True,
    language: ResponseLanguage = "vi",
    news_max_results: Annotated[int | None, Query(ge=1, le=20)] = None,
    prediction_mode: PredictionMode = "pre_match",
) -> MatchInsightResponse:
    try:
        return await service.predict_match_insight(
            match_id=match_id,
            year=year,
            source=source,
            provider_fixture_id=provider_fixture_id,
            force_refresh=force_refresh,
            include_live=include_live,
            include_news=include_news,
            language=language,
            news_max_results=news_max_results,
            prediction_mode=prediction_mode,
        )
    except MarketPredictionMatchNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except WorldCupDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except MarketPredictionUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
