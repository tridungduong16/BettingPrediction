from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.agents.market_prediction import FutboliaMarketPredictionAgent
from app.core.app_config import WorldCupSourceName
from app.models.live_events import LiveMatchSnapshot
from app.models.market_prediction import (
    MarketPredictionAgentOutput,
    MarketPredictionCandidate,
    MarketPredictionResponse,
    PredictionMode,
)
from app.models.worldcup import WorldCupMatch
from app.services.live_event_service import LiveEventService
from app.services.match_context_service import MatchContextService
from app.services.worldcup_service import WorldCupService


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
        agent: Any | None = None,
    ) -> None:
        self._worldcup_service = worldcup_service
        self._live_event_service = live_event_service
        self._match_context_service = match_context_service or MatchContextService()
        self._agent = agent or FutboliaMarketPredictionAgent()

    async def predict_match_markets(
        self,
        *,
        match_id: str,
        year: int | None = None,
        source: WorldCupSourceName = "auto",
        provider_fixture_id: str | None = None,
        force_refresh: bool = False,
        include_live: bool = True,
        prediction_mode: PredictionMode = "pre_match",
        prediction_context: dict[str, Any] | None = None,
    ) -> MarketPredictionResponse:
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
        markets = default_market_candidates(match)
        llm_context = self._match_context_service.build_market_prediction_context(
            match=match,
            live_snapshot=live_snapshot,
            prediction_mode=prediction_mode,
            user_context=prediction_context,
        )
        agent_prediction_context = {
            key: value for key, value in llm_context.items() if key not in {"match", "live"}
        }

        try:
            output: MarketPredictionAgentOutput = await self._agent.predict_markets(
                match=llm_context["match"],
                live_snapshot=llm_context["live"],
                markets=markets,
                prediction_context=agent_prediction_context,
            )
        except Exception as exc:
            raise MarketPredictionUnavailableError(str(exc)) from exc

        self._validate_agent_output(markets, output)
        return MarketPredictionResponse(
            match_id=match.id,
            generated_at=datetime.now(UTC),
            model_name=getattr(self._agent, "model_name", None),
            prediction_mode=prediction_mode,
            match=match,
            live_snapshot=live_snapshot,
            prediction_context=llm_context,
            markets=markets,
            summary=output.summary,
            predictions=output.predictions,
            data_quality_notes=output.data_quality_notes,
        )

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


def default_market_candidates(match: WorldCupMatch) -> list[MarketPredictionCandidate]:
    home = match.team1
    away = match.team2

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
