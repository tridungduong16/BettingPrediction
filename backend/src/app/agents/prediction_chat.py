from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from pydantic import BaseModel, Field

from app.agents.base import AgentConfig, BasePydanticAgent, StreamEvent
from app.agents.model_adapters import resolve_pydantic_model
from app.agents.prompts import load_prediction_chat_prompt
from app.core.app_config import app_config
from app.models.live_events import LiveMatchSnapshot
from app.models.worldcup import WorldCupMatch


class PredictionAgentContext(BaseModel):
    match: dict[str, Any] = Field(default_factory=dict)
    live_snapshot: dict[str, Any] | None = None
    prediction_context: dict[str, Any] = Field(default_factory=dict)


class FutboliaPredictionAgent(BasePydanticAgent[None, str]):
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
            system_prompt=system_prompt or load_prediction_chat_prompt(),
        )
        super().__init__(config=config, tools=tools or [])

    async def answer_with_context(
        self,
        question: str,
        *,
        match: WorldCupMatch | dict[str, Any],
        live_snapshot: LiveMatchSnapshot | dict[str, Any] | None = None,
        prediction_context: dict[str, Any] | None = None,
        thread_id: str | None = None,
    ) -> str:
        context = PredictionAgentContext(
            match=self._dump_model(match),
            live_snapshot=self._dump_model(live_snapshot) if live_snapshot is not None else None,
            prediction_context=prediction_context or {},
        )
        prompt = self._build_prompt(question=question, context=context)
        return await self.run(prompt, thread_id_for_history=thread_id)

    async def stream_answer_with_context(
        self,
        question: str,
        *,
        match: WorldCupMatch | dict[str, Any],
        live_snapshot: LiveMatchSnapshot | dict[str, Any] | None = None,
        prediction_context: dict[str, Any] | None = None,
        thread_id: str | None = None,
    ) -> AsyncIterator[StreamEvent]:
        context = PredictionAgentContext(
            match=self._dump_model(match),
            live_snapshot=self._dump_model(live_snapshot) if live_snapshot is not None else None,
            prediction_context=prediction_context or {},
        )
        prompt = self._build_prompt(question=question, context=context)
        async for event in self.stream_events(prompt, thread_id_for_history=thread_id):
            yield event

    @staticmethod
    def _dump_model(value: BaseModel | dict[str, Any]) -> dict[str, Any]:
        if isinstance(value, BaseModel):
            return value.model_dump(mode="json", exclude_none=True)
        return value

    @staticmethod
    def _build_prompt(question: str, context: PredictionAgentContext) -> str:
        context_json = json.dumps(
            context.model_dump(mode="json", exclude_none=True),
            ensure_ascii=False,
            indent=2,
        )
        if context.prediction_context.get("language") == "en":
            return (
                "Match context:\n"
                f"```json\n{context_json}\n```\n\n"
                "User question:\n"
                f"{question.strip()}"
            )

        return (
            "Context trận đấu:\n"
            f"```json\n{context_json}\n```\n\n"
            "Câu hỏi của người dùng:\n"
            f"{question.strip()}"
        )
