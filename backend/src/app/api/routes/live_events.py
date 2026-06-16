from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.dependencies import get_live_event_service
from app.models.live_events import (
    LiveEventProviderFixtureSearchResult,
    LiveMatchEvent,
    LiveMatchSnapshot,
)
from app.services.live_event_service import LiveEventService, LiveEventsUnavailableError

router = APIRouter()


@router.get("/matches/{match_id}/snapshot", response_model=LiveMatchSnapshot)
async def get_live_match_snapshot(
    match_id: str,
    service: Annotated[LiveEventService, Depends(get_live_event_service)],
    provider_fixture_id: str | None = None,
    force_refresh: bool = False,
) -> LiveMatchSnapshot:
    return await service.get_snapshot(
        match_id=match_id,
        provider_fixture_id=provider_fixture_id,
        force_refresh=force_refresh,
    )


@router.get("/matches/{match_id}/events", response_model=list[LiveMatchEvent])
async def list_live_match_events(
    match_id: str,
    service: Annotated[LiveEventService, Depends(get_live_event_service)],
    provider_fixture_id: str | None = None,
    force_refresh: bool = False,
) -> list[LiveMatchEvent]:
    return await service.list_events(
        match_id=match_id,
        provider_fixture_id=provider_fixture_id,
        force_refresh=force_refresh,
    )


@router.get("/provider-fixtures/search", response_model=list[LiveEventProviderFixtureSearchResult])
async def search_provider_fixtures(
    service: Annotated[LiveEventService, Depends(get_live_event_service)],
    date: Annotated[str, Query(description="Fixture date in YYYY-MM-DD format.")],
    team: str | None = None,
    league: int | None = None,
    season: int | None = None,
) -> list[LiveEventProviderFixtureSearchResult]:
    try:
        return await service.search_provider_fixtures(
            date=date,
            team=team,
            league=league,
            season=season,
        )
    except LiveEventsUnavailableError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.websocket("/matches/{match_id}/events/ws")
async def live_match_events_websocket(
    websocket: WebSocket,
    match_id: str,
    service: Annotated[LiveEventService, Depends(get_live_event_service)],
    provider_fixture_id: str | None = None,
    interval_seconds: float = 10.0,
) -> None:
    await websocket.accept()
    interval = max(interval_seconds, 3.0)

    try:
        while True:
            snapshot = await service.get_snapshot(
                match_id=match_id,
                provider_fixture_id=provider_fixture_id,
                force_refresh=True,
            )
            await websocket.send_json(snapshot.model_dump(mode="json"))
            await asyncio.sleep(interval)
    except WebSocketDisconnect:
        return
