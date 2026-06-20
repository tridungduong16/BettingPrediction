from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.app_config import WorldCupSourceName
from app.dependencies import get_odds_service
from app.models.odds import MatchOddsResponse, OddsListResponse, OddsSportsResponse
from app.services.odds_service import OddsMatchNotFoundError, OddsService
from app.services.worldcup_service import WorldCupDataUnavailableError

router = APIRouter()


@router.get("/sports", response_model=OddsSportsResponse)
async def list_odds_sports(
    service: Annotated[OddsService, Depends(get_odds_service)],
    all_sports: bool = False,
    force_refresh: bool = False,
) -> OddsSportsResponse:
    return await service.list_sports(
        all_sports=all_sports,
        force_refresh=force_refresh,
    )


@router.get("/sports/{sport}/odds", response_model=OddsListResponse)
async def list_sport_odds(
    sport: str,
    service: Annotated[OddsService, Depends(get_odds_service)],
    regions: str | None = None,
    markets: str | None = None,
    odds_format: str | None = None,
    bookmakers: str | None = None,
    event_ids: str | None = None,
    commence_time_from: datetime | None = None,
    commence_time_to: datetime | None = None,
    force_refresh: bool = False,
) -> OddsListResponse:
    return await service.list_odds(
        sport=sport,
        regions=_split_csv(regions),
        markets=_split_csv(markets),
        odds_format=odds_format,
        bookmakers=_split_csv(bookmakers),
        event_ids=_split_csv(event_ids),
        commence_time_from=commence_time_from,
        commence_time_to=commence_time_to,
        force_refresh=force_refresh,
    )


@router.get("/matches/{match_id}", response_model=MatchOddsResponse)
async def get_match_odds(
    match_id: str,
    service: Annotated[OddsService, Depends(get_odds_service)],
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    source: WorldCupSourceName = "auto",
    sport: str | None = None,
    regions: str | None = None,
    markets: str | None = None,
    odds_format: str | None = None,
    force_refresh: bool = False,
) -> MatchOddsResponse:
    try:
        return await service.get_match_odds(
            match_id=match_id,
            year=year,
            source=source,
            sport=sport,
            regions=_split_csv(regions),
            markets=_split_csv(markets),
            odds_format=odds_format,
            force_refresh=force_refresh,
        )
    except OddsMatchNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except WorldCupDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _split_csv(value: str | None) -> list[str] | None:
    if value is None:
        return None
    values = [item.strip() for item in value.split(",") if item.strip()]
    return values or None
