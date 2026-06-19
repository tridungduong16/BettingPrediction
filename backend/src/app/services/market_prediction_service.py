from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

from app.agents.base import StreamEvent
from app.agents.market_prediction import FutboliaMarketPredictionAgent
from app.agents.match_insight import FutboliaMatchInsightAgent
from app.agents.prediction_chat import FutboliaPredictionAgent
from app.core.app_config import WorldCupSourceName
from app.models.chat import PredictionChatResponse
from app.models.live_events import LiveMatchSnapshot
from app.models.market_prediction import (
    MarketPredictionAgentOutput,
    MarketPredictionCandidate,
    MarketPredictionResponse,
    MatchInsightAgentOutput,
    MatchInsightResponse,
    PredictionMode,
    ResponseLanguage,
)
from app.models.worldcup import WorldCupMatch
from app.services.live_event_service import LiveEventService
from app.services.match_context_service import MatchContextService
from app.services.news_search_service import NewsSearchService
from app.services.prediction_cache import PredictionCacheBackend, PredictionCacheError
from app.services.worldcup_service import WorldCupService

logger = logging.getLogger(__name__)


class MarketPredictionUnavailableError(RuntimeError):
    """Raised when an LLM market prediction cannot be produced."""


class MarketPredictionMatchNotFoundError(RuntimeError):
    """Raised when the requested match cannot be found."""


class MarketPredictionService:
    def __init__(
        self,
        *,
        worldcup_service: WorldCupService,
        live_event_service: LiveEventService,
        match_context_service: MatchContextService | None = None,
        news_search_service: NewsSearchService | None = None,
        prediction_cache: PredictionCacheBackend | None = None,
        prediction_cache_ttl_seconds: int = 0,
        prediction_cache_version: str = "v1",
        agent: Any | None = None,
        insight_agent: Any | None = None,
        chat_agent: Any | None = None,
    ) -> None:
        self._worldcup_service = worldcup_service
        self._live_event_service = live_event_service
        self._match_context_service = match_context_service or MatchContextService()
        self._news_search_service = news_search_service
        self._prediction_cache = prediction_cache
        self._prediction_cache_ttl_seconds = prediction_cache_ttl_seconds
        self._prediction_cache_version = prediction_cache_version
        self._market_agent = agent or FutboliaMarketPredictionAgent()
        self._insight_agent = insight_agent or FutboliaMatchInsightAgent()
        self._chat_agent = chat_agent or FutboliaPredictionAgent()

    async def predict_match_markets(
        self,
        *,
        match_id: str,
        year: int | None = None,
        source: WorldCupSourceName = "auto",
        provider_fixture_id: str | None = None,
        force_refresh: bool = False,
        include_live: bool = True,
        include_news: bool = True,
        language: ResponseLanguage = "vi",
        news_max_results: int | None = None,
        prediction_mode: PredictionMode = "pre_match",
        prediction_context: dict[str, Any] | None = None,
    ) -> MarketPredictionResponse:
        cache_key = self._prediction_cache_key(
            kind="markets",
            match_id=match_id,
            year=year,
            source=source,
            provider_fixture_id=provider_fixture_id,
            include_live=include_live,
            include_news=include_news,
            language=language,
            news_max_results=news_max_results,
            prediction_mode=prediction_mode,
            prediction_context=prediction_context,
            model_name=getattr(self._market_agent, "model_name", None),
        )
        if not force_refresh and self._can_cache_prediction(prediction_mode):
            cached = await self._read_cached_response(cache_key, MarketPredictionResponse)
            if cached is not None:
                return cached

        match = await self._worldcup_service.get_match(
            match_id=match_id,
            year=year,
            source=source,
            force_refresh=force_refresh,
        )
        if match is None:
            raise MarketPredictionMatchNotFoundError(f"Match not found: {match_id}")

        live_snapshot = await self._get_live_snapshot(
            match_id=match_id,
            provider_fixture_id=provider_fixture_id,
            force_refresh=force_refresh,
            include_live=include_live,
        )
        news_context = await self._get_news_context(
            match=match,
            include_news=include_news,
            force_refresh=force_refresh,
            max_results=news_max_results,
        )
        markets = default_market_candidates(match, language=language)
        llm_context = self._match_context_service.build_market_prediction_context(
            match=match,
            live_snapshot=live_snapshot,
            prediction_mode=prediction_mode,
            language=language,
            news_context=news_context,
            user_context=prediction_context,
        )
        agent_prediction_context = {
            key: value for key, value in llm_context.items() if key not in {"match", "live"}
        }

        try:
            output: MarketPredictionAgentOutput = await self._market_agent.predict_markets(
                match=llm_context["match"],
                live_snapshot=llm_context["live"],
                markets=markets,
                prediction_context=agent_prediction_context,
            )
        except Exception as exc:
            raise MarketPredictionUnavailableError(str(exc)) from exc

        self._validate_agent_output(markets, output)
        response = MarketPredictionResponse(
            match_id=match.id,
            generated_at=datetime.now(UTC),
            language=language,
            model_name=getattr(self._market_agent, "model_name", None),
            prediction_mode=prediction_mode,
            match=match,
            live_snapshot=live_snapshot,
            prediction_context=llm_context,
            markets=markets,
            summary=output.summary,
            predictions=output.predictions,
            data_quality_notes=output.data_quality_notes,
        )
        if self._can_cache_prediction(prediction_mode):
            await self._write_cached_response(cache_key, response)
        return response

    async def predict_match_insight(
        self,
        *,
        match_id: str,
        year: int | None = None,
        source: WorldCupSourceName = "auto",
        provider_fixture_id: str | None = None,
        force_refresh: bool = False,
        include_live: bool = True,
        include_news: bool = True,
        language: ResponseLanguage = "vi",
        news_max_results: int | None = None,
        prediction_mode: PredictionMode = "pre_match",
        prediction_context: dict[str, Any] | None = None,
    ) -> MatchInsightResponse:
        cache_key = self._prediction_cache_key(
            kind="insight",
            match_id=match_id,
            year=year,
            source=source,
            provider_fixture_id=provider_fixture_id,
            include_live=include_live,
            include_news=include_news,
            language=language,
            news_max_results=news_max_results,
            prediction_mode=prediction_mode,
            prediction_context=prediction_context,
            model_name=getattr(self._insight_agent, "model_name", None),
        )
        if not force_refresh and self._can_cache_prediction(prediction_mode):
            cached = await self._read_cached_response(cache_key, MatchInsightResponse)
            if cached is not None:
                return cached

        match = await self._worldcup_service.get_match(
            match_id=match_id,
            year=year,
            source=source,
            force_refresh=force_refresh,
        )
        if match is None:
            raise MarketPredictionMatchNotFoundError(f"Match not found: {match_id}")

        live_snapshot = await self._get_live_snapshot(
            match_id=match_id,
            provider_fixture_id=provider_fixture_id,
            force_refresh=force_refresh,
            include_live=include_live,
        )
        news_context = await self._get_news_context(
            match=match,
            include_news=include_news,
            force_refresh=force_refresh,
            max_results=news_max_results,
        )
        llm_context = self._match_context_service.build_market_prediction_context(
            match=match,
            live_snapshot=live_snapshot,
            prediction_mode=prediction_mode,
            language=language,
            news_context=news_context,
            user_context=prediction_context,
        )
        agent_prediction_context = {
            key: value for key, value in llm_context.items() if key not in {"match", "live"}
        }

        try:
            output: MatchInsightAgentOutput = await self._insight_agent.predict_insight(
                match=llm_context["match"],
                live_snapshot=llm_context["live"],
                prediction_context=agent_prediction_context,
            )
        except Exception as exc:
            raise MarketPredictionUnavailableError(str(exc)) from exc

        self._validate_insight_output(output)
        response = MatchInsightResponse(
            match_id=match.id,
            generated_at=datetime.now(UTC),
            language=language,
            model_name=getattr(self._insight_agent, "model_name", None),
            prediction_mode=prediction_mode,
            match=match,
            live_snapshot=live_snapshot,
            prediction_context=llm_context,
            insight=output,
        )
        if self._can_cache_prediction(prediction_mode):
            await self._write_cached_response(cache_key, response)
        return response

    async def answer_match_chat(
        self,
        *,
        match_id: str,
        message: str,
        year: int | None = None,
        source: WorldCupSourceName = "auto",
        provider_fixture_id: str | None = None,
        force_refresh: bool = False,
        include_live: bool = True,
        include_news: bool = True,
        language: ResponseLanguage = "vi",
        news_max_results: int | None = None,
        prediction_mode: PredictionMode = "pre_match",
        thread_id: str | None = None,
        prediction_context: dict[str, Any] | None = None,
    ) -> PredictionChatResponse:
        match, live_snapshot, llm_context, agent_prediction_context = (
            await self._build_chat_agent_context(
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
                prediction_context=prediction_context,
            )
        )

        try:
            answer = await self._chat_agent.answer_with_context(
                message,
                match=llm_context["match"],
                live_snapshot=llm_context["live"],
                prediction_context=agent_prediction_context,
                thread_id=thread_id,
            )
        except Exception as exc:
            raise MarketPredictionUnavailableError(str(exc)) from exc

        return PredictionChatResponse(
            match_id=match.id,
            generated_at=datetime.now(UTC),
            language=language,
            model_name=getattr(self._chat_agent, "model_name", None),
            prediction_mode=prediction_mode,
            thread_id=thread_id,
            message=message,
            answer=answer,
            match=match,
            live_snapshot=live_snapshot,
            prediction_context=llm_context,
        )

    async def stream_match_chat_events(
        self,
        *,
        match_id: str,
        message: str,
        year: int | None = None,
        source: WorldCupSourceName = "auto",
        provider_fixture_id: str | None = None,
        force_refresh: bool = False,
        include_live: bool = True,
        include_news: bool = True,
        language: ResponseLanguage = "vi",
        news_max_results: int | None = None,
        prediction_mode: PredictionMode = "pre_match",
        thread_id: str | None = None,
        prediction_context: dict[str, Any] | None = None,
    ) -> AsyncIterator[StreamEvent]:
        match, live_snapshot, llm_context, agent_prediction_context = (
            await self._build_chat_agent_context(
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
                prediction_context=prediction_context,
            )
        )

        async def events() -> AsyncIterator[StreamEvent]:
            yield StreamEvent(
                type="metadata",
                content={
                    "generated_at": datetime.now(UTC).isoformat(),
                    "language": language,
                    "live_provider_status": (
                        live_snapshot.provider_status if live_snapshot else None
                    ),
                    "match_id": match.id,
                    "model_name": getattr(self._chat_agent, "model_name", None),
                    "prediction_mode": prediction_mode,
                    "thread_id": thread_id,
                },
            )

            try:
                async for event in self._chat_agent.stream_answer_with_context(
                    message,
                    match=llm_context["match"],
                    live_snapshot=llm_context["live"],
                    prediction_context=agent_prediction_context,
                    thread_id=thread_id,
                ):
                    yield event
            except Exception as exc:
                yield StreamEvent(type="error", content=str(exc))

        return events()

    def _can_cache_prediction(self, prediction_mode: PredictionMode) -> bool:
        return (
            self._prediction_cache is not None
            and self._prediction_cache_ttl_seconds > 0
            and prediction_mode == "pre_match"
        )

    def _prediction_cache_key(
        self,
        *,
        kind: str,
        match_id: str,
        year: int | None,
        source: WorldCupSourceName,
        provider_fixture_id: str | None,
        include_live: bool,
        include_news: bool,
        language: ResponseLanguage,
        news_max_results: int | None,
        prediction_mode: PredictionMode,
        prediction_context: dict[str, Any] | None,
        model_name: str | None,
    ) -> str:
        payload = {
            "include_live": include_live,
            "include_news": include_news,
            "kind": kind,
            "language": language,
            "match_id": match_id,
            "model_name": model_name,
            "news_max_results": news_max_results,
            "prediction_context": prediction_context or {},
            "prediction_mode": prediction_mode,
            "provider_fixture_id": provider_fixture_id,
            "source": source,
            "version": self._prediction_cache_version,
            "year": year,
        }
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
        digest = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
        return f"prediction:{kind}:{match_id}:{language}:{prediction_mode}:{digest}"

    async def _read_cached_response(
        self,
        key: str,
        response_model: type[MarketPredictionResponse] | type[MatchInsightResponse],
    ) -> MarketPredictionResponse | MatchInsightResponse | None:
        if self._prediction_cache is None:
            return None

        try:
            payload = await self._prediction_cache.get_json(key)
        except (PredictionCacheError, json.JSONDecodeError) as exc:
            logger.warning("Prediction cache read failed for %s: %s", key, exc)
            return None

        if payload is None:
            return None

        try:
            return response_model.model_validate(payload)
        except Exception as exc:
            logger.warning("Prediction cache payload is invalid for %s: %s", key, exc)
            return None

    async def _write_cached_response(
        self,
        key: str,
        response: MarketPredictionResponse | MatchInsightResponse,
    ) -> None:
        if self._prediction_cache is None:
            return

        try:
            await self._prediction_cache.set_json(
                key,
                response.model_dump(mode="json"),
                self._prediction_cache_ttl_seconds,
            )
        except PredictionCacheError as exc:
            logger.warning("Prediction cache write failed for %s: %s", key, exc)

    async def _get_live_snapshot(
        self,
        *,
        match_id: str,
        provider_fixture_id: str | None,
        force_refresh: bool,
        include_live: bool,
    ) -> LiveMatchSnapshot | None:
        if not include_live:
            return None
        return await self._live_event_service.get_snapshot(
            match_id=match_id,
            provider_fixture_id=provider_fixture_id,
            force_refresh=force_refresh,
        )

    async def _get_news_context(
        self,
        *,
        match: WorldCupMatch,
        include_news: bool,
        force_refresh: bool,
        max_results: int | None,
    ) -> dict[str, Any] | None:
        if not include_news or self._news_search_service is None:
            return None

        response = await self._news_search_service.search_match_news(
            home_team=match.team1,
            away_team=match.team2,
            max_results=max_results,
            force_refresh=force_refresh,
        )
        return response.model_dump(mode="json", exclude_none=True)

    async def _build_chat_agent_context(
        self,
        *,
        match_id: str,
        year: int | None,
        source: WorldCupSourceName,
        provider_fixture_id: str | None,
        force_refresh: bool,
        include_live: bool,
        include_news: bool,
        language: ResponseLanguage,
        news_max_results: int | None,
        prediction_mode: PredictionMode,
        prediction_context: dict[str, Any] | None,
    ) -> tuple[WorldCupMatch, LiveMatchSnapshot | None, dict[str, Any], dict[str, Any]]:
        match = await self._worldcup_service.get_match(
            match_id=match_id,
            year=year,
            source=source,
            force_refresh=force_refresh,
        )
        if match is None:
            raise MarketPredictionMatchNotFoundError(f"Match not found: {match_id}")

        live_snapshot = await self._get_live_snapshot(
            match_id=match_id,
            provider_fixture_id=provider_fixture_id,
            force_refresh=force_refresh,
            include_live=include_live,
        )
        news_context = await self._get_news_context(
            match=match,
            include_news=include_news,
            force_refresh=force_refresh,
            max_results=news_max_results,
        )
        llm_context = self._match_context_service.build_market_prediction_context(
            match=match,
            live_snapshot=live_snapshot,
            prediction_mode=prediction_mode,
            language=language,
            news_context=news_context,
            user_context=prediction_context,
        )
        agent_prediction_context = {
            key: value for key, value in llm_context.items() if key not in {"match", "live"}
        }
        return match, live_snapshot, llm_context, agent_prediction_context

    @staticmethod
    def _validate_agent_output(
        markets: list[MarketPredictionCandidate],
        output: MarketPredictionAgentOutput,
    ) -> None:
        expected_ids = {market.id for market in markets}
        actual_ids = {prediction.id for prediction in output.predictions}
        missing_ids = expected_ids - actual_ids
        unknown_ids = actual_ids - expected_ids

        if missing_ids or unknown_ids:
            problems: list[str] = []
            if missing_ids:
                problems.append(f"missing market ids: {', '.join(sorted(missing_ids))}")
            if unknown_ids:
                problems.append(f"unknown market ids: {', '.join(sorted(unknown_ids))}")
            raise MarketPredictionUnavailableError(
                "Invalid LLM market output; " + "; ".join(problems)
            )

    @staticmethod
    def _validate_insight_output(output: MatchInsightAgentOutput) -> None:
        expected_ids = {"home", "draw", "away"}
        actual_ids = {outcome.id for outcome in output.outcomes}
        if actual_ids != expected_ids:
            raise MarketPredictionUnavailableError(
                "Invalid LLM insight output; expected outcomes: home, draw, away"
            )


def default_market_candidates(
    match: WorldCupMatch,
    *,
    language: ResponseLanguage = "vi",
) -> list[MarketPredictionCandidate]:
    home = match.team1
    away = match.team2

    if language == "en":
        return [
            MarketPredictionCandidate(
                id="asian-handicap",
                family="asian_handicap",
                name=f"Asian Handicap: {home} -1.0",
                line="-1.0",
                description=(
                    "Common Asian handicap market. Pick the favorite to cover or the "
                    "underdog to stay within the handicap."
                ),
                candidate_outcomes=[
                    f"{home} -1.0 covers",
                    f"{away} +1.0 covers",
                    "Push",
                ],
            ),
            MarketPredictionCandidate(
                id="over-under",
                family="over_under",
                name="Over/Under: Over 2.5 goals",
                line="2.5",
                description="Total match goals compared with the 2.5 line.",
                candidate_outcomes=["Over 2.5 goals", "Under 2.5 goals"],
            ),
            MarketPredictionCandidate(
                id="one-x-two",
                family="one_x_two",
                name="1X2: Match result",
                description=(
                    "Official 90-minute result: home win, draw, or away win."
                ),
                candidate_outcomes=[f"{home} win", "Draw", f"{away} win"],
            ),
            MarketPredictionCandidate(
                id="cards",
                family="cards",
                name="Cards: Over 4.5 cards",
                line="4.5",
                description="Total cards in the match compared with the 4.5 line.",
                candidate_outcomes=["Over 4.5 cards", "Under 4.5 cards"],
            ),
            MarketPredictionCandidate(
                id="corners",
                family="corners",
                name="Corners: Over 9.5 corners",
                line="9.5",
                description="Total corners in the match compared with the 9.5 line.",
                candidate_outcomes=["Over 9.5 corners", "Under 9.5 corners"],
            ),
        ]

    return [
        MarketPredictionCandidate(
            id="asian-handicap",
            family="asian_handicap",
            name=f"Kèo Châu Á: {home} -1.0",
            line="-1.0",
            description=(
                "Handicap Asian phổ biến với người dùng Việt. Chọn đội vượt kèo hoặc đội "
                "được chấp giữ kèo."
            ),
            candidate_outcomes=[
                f"{home} -1.0 thắng kèo",
                f"{away} +1.0 thắng kèo",
                "Hòa kèo",
            ],
        ),
        MarketPredictionCandidate(
            id="over-under",
            family="over_under",
            name="Tài/Xỉu: Over 2.5 bàn",
            line="2.5",
            description="Tổng số bàn thắng cả trận so với mốc 2.5.",
            candidate_outcomes=["Over 2.5 bàn", "Under 2.5 bàn"],
        ),
        MarketPredictionCandidate(
            id="one-x-two",
            family="one_x_two",
            name="1X2: Kết quả trận đấu",
            description=(
                "Kết quả chính thức trong 90 phút: đội nhà thắng, hòa, "
                "hoặc đội khách thắng."
            ),
            candidate_outcomes=[f"{home} thắng", "Hòa", f"{away} thắng"],
        ),
        MarketPredictionCandidate(
            id="cards",
            family="cards",
            name="Thẻ phạt: Over 4.5 thẻ",
            line="4.5",
            description="Tổng số thẻ phạt cả trận so với mốc 4.5.",
            candidate_outcomes=["Over 4.5 thẻ", "Under 4.5 thẻ"],
        ),
        MarketPredictionCandidate(
            id="corners",
            family="corners",
            name="Corner: Over 9.5 góc",
            line="9.5",
            description="Tổng số phạt góc cả trận so với mốc 9.5.",
            candidate_outcomes=["Over 9.5 góc", "Under 9.5 góc"],
        ),
    ]
