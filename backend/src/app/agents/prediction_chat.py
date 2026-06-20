from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from pydantic import BaseModel, Field

from app.agents.base import AgentConfig, BasePydanticAgent, StreamEvent
from app.agents.model_adapters import resolve_pydantic_model
from app.agents.prompts import load_prediction_chat_prompt
from app.agents.search_tools import build_latest_information_search_tool
from app.core.app_config import app_config
from app.models.chat import PredictionChatRecommendedQuestionsOutput
from app.models.live_events import LiveMatchSnapshot
from app.models.worldcup import WorldCupMatch


class PredictionAgentContext(BaseModel):
    match: dict[str, Any] = Field(default_factory=dict)
    live_snapshot: dict[str, Any] | None = None
    prediction_context: dict[str, Any] = Field(default_factory=dict)


class FutboliaRecommendedQuestionsAgent(
    BasePydanticAgent[None, PredictionChatRecommendedQuestionsOutput]
):
    def __init__(
        self,
        *,
        model_name: str | None = None,
        tools: list | None = None,
    ) -> None:
        self.model_name = model_name or app_config.CHAT_MODEL_NAME
        config = AgentConfig(
            model=resolve_pydantic_model(self.model_name),
            output_type=PredictionChatRecommendedQuestionsOutput,
            system_prompt=(
                "You generate concise recommended follow-up questions for a football "
                "match analysis chat. Use only the supplied match context. Return exactly "
                "three natural questions in the requested language."
            ),
        )
        super().__init__(config=config, tools=tools or [])

    async def recommend_questions_with_context(
        self,
        *,
        match: WorldCupMatch | dict[str, Any],
        live_snapshot: LiveMatchSnapshot | dict[str, Any] | None = None,
        prediction_context: dict[str, Any] | None = None,
    ) -> list[str]:
        context = PredictionAgentContext(
            match=FutboliaPredictionAgent._dump_model(match),
            live_snapshot=(
                FutboliaPredictionAgent._dump_model(live_snapshot)
                if live_snapshot is not None
                else None
            ),
            prediction_context=prediction_context or {},
        )
        output = await self.run(
            self._build_prompt(context),
            persist_message_history=False,
        )
        return output.questions

    @staticmethod
    def _build_prompt(context: PredictionAgentContext) -> str:
        context_json = json.dumps(
            context.model_dump(mode="json", exclude_none=True),
            ensure_ascii=False,
            indent=2,
        )
        if context.prediction_context.get("language") == "en":
            return (
                "Generate exactly 3 recommended questions a user could click next in a "
                "match analysis chat.\n"
                "Rules:\n"
                "- Base every question on the supplied match context.\n"
                "- Keep each question under 120 characters.\n"
                "- Cover different angles such as match edge, markets, live/news signals, "
                "risk, or tactical reasons.\n"
                "- Return questions in English.\n\n"
                f"```json\n{context_json}\n```"
            )

        return (
            "Hãy sinh đúng 3 câu hỏi gợi ý để người dùng bấm tiếp trong chat phân tích "
            "trận đấu.\n"
            "Quy tắc:\n"
            "- Mỗi câu hỏi phải dựa trên dữ liệu trận đấu được cung cấp.\n"
            "- Mỗi câu dưới 120 ký tự.\n"
            "- Bao phủ các góc khác nhau như lợi thế trận, kèo, tín hiệu live/tin tức, "
            "rủi ro hoặc chiến thuật.\n"
            "- Trả câu hỏi bằng tiếng Việt tự nhiên.\n\n"
            f"```json\n{context_json}\n```"
        )


class FutboliaPredictionAgent(BasePydanticAgent[None, str]):
    def __init__(
        self,
        *,
        system_prompt: str | None = None,
        model_name: str | None = None,
        tools: list | None = None,
        news_search_service: Any | None = None,
    ) -> None:
        self.model_name = model_name or app_config.CHAT_MODEL_NAME
        agent_tools = list(tools or [])
        if news_search_service is not None:
            agent_tools.append(build_latest_information_search_tool(news_search_service))
        config = AgentConfig(
            model=resolve_pydantic_model(self.model_name),
            system_prompt=system_prompt or load_prediction_chat_prompt(),
        )
        super().__init__(config=config, tools=agent_tools)
        self._recommended_questions_agent = FutboliaRecommendedQuestionsAgent(
            model_name=self.model_name,
        )

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

    async def recommend_questions_with_context(
        self,
        *,
        match: WorldCupMatch | dict[str, Any],
        live_snapshot: LiveMatchSnapshot | dict[str, Any] | None = None,
        prediction_context: dict[str, Any] | None = None,
    ) -> list[str]:
        return await self._recommended_questions_agent.recommend_questions_with_context(
            match=match,
            live_snapshot=live_snapshot,
            prediction_context=prediction_context,
        )

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
            "Dữ liệu trận đấu:\n"
            f"```json\n{context_json}\n```\n\n"
            "Câu hỏi của người dùng:\n"
            f"{question.strip()}"
        )
