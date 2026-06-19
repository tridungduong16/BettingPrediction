from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.agents.base import StreamEvent
from app.models.live_events import (
    LiveMatchClock,
    LiveMatchEvent,
    LiveMatchScore,
    LiveMatchSnapshot,
    LiveTeam,
)
from app.models.market_prediction import (
    MarketPrediction,
    MarketPredictionAgentOutput,
    MatchInsightAgentOutput,
    MatchInsightEdgeSignal,
    MatchInsightOutcome,
    MatchInsightReasoning,
    MatchInsightReasoningPoint,
)
from app.models.news import MatchNewsSearchResponse, NewsSearchResult
from app.models.worldcup import Goal, Score, WorldCupMatch
from app.services.market_prediction_service import (
    MarketPredictionService,
    default_market_candidates,
)
from app.services.match_context_service import MatchContextService
from app.services.prediction_cache import InMemoryPredictionCache


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
        self.calls = 0

    async def get_match(self, **kwargs) -> WorldCupMatch | None:
        self.calls += 1
        self.last_kwargs = kwargs
        return self.match


class FakeLiveEventService:
    def __init__(self) -> None:
        self.calls = 0

    async def get_snapshot(self, **kwargs) -> LiveMatchSnapshot:
        self.calls += 1
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

    def __init__(self) -> None:
        self.calls = 0

    async def predict_markets(self, *, match, live_snapshot, markets, prediction_context=None):
        self.calls += 1
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
                    confidence_score=64,
                    confidence_rationale=(
                        "Fixture context is available, but live and lineup signals are incomplete."
                    ),
                    risk="medium",
                    reasoning=(
                        "Mô hình fake chọn outcome đầu tiên để kiểm tra orchestration. "
                        "Confidence giữ ở mức vừa vì dữ liệu live và đội hình chưa đầy đủ."
                    ),
                    drivers=["Fixture context available", "Live data incomplete"],
                )
                for market in markets
            ],
            data_quality_notes=["Không có dữ liệu live trong test."],
        )


class FakeNewsSearchService:
    def __init__(self) -> None:
        self.calls = 0

    async def search_match_news(
        self,
        *,
        home_team: str,
        away_team: str,
        max_results: int | None = None,
        force_refresh: bool = False,
        recency=None,
    ) -> MatchNewsSearchResponse:
        self.calls += 1
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


class FakeInsightAgent:
    model_name = "fake-insight-model"

    def __init__(self) -> None:
        self.calls = 0

    async def predict_insight(self, *, match, live_snapshot, prediction_context=None):
        self.calls += 1
        self.last_match = match
        self.last_live_snapshot = live_snapshot
        self.last_prediction_context = prediction_context
        return MatchInsightAgentOutput(
            winner=match["home_team"],
            confidence=7.4,
            confidence_level="medium",
            confidence_rationale=(
                "Fixture and news context are available, but the fake live provider has no events."
            ),
            status="Dự đoán trước trận",
            summary=f"{match['home_team']} nhỉnh hơn trong context test.",
            outcomes=[
                MatchInsightOutcome(
                    id="home",
                    label=match["home_team"],
                    value=57,
                    trend=2.1,
                    direction="up",
                ),
                MatchInsightOutcome(id="draw", label="Hòa", value=23, trend=-0.4, direction="down"),
                MatchInsightOutcome(
                    id="away",
                    label=match["away_team"],
                    value=20,
                    trend=-1.7,
                    direction="down",
                ),
            ],
            reasoning=MatchInsightReasoning(
                headline=f"Lợi thế nghiêng về {match['home_team']}.",
                description="Reasoning tổng quan từ fake agent.",
                points=[
                    MatchInsightReasoningPoint(
                        id="fixture-context",
                        title="Bối cảnh trận",
                        detail="Fixture context available.",
                        impact="high",
                    ),
                    MatchInsightReasoningPoint(
                        id="news-context",
                        title="Bối cảnh tin tức",
                        detail="News context is passed through to the insight agent.",
                        impact="medium",
                    ),
                    MatchInsightReasoningPoint(
                        id="live-gap",
                        title="Dữ liệu live còn thiếu",
                        detail=(
                            "The fake live provider has no events, so confidence stays moderate."
                        ),
                        impact="medium",
                    ),
                ],
            ),
            edge_signals=[
                MatchInsightEdgeSignal(
                    id="fixture-edge",
                    label="Bối cảnh trận",
                    detail="Nguồn lịch thi đấu đã sẵn sàng.",
                    delta="+1.0%",
                    tone="green",
                ),
                MatchInsightEdgeSignal(
                    id="news-edge",
                    label="Tin tức trận đấu",
                    detail="News context is available for the model.",
                    delta="+0.6%",
                    tone="blue",
                ),
                MatchInsightEdgeSignal(
                    id="live-gap",
                    label="Thiếu live events",
                    detail="No fake live event is available in this test.",
                    delta="-0.5%",
                    tone="orange",
                ),
            ],
            net_edge="+2.1%",
        )


class FakeChatAgent:
    model_name = "fake-chat-model"

    def __init__(self) -> None:
        self.answer_calls = 0
        self.stream_calls = 0

    async def answer_with_context(
        self,
        message,
        *,
        match,
        live_snapshot,
        prediction_context=None,
        thread_id=None,
    ):
        self.answer_calls += 1
        self.last_message = message
        self.last_match = match
        self.last_live_snapshot = live_snapshot
        self.last_prediction_context = prediction_context
        self.last_thread_id = thread_id
        return f"Fake answer for {match['home_team']} vs {match['away_team']}: {message}"

    async def stream_answer_with_context(
        self,
        message,
        *,
        match,
        live_snapshot,
        prediction_context=None,
        thread_id=None,
    ):
        self.stream_calls += 1
        self.last_message = message
        self.last_match = match
        self.last_live_snapshot = live_snapshot
        self.last_prediction_context = prediction_context
        self.last_thread_id = thread_id
        yield StreamEvent(type="text_delta", content="Brazil")
        yield StreamEvent(type="text_delta", content=" nhỉnh hơn")
        yield StreamEvent(type="done", content="Brazil nhỉnh hơn")


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


def test_default_market_candidates_support_english():
    markets = default_market_candidates(make_match(), language="en")

    assert markets[0].name == "Asian Handicap: Brazil -1.0"
    assert markets[1].candidate_outcomes == ["Over 2.5 goals", "Under 2.5 goals"]
    assert markets[2].candidate_outcomes == ["Brazil win", "Draw", "France win"]
    assert markets[3].name == "Cards: Over 4.5 cards"
    assert markets[4].name == "Corners: Over 9.5 corners"


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
    assert response.predictions[0].confidence_score == 64
    assert response.predictions[0].confidence_rationale
    assert response.predictions[2].selection == "Brazil thắng"
    assert "data_gaps" not in response.predictions[0].model_dump()
    assert response.language == "vi"
    assert response.prediction_mode == "pre_match"
    assert response.prediction_context is not None
    assert response.prediction_context["language"] == "vi"
    assert response.prediction_context["prediction_mode"] == "pre_match"
    assert agent.last_prediction_context["language"] == "vi"


@pytest.mark.asyncio
async def test_market_prediction_service_caches_market_predictions():
    match = make_match()
    agent = FakeMarketAgent()
    worldcup_service = FakeWorldCupService(match)
    live_service = FakeLiveEventService()
    service = MarketPredictionService(
        worldcup_service=worldcup_service,
        live_event_service=live_service,
        prediction_cache=InMemoryPredictionCache(),
        prediction_cache_ttl_seconds=60,
        agent=agent,
    )

    first = await service.predict_match_markets(match_id=match.id)
    second = await service.predict_match_markets(match_id=match.id)

    assert first.generated_at == second.generated_at
    assert second.predictions[0].selection == "Brazil -1.0 thắng kèo"
    assert agent.calls == 1
    assert worldcup_service.calls == 1
    assert live_service.calls == 1


@pytest.mark.asyncio
async def test_market_prediction_service_force_refresh_bypasses_market_cache():
    match = make_match()
    agent = FakeMarketAgent()
    service = MarketPredictionService(
        worldcup_service=FakeWorldCupService(match),
        live_event_service=FakeLiveEventService(),
        prediction_cache=InMemoryPredictionCache(),
        prediction_cache_ttl_seconds=60,
        agent=agent,
    )

    await service.predict_match_markets(match_id=match.id)
    await service.predict_match_markets(match_id=match.id, force_refresh=True)

    assert agent.calls == 2


@pytest.mark.asyncio
async def test_market_prediction_service_caches_match_insight():
    match = make_match()
    insight_agent = FakeInsightAgent()
    worldcup_service = FakeWorldCupService(match)
    live_service = FakeLiveEventService()
    news_service = FakeNewsSearchService()
    service = MarketPredictionService(
        worldcup_service=worldcup_service,
        live_event_service=live_service,
        news_search_service=news_service,
        insight_agent=insight_agent,
        agent=FakeMarketAgent(),
        prediction_cache=InMemoryPredictionCache(),
        prediction_cache_ttl_seconds=60,
    )

    first = await service.predict_match_insight(match_id=match.id, news_max_results=3)
    second = await service.predict_match_insight(match_id=match.id, news_max_results=3)

    assert first.generated_at == second.generated_at
    assert second.insight.winner == "Brazil"
    assert insight_agent.calls == 1
    assert worldcup_service.calls == 1
    assert live_service.calls == 1
    assert news_service.calls == 1


@pytest.mark.asyncio
async def test_market_prediction_service_does_not_cache_live_predictions():
    match = make_match()
    agent = FakeMarketAgent()
    service = MarketPredictionService(
        worldcup_service=FakeWorldCupService(match),
        live_event_service=FakeLiveEventService(),
        prediction_cache=InMemoryPredictionCache(),
        prediction_cache_ttl_seconds=60,
        agent=agent,
    )

    await service.predict_match_markets(match_id=match.id, prediction_mode="live")
    await service.predict_match_markets(match_id=match.id, prediction_mode="live")

    assert agent.calls == 2


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
async def test_market_prediction_service_passes_english_language_to_agent():
    match = make_match()
    agent = FakeMarketAgent()
    service = MarketPredictionService(
        worldcup_service=FakeWorldCupService(match),
        live_event_service=FakeLiveEventService(),
        agent=agent,
    )

    response = await service.predict_match_markets(match_id=match.id, language="en")

    assert response.language == "en"
    assert response.prediction_context is not None
    assert response.prediction_context["language"] == "en"
    assert response.markets[0].name == "Asian Handicap: Brazil -1.0"
    assert response.predictions[0].selection == "Brazil -1.0 covers"
    assert response.predictions[2].selection == "Brazil win"
    assert agent.last_prediction_context["language"] == "en"


@pytest.mark.asyncio
async def test_market_prediction_service_returns_separate_match_insight():
    match = make_match()
    insight_agent = FakeInsightAgent()
    news_service = FakeNewsSearchService()
    service = MarketPredictionService(
        worldcup_service=FakeWorldCupService(match),
        live_event_service=FakeLiveEventService(),
        news_search_service=news_service,
        insight_agent=insight_agent,
        agent=FakeMarketAgent(),
    )

    response = await service.predict_match_insight(
        match_id=match.id,
        news_max_results=3,
        force_refresh=True,
    )

    assert response.model_name == "fake-insight-model"
    assert response.language == "vi"
    assert response.insight.winner == "Brazil"
    assert response.insight.confidence_level == "medium"
    assert response.insight.confidence_rationale
    assert response.insight.outcomes[0].id == "home"
    assert response.insight.outcomes[0].value == 57
    assert len(response.insight.reasoning.points) == 3
    assert response.insight.reasoning.points[0].impact == "high"
    assert len(response.insight.edge_signals) == 3
    assert response.insight.edge_signals[0].delta == "+1.0%"
    assert insight_agent.last_prediction_context["news"]["query"] == (
        "thông tin trận Brazil và France"
    )
    assert news_service.last_kwargs["max_results"] == 3


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
    assert context["language"] == "vi"
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


@pytest.mark.asyncio
async def test_market_prediction_service_answers_match_chat_with_context():
    match = make_match()
    chat_agent = FakeChatAgent()
    news_service = FakeNewsSearchService()
    service = MarketPredictionService(
        worldcup_service=FakeWorldCupService(match),
        live_event_service=FakeLiveEventService(),
        news_search_service=news_service,
        agent=FakeMarketAgent(),
        chat_agent=chat_agent,
    )

    response = await service.answer_match_chat(
        match_id=match.id,
        message="Explain the edge",
        language="en",
        news_max_results=2,
        thread_id="thread-1",
        prediction_context={"risk_appetite": "low"},
    )

    assert response.match_id == match.id
    assert response.model_name == "fake-chat-model"
    assert response.thread_id == "thread-1"
    assert response.answer == "Fake answer for Brazil vs France: Explain the edge"
    assert chat_agent.answer_calls == 1
    assert chat_agent.last_message == "Explain the edge"
    assert chat_agent.last_thread_id == "thread-1"
    assert chat_agent.last_match["home_team"] == "Brazil"
    assert chat_agent.last_match["away_team"] == "France"
    assert chat_agent.last_match["status_for_prediction"] == "scheduled"
    assert chat_agent.last_live_snapshot is None
    assert chat_agent.last_prediction_context["language"] == "en"
    assert chat_agent.last_prediction_context["news"]["source_id"] == "search-123"
    assert chat_agent.last_prediction_context["user_context"] == {"risk_appetite": "low"}
    assert response.prediction_context["news"]["query"] == "thông tin trận Brazil và France"


@pytest.mark.asyncio
async def test_market_prediction_service_streams_match_chat_events():
    match = make_match()
    chat_agent = FakeChatAgent()
    service = MarketPredictionService(
        worldcup_service=FakeWorldCupService(match),
        live_event_service=FakeLiveEventService(),
        agent=FakeMarketAgent(),
        chat_agent=chat_agent,
    )

    stream = await service.stream_match_chat_events(
        match_id=match.id,
        message="Có nên chọn Brazil?",
        thread_id="thread-stream",
    )
    events = [event async for event in stream]

    assert [event.type for event in events] == ["metadata", "text_delta", "text_delta", "done"]
    assert events[0].content["match_id"] == match.id
    assert events[0].content["model_name"] == "fake-chat-model"
    assert events[0].content["thread_id"] == "thread-stream"
    assert "".join(event.content for event in events if event.type == "text_delta") == (
        "Brazil nhỉnh hơn"
    )
    assert events[-1].content == "Brazil nhỉnh hơn"
    assert chat_agent.stream_calls == 1
    assert chat_agent.last_thread_id == "thread-stream"
