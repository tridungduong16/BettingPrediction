from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.models.live_events import LiveMatchClock, LiveMatchScore, LiveMatchSnapshot
from app.models.market_prediction import MarketPrediction, MarketPredictionAgentOutput
from app.models.worldcup import WorldCupMatch
from app.services.market_prediction_service import (
    MarketPredictionService,
    default_market_candidates,
)


def make_match() -> WorldCupMatch:
    return WorldCupMatch(
        id="2026-001-brazil-vs-france",
        source_index=0,
        competition="World Cup 2026",
        round="Quarter Finals",
        date="2026-07-10",
        time="20:00 UTC",
        team1="Brazil",
        team2="France",
        status="scheduled",
    )


class FakeWorldCupService:
    def __init__(self, match: WorldCupMatch | None) -> None:
        self.match = match

    async def get_match(self, **kwargs) -> WorldCupMatch | None:
        self.last_kwargs = kwargs
        return self.match


class FakeLiveEventService:
    async def get_snapshot(self, **kwargs) -> LiveMatchSnapshot:
        self.last_kwargs = kwargs
        return LiveMatchSnapshot(
            match_id=kwargs["match_id"],
            provider="api_football",
            provider_status="not_configured",
            observed_at=datetime.now(UTC),
            score=LiveMatchScore(),
            clock=LiveMatchClock(),
            events=[],
            error="Set API_FOOTBALL_API_KEY to fetch live match events.",
        )


class FakeMarketAgent:
    model_name = "fake-market-model"

    async def predict_markets(self, *, match, live_snapshot, markets, prediction_context=None):
        self.last_match = match
        self.last_live_snapshot = live_snapshot
        self.last_markets = markets
        self.last_prediction_context = prediction_context
        return MarketPredictionAgentOutput(
            summary=(
                "Brazil nhỉnh hơn ở các kèo chính, nhưng thiếu dữ liệu live nên "
                "độ tin cậy vừa phải."
            ),
            predictions=[
                MarketPrediction(
                    id=market.id,
                    family=market.family,
                    name=market.name,
                    line=market.line,
                    selection=market.candidate_outcomes[0],
                    probability=57,
                    confidence="medium",
                    risk="medium",
                    reasoning="Mô hình fake chọn outcome đầu tiên để kiểm tra orchestration.",
                    drivers=["Fixture context available"],
                    data_gaps=["No live provider configured"],
                )
                for market in markets
            ],
            data_quality_notes=["Không có dữ liệu live trong test."],
        )


def test_default_market_candidates_cover_vietnam_priority_markets():
    markets = default_market_candidates(make_match())

    assert [market.id for market in markets] == [
        "asian-handicap",
        "over-under",
        "one-x-two",
        "cards",
        "corners",
    ]
    assert markets[0].name == "Kèo Châu Á: Brazil -1.0"
    assert markets[1].candidate_outcomes == ["Over 2.5 bàn", "Under 2.5 bàn"]
    assert markets[2].candidate_outcomes == ["Brazil thắng", "Hòa", "France thắng"]
    assert markets[3].name == "Thẻ phạt: Over 4.5 thẻ"
    assert markets[4].name == "Corner: Over 9.5 góc"


@pytest.mark.asyncio
async def test_market_prediction_service_returns_structured_predictions():
    match = make_match()
    agent = FakeMarketAgent()
    live_service = FakeLiveEventService()
    service = MarketPredictionService(
        worldcup_service=FakeWorldCupService(match),
        live_event_service=live_service,
        agent=agent,
    )

    response = await service.predict_match_markets(match_id=match.id)

    assert response.match_id == match.id
    assert response.model_name == "fake-market-model"
    assert response.live_snapshot is not None
    assert len(response.markets) == 5
    assert len(response.predictions) == 5
    assert response.predictions[0].selection == "Brazil -1.0 thắng kèo"
    assert response.predictions[2].selection == "Brazil thắng"
