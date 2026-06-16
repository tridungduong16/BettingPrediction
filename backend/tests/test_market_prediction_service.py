from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.models.live_events import (
    LiveMatchClock,
    LiveMatchEvent,
    LiveMatchScore,
    LiveMatchSnapshot,
    LiveTeam,
)
from app.models.market_prediction import MarketPrediction, MarketPredictionAgentOutput
from app.models.news import MatchNewsSearchResponse, NewsSearchResult
from app.models.worldcup import Goal, Score, WorldCupMatch
from app.services.market_prediction_service import (
    MarketPredictionService,
    default_market_candidates,
)
from app.services.match_context_service import MatchContextService


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


def make_finished_match() -> WorldCupMatch:
    return WorldCupMatch(
        id="2026-001-mexico-vs-south-africa",
        source_index=0,
        competition="World Cup 2026",
        round="Group Stage",
        date="2026-06-11",
        time="20:00 UTC",
        team1="Mexico",
        team2="South Africa",
        group="A",
        ground="Estadio Azteca, Mexico City",
        city="Estadio Azteca",
        status="finished",
        score=Score(ft=(2, 0), ht=(1, 0)),
        goals1=[Goal(name="Player One", minute=12), Goal(name="Player Two", minute=72)],
        goals2=[],
        winner="Mexico",
    )


def make_live_snapshot(match_id: str) -> LiveMatchSnapshot:
    observed_at = datetime.now(UTC)
    return LiveMatchSnapshot(
        match_id=match_id,
        provider="api_football",
        provider_fixture_id="123456",
        provider_status="ready",
        observed_at=observed_at,
        fetched_at=observed_at,
        score=LiveMatchScore(home=1, away=0),
        clock=LiveMatchClock(phase="second_half", elapsed=61, raw_status="2H"),
        events=[
            LiveMatchEvent(
                id="event-1",
                match_id=match_id,
                provider="api_football",
                provider_fixture_id="123456",
                sequence=0,
                type="goal",
                detail="Normal Goal",
                minute=12,
                team=LiveTeam(id="10", name="Mexico", side="home"),
                observed_at=observed_at,
            )
        ],
        raw={
            "fixture": {
                "teams": {
                    "home": {"id": 10, "name": "Mexico"},
                    "away": {"id": 20, "name": "South Africa"},
                }
            },
            "statistics": [
                {
                    "team": {"id": 10, "name": "Mexico"},
                    "statistics": [
                        {"type": "Shots on Goal", "value": 4},
                        {"type": "Corner Kicks", "value": 5},
                        {"type": "Ball Possession", "value": "56%"},
                    ],
                },
                {
                    "team": {"id": 20, "name": "South Africa"},
                    "statistics": [
                        {"type": "Shots on Goal", "value": 1},
                        {"type": "Corner Kicks", "value": 2},
                        {"type": "Ball Possession", "value": "44%"},
                    ],
                },
            ],
        },
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


class FakeNewsSearchService:
    async def search_match_news(
        self,
        *,
        home_team: str,
        away_team: str,
        max_results: int | None = None,
        force_refresh: bool = False,
        recency=None,
    ) -> MatchNewsSearchResponse:
        self.last_kwargs = {
            "home_team": home_team,
            "away_team": away_team,
            "max_results": max_results,
            "force_refresh": force_refresh,
            "recency": recency,
        }
        return MatchNewsSearchResponse(
            provider_status="ready",
            query=f"thông tin trận {home_team} và {away_team}",
            home_team=home_team,
            away_team=away_team,
            generated_at=datetime.now(UTC),
            results=[
                NewsSearchResult(
                    title="Brazil vs France team news",
                    url="https://example.com/brazil-france",
                    snippet="Fixture news and tactical context.",
                    date="2026-07-09",
                )
            ],
            source_id="search-123",
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
    assert response.prediction_mode == "pre_match"
    assert response.prediction_context is not None
    assert response.prediction_context["prediction_mode"] == "pre_match"


@pytest.mark.asyncio
async def test_market_prediction_service_adds_match_news_to_agent_context():
    match = make_match()
    agent = FakeMarketAgent()
    news_service = FakeNewsSearchService()
    service = MarketPredictionService(
        worldcup_service=FakeWorldCupService(match),
        live_event_service=FakeLiveEventService(),
        news_search_service=news_service,
        agent=agent,
    )

    response = await service.predict_match_markets(
        match_id=match.id,
        news_max_results=4,
        force_refresh=True,
    )

    assert news_service.last_kwargs == {
        "home_team": "Brazil",
        "away_team": "France",
        "max_results": 4,
        "force_refresh": True,
        "recency": None,
    }
    assert agent.last_prediction_context["news"]["query"] == "thông tin trận Brazil và France"
    assert agent.last_prediction_context["news"]["results"][0]["title"] == (
        "Brazil vs France team news"
    )
    assert "perplexity_search" in agent.last_prediction_context["data_quality"]["sources"]
    assert response.prediction_context["news"]["source_id"] == "search-123"


@pytest.mark.asyncio
async def test_pre_match_prediction_context_hides_finished_result_from_agent():
    match = make_finished_match()
    agent = FakeMarketAgent()
    service = MarketPredictionService(
        worldcup_service=FakeWorldCupService(match),
        live_event_service=FakeLiveEventService(),
        agent=agent,
    )

    response = await service.predict_match_markets(match_id=match.id)

    assert response.match.score is not None
    assert response.match.score.ft == (2, 0)
    assert response.match.winner == "Mexico"
    assert response.prediction_mode == "pre_match"
    assert response.prediction_context is not None
    assert response.prediction_context["actual_result"] is None

    assert isinstance(agent.last_match, dict)
    assert agent.last_match["home_team"] == "Mexico"
    assert agent.last_match["away_team"] == "South Africa"
    assert agent.last_match["status_for_prediction"] == "scheduled"
    assert "score" not in agent.last_match
    assert "winner" not in agent.last_match
    assert "goals1" not in agent.last_match
    assert "goals2" not in agent.last_match
    assert agent.last_live_snapshot is None


@pytest.mark.asyncio
async def test_post_match_evaluation_context_includes_actual_result():
    match = make_finished_match()
    agent = FakeMarketAgent()
    service = MarketPredictionService(
        worldcup_service=FakeWorldCupService(match),
        live_event_service=FakeLiveEventService(),
        agent=agent,
    )

    response = await service.predict_match_markets(
        match_id=match.id,
        prediction_mode="post_match_evaluation",
    )

    assert response.prediction_mode == "post_match_evaluation"
    assert response.prediction_context is not None
    assert response.prediction_context["actual_result"]["winner"] == "Mexico"
    assert response.prediction_context["actual_result"]["score"]["ft"] == [2, 0]
    assert agent.last_prediction_context["actual_result"]["home_goals"][0]["name"] == "Player One"


def test_live_prediction_context_includes_score_events_and_statistics():
    match = make_finished_match()
    live_snapshot = make_live_snapshot(match.id)
    service = MatchContextService()

    context = service.build_market_prediction_context(
        match=match,
        live_snapshot=live_snapshot,
        prediction_mode="live",
        user_context={"odds_note": "market line sampled before kickoff"},
    )

    assert context["prediction_mode"] == "live"
    assert context["match"]["status_for_prediction"] == "live"
    assert context["actual_result"] is None
    assert context["live"]["score"] == {"home": 1, "away": 0}
    assert context["live"]["clock"]["elapsed"] == 61
    assert context["live"]["events"][0]["type"] == "goal"
    assert context["teams"]["home"]["provider_team_id"] == "10"
    assert context["teams"]["home"]["live_statistics"]["corners"] == 5
    assert context["teams"]["home"]["live_statistics"]["possession_pct"] == 56.0
    assert context["teams"]["away"]["live_statistics"]["shots_on_goal"] == 1
    assert context["user_context"]["odds_note"] == "market line sampled before kickoff"
