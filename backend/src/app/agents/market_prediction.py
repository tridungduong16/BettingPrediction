from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, Field

from app.agents.base import AgentConfig, BasePydanticAgent
from app.agents.model_adapters import resolve_pydantic_model
from app.agents.prompts import load_market_prediction_prompt
from app.core.app_config import app_config
from app.models.live_events import LiveMatchSnapshot
from app.models.market_prediction import MarketPredictionAgentOutput, MarketPredictionCandidate
from app.models.worldcup import WorldCupMatch

logger = logging.getLogger("uvicorn.error")


class MarketPredictionAgentContext(BaseModel):
    match: dict[str, Any] = Field(default_factory=dict)
    live_snapshot: dict[str, Any] | None = None
    markets: list[dict[str, Any]] = Field(default_factory=list)
    prediction_context: dict[str, Any] = Field(default_factory=dict)


class FutboliaMarketPredictionAgent(BasePydanticAgent[None, MarketPredictionAgentOutput]):
    def __init__(
        self,
        *,
        system_prompt: str | None = None,
        model_name: str | None = None,
        tools: list | None = None,
    ) -> None:
        self.model_name = model_name or app_config.MODEL_NAME
        config = AgentConfig(
            model=resolve_pydantic_model(self.model_name),
            system_prompt=system_prompt or load_market_prediction_prompt(),
            output_type=MarketPredictionAgentOutput,
        )
        super().__init__(config=config, tools=tools or [])

    async def predict_markets(
        self,
        *,
        match: WorldCupMatch | dict[str, Any],
        markets: list[MarketPredictionCandidate],
        live_snapshot: LiveMatchSnapshot | dict[str, Any] | None = None,
        prediction_context: dict[str, Any] | None = None,
    ) -> MarketPredictionAgentOutput:
        context = MarketPredictionAgentContext(
            match=self._dump_model(match),
            live_snapshot=self._dump_model(live_snapshot) if live_snapshot is not None else None,
            markets=[market.model_dump(mode="json") for market in markets],
            prediction_context=prediction_context or {},
        )
        logger.info(
            "Market prediction LLM context:\n%s",
            self._to_pretty_json(context.model_dump(mode="json", exclude_none=True)),
        )

        output = await self.run(self._build_prompt(context), persist_message_history=False)
        logger.info(
            "Market prediction LLM output:\n%s",
            self._to_pretty_json(output.model_dump(mode="json", exclude_none=True)),
        )
        return output

    @staticmethod
    def _dump_model(value: BaseModel | dict[str, Any]) -> dict[str, Any]:
        if isinstance(value, BaseModel):
            return value.model_dump(mode="json", exclude_none=True)
        return value

    @staticmethod
    def _build_prompt(context: MarketPredictionAgentContext) -> str:
        context_json = json.dumps(
            context.model_dump(mode="json", exclude_none=True),
            ensure_ascii=False,
            indent=2,
        )
        if context.prediction_context.get("language") == "en":
            return (
                "Predict the provided football markets from the context below.\n"
                "Return exactly one prediction for each item in `markets`, preserving id, "
                "family, name and line. Include probability, confidence, confidence_score, "
                "confidence_rationale, risk, detailed reasoning and 2-4 evidence drivers for "
                "every prediction.\n\n"
                f"```json\n{context_json}\n```"
            )

        return (
            "Hãy dự đoán các kèo bóng đá được cung cấp dựa trên dữ liệu sau.\n"
            "Trả về đúng một dự đoán cho mỗi item trong `markets`, giữ nguyên id, family, "
            "name và line. Mỗi prediction phải có probability, confidence, confidence_score, "
            "confidence_rationale, risk, reasoning chi tiết và 2-4 drivers dựa trên evidence.\n\n"
            f"```json\n{context_json}\n```"
        )

    @staticmethod
    def _to_pretty_json(value: Any) -> str:
        return json.dumps(value, ensure_ascii=False, indent=2, default=str)
