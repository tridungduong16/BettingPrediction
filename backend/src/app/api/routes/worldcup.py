from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.app_config import WorldCupSourceName
from app.dependencies import get_worldcup_service
from app.models.worldcup import MatchStatus, WorldCupDataset, WorldCupMatch, WorldCupSourceInfo
from app.services.worldcup_service import WorldCupDataUnavailableError, WorldCupService

router = APIRouter()


@router.get("/source", response_model=WorldCupSourceInfo)
async def get_source_info(
    service: Annotated[WorldCupService, Depends(get_worldcup_service)],
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    source: WorldCupSourceName = "auto",
    force_refresh: bool = False,
) -> WorldCupSourceInfo:
    try:
        dataset = await service.get_dataset(year=year, source=source, force_refresh=force_refresh)
    except WorldCupDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return dataset.source


@router.get("/matches", response_model=WorldCupDataset)
async def list_matches(
    service: Annotated[WorldCupService, Depends(get_worldcup_service)],
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    source: WorldCupSourceName = "auto",
    status: MatchStatus | None = None,
    team: str | None = None,
    group: str | None = None,
    date: str | None = None,
    round: str | None = None,
    force_refresh: bool = False,
) -> WorldCupDataset:
    try:
        return await service.list_matches(
            year=year,
            source=source,
            status=status,
            team=team,
            group=group,
            date=date,
            round_name=round,
            force_refresh=force_refresh,
        )
    except WorldCupDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/matches/{match_id}", response_model=WorldCupMatch)
async def get_match(
    match_id: str,
    service: Annotated[WorldCupService, Depends(get_worldcup_service)],
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    source: WorldCupSourceName = "auto",
    force_refresh: bool = False,
) -> WorldCupMatch:
    try:
        match = await service.get_match(
            match_id=match_id,
            year=year,
            source=source,
            force_refresh=force_refresh,
        )
    except WorldCupDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if match is None:
        raise HTTPException(status_code=404, detail=f"Match not found: {match_id}")
    return match


@router.post("/refresh", response_model=WorldCupSourceInfo)
async def refresh_worldcup_data(
    service: Annotated[WorldCupService, Depends(get_worldcup_service)],
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    source: WorldCupSourceName = "auto",
) -> WorldCupSourceInfo:
    try:
        dataset = await service.get_dataset(year=year, source=source, force_refresh=True)
    except WorldCupDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return dataset.source

