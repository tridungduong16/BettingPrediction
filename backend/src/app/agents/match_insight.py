from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, Field

from app.agents.base import AgentConfig, BasePydanticAgent
from app.agents.model_adapters import resolve_pydantic_model
from app.agents.prompts import load_match_insight_prompt
from app.core.app_config import app_config
from app.models.live_events import LiveMatchSnapshot
from app.models.market_prediction import MatchInsightAgentOutput
from app.models.worldcup import WorldCupMatch

logger = logging.getLogger("uvicorn.error")


class MatchInsightAgentContext(BaseModel):
    match: dict[str, Any] = Field(default_factory=dict)
    live_snapshot: dict[str, Any] | None = None
    prediction_context: dict[str, Any] = Field(default_factory=dict)


class FutboliaMatchInsightAgent(BasePydanticAgent[None, MatchInsightAgentOutput]):
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
            system_prompt=system_prompt or load_match_insight_prompt(),
            output_type=MatchInsightAgentOutput,
        )
        super().__init__(config=config, tools=tools or [])

    async def predict_insight(
        self,
        *,
        match: WorldCupMatch | dict[str, Any],
        live_snapshot: LiveMatchSnapshot | dict[str, Any] | None = None,
        prediction_context: dict[str, Any] | None = None,
    ) -> MatchInsightAgentOutput:
        context = MatchInsightAgentContext(
            match=self._dump_model(match),
            live_snapshot=self._dump_model(live_snapshot) if live_snapshot is not None else None,
            prediction_context=prediction_context or {},
        )
        logger.info(
            "Match insight LLM context:\n%s",
            self._to_pretty_json(context.model_dump(mode="json", exclude_none=True)),
        )

        output = await self.run(self._build_prompt(context), persist_message_history=False)
        logger.info(
            "Match insight LLM output:\n%s",
            self._to_pretty_json(output.model_dump(mode="json", exclude_none=True)),
        )
        return output

    @staticmethod
    def _dump_model(value: BaseModel | dict[str, Any]) -> dict[str, Any]:
        if isinstance(value, BaseModel):
            return value.model_dump(mode="json", exclude_none=True)
        return value

    @staticmethod
    def _build_prompt(context: MatchInsightAgentContext) -> str:
        context_json = json.dumps(
            context.model_dump(mode="json", exclude_none=True),
            ensure_ascii=False,
            indent=2,
        )
        return (
            "Hãy tạo dự đoán tổng quan cho trận đấu dựa trên context sau.\n"
            "Trả về đúng schema structured output: winner, confidence, status, summary, "
            "outcomes, reasoning, edge_signals và net_edge.\n\n"
            f"```json\n{context_json}\n```"
        )

    @staticmethod
    def _to_pretty_json(value: Any) -> str:
        return json.dumps(value, ensure_ascii=False, indent=2, default=str)
