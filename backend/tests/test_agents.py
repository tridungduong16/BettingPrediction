from __future__ import annotations

import importlib
import logging
from datetime import UTC, datetime

import pytest

from app.agents import model_adapters
from app.agents import prediction_chat as prediction_chat_module
from app.agents.market_prediction import FutboliaMarketPredictionAgent
from app.agents.model_adapters import normalize_bifrost_model_name
from app.agents.prediction_chat import (
    FutboliaPredictionAgent,
    FutboliaRecommendedQuestionsAgent,
    PredictionAgentContext,
)
from app.agents.prompts import load_prediction_chat_prompt
from app.agents.search_tools import build_latest_information_search_tool
from app.models.market_prediction import (
    MarketPrediction,
    MarketPredictionAgentOutput,
    MarketPredictionCandidate,
)
from app.models.news import LatestInformationSearchResponse, NewsSearchResult


def test_app_config_loads_backend_dotenv_before_reading_env(monkeypatch):
    app_config_module = importlib.import_module("app.core.app_config")
    app_config_module.get_app_config.cache_clear()
    monkeypatch.delenv("BIFROST_ENDPOINT_URL", raising=False)
    monkeypatch.delenv("BIFROST_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("MODEL_NAME", raising=False)

    calls = []

    def fake_load_dotenv(path, *, override=False):
        calls.append((path, override))
        monkeypatch.setenv("BIFROST_ENDPOINT_URL", "https://bifrost.example/v1/chat/completions")
        monkeypatch.setenv("BIFROST_API_KEY", "bifrost-key")
        monkeypatch.setenv("MODEL_NAME", "byteplus/deepseek-v4-pro-260425")
        return True

    monkeypatch.setattr(app_config_module, "load_dotenv", fake_load_dotenv)

    try:
        config = app_config_module.get_app_config()
    finally:
        app_config_module.get_app_config.cache_clear()

    assert calls == [(app_config_module._backend_dir() / ".env", False)]
    assert config.BIFROST_ENDPOINT_URL == "https://bifrost.example/v1"
    assert config.BIFROST_API_KEY == "bifrost-key"
    assert config.OPENAI_API_KEY == "bifrost-key"
    assert config.MODEL_NAME == "byteplus/deepseek-v4-pro-260425"


def test_app_config_defaults_chat_model_to_high_reasoning(monkeypatch):
    app_config_module = importlib.import_module("app.core.app_config")
    app_config_module.get_app_config.cache_clear()
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    monkeypatch.delenv("MODEL_NAME", raising=False)
    monkeypatch.delenv("CHAT_MODEL_NAME", raising=False)
    monkeypatch.setattr(app_config_module, "load_dotenv", lambda *args, **kwargs: False)

    try:
        config = app_config_module.get_app_config()
    finally:
        app_config_module.get_app_config.cache_clear()

    assert config.MODEL_NAME == "openainexira/gpt-5.4-mini"
    assert config.CHAT_MODEL_NAME == "openainexira/gpt-5.4-mini-high-reasoning"


def test_bifrost_provider_uses_bifrost_api_key_not_openai_fallback(monkeypatch):
    class DummyConfig:
        BIFROST_ENDPOINT_URL = "https://bifrost.example/v1"
        BIFROST_API_KEY = "bifrost-key"
        OPENAI_API_KEY = "openai-key"

    monkeypatch.setattr(model_adapters, "app_config", DummyConfig())

    provider = model_adapters._bifrost_provider()

    assert str(provider.base_url).rstrip("/") == "https://bifrost.example/v1"
    assert provider.client.api_key == "bifrost-key"


def test_normalize_bifrost_model_name_adds_default_provider():
    assert normalize_bifrost_model_name("gpt-5.4-mini") == "openainexira/gpt-5.4-mini"
    assert normalize_bifrost_model_name("gemini-2.5-pro") == "vertex/gemini-2.5-pro"
    assert normalize_bifrost_model_name("openai:gpt-5.4-mini") == "openainexira/gpt-5.4-mini"


def test_prediction_chat_uses_chat_model_name_default(monkeypatch):
    class DummyConfig:
        CHAT_MODEL_NAME = "openainexira/gpt-5.4-mini-high-reasoning"

    resolved_model_names: list[str] = []

    def fake_resolve_pydantic_model(model_name: str):
        resolved_model_names.append(model_name)
        return "openai:gpt-5.4-mini"

    monkeypatch.setattr(prediction_chat_module, "app_config", DummyConfig())
    monkeypatch.setattr(
        prediction_chat_module,
        "resolve_pydantic_model",
        fake_resolve_pydantic_model,
    )

    agent = prediction_chat_module.FutboliaPredictionAgent()

    assert agent.model_name == DummyConfig.CHAT_MODEL_NAME
    assert agent._recommended_questions_agent.model_name == DummyConfig.CHAT_MODEL_NAME
    assert resolved_model_names == [
        DummyConfig.CHAT_MODEL_NAME,
        DummyConfig.CHAT_MODEL_NAME,
    ]


def test_prediction_agent_build_prompt_uses_natural_vietnamese_data_label():
    prompt = FutboliaPredictionAgent._build_prompt(
        question="What changed?",
        context=PredictionAgentContext(
            match={"team1": "Mexico", "team2": "South Africa"},
            live_snapshot={"provider_status": "not_configured", "events": []},
            prediction_context={"confidence": 0.62},
        ),
    )

    assert "Dữ liệu trận đấu" in prompt
    assert "Context trận đấu" not in prompt
    assert "Mexico" in prompt
    assert "not_configured" in prompt
    assert "What changed?" in prompt


def test_recommended_questions_prompt_uses_natural_vietnamese_data_wording():
    prompt = FutboliaRecommendedQuestionsAgent._build_prompt(
        PredictionAgentContext(
            match={"team1": "Mexico", "team2": "South Africa"},
            prediction_context={"language": "vi"},
        )
    )

    assert "dữ liệu trận đấu" in prompt.lower()
    assert "context trận đấu" not in prompt.lower()


class FakeLatestInformationSearchService:
    def __init__(self) -> None:
        self.calls = 0
        self.last_kwargs = None

    async def search_latest_information(
        self,
        *,
        query: str,
        max_results: int | None = None,
        force_refresh: bool = False,
        recency=None,
    ) -> LatestInformationSearchResponse:
        self.calls += 1
        self.last_kwargs = {
            "query": query,
            "max_results": max_results,
            "force_refresh": force_refresh,
            "recency": recency,
        }
        return LatestInformationSearchResponse(
            provider_status="ready",
            query=query,
            generated_at=datetime.now(UTC),
            results=[
                NewsSearchResult(
                    title="Brazil vs France latest team news",
                    url="https://example.com/brazil-france-team-news",
                    snippet="Latest team news for Brazil vs France.",
                    date="2026-06-20",
                )
            ],
            source_id="search-tool-1",
        )


@pytest.mark.asyncio
async def test_latest_information_search_tool_returns_json_ready_results():
    service = FakeLatestInformationSearchService()
    tool = build_latest_information_search_tool(service)

    result = await tool(
        query="  Brazil France latest team news  ",
        recency="day",
        max_results=2,
    )

    assert result["provider_status"] == "ready"
    assert result["query"] == "Brazil France latest team news"
    assert result["source_id"] == "search-tool-1"
    assert result["results"][0]["url"] == "https://example.com/brazil-france-team-news"
    assert service.last_kwargs == {
        "query": "Brazil France latest team news",
        "max_results": 2,
        "force_refresh": False,
        "recency": "day",
    }


def test_prediction_agent_registers_latest_information_search_tool_when_service_provided():
    agent = FutboliaPredictionAgent(
        news_search_service=FakeLatestInformationSearchService(),
    )

    assert [tool.__name__ for tool in agent.init_tools] == ["search_latest_information"]


def test_prediction_chat_prompt_allows_search_only_for_match_scope():
    prompt = load_prediction_chat_prompt()

    assert "search_latest_information" in prompt
    assert "chỉ trả lời" in prompt.lower()
    assert "trận đấu giữa" in prompt.lower()


def test_prediction_chat_prompt_steers_vietnamese_away_from_context_repetition():
    prompt = load_prediction_chat_prompt()

    assert "không lặp đi lặp lại từ `context`" in prompt.lower()
    assert "gần giờ bóng lăn" in prompt.lower()
    assert "dữ liệu còn sớm" in prompt.lower()


@pytest.mark.asyncio
async def test_market_prediction_agent_logs_llm_context_and_output(caplog):
    agent = FutboliaMarketPredictionAgent.__new__(FutboliaMarketPredictionAgent)
    market = MarketPredictionCandidate(
        id="one-x-two",
        family="one_x_two",
        name="1X2: Kết quả trận đấu",
        description="Kết quả chính thức trong 90 phút.",
        candidate_outcomes=["Mexico thắng", "Hòa", "Senegal thắng"],
    )

    async def fake_run(prompt, **kwargs):
        assert "Mexico" in prompt
        assert kwargs["persist_message_history"] is False
        return MarketPredictionAgentOutput(
            summary="Mexico nhỉnh hơn.",
            predictions=[
                MarketPrediction(
                    id="one-x-two",
                    family="one_x_two",
                    name="1X2: Kết quả trận đấu",
                    selection="Mexico thắng",
                    probability=56,
                    confidence="medium",
                    confidence_score=62,
                    confidence_rationale=(
                        "Fixture context is available, but live and lineup data are missing."
                    ),
                    risk="medium",
                    reasoning=(
                        "Mexico có lợi thế nhẹ từ bối cảnh trận hiện có. Tuy nhiên, chưa có "
                        "dữ liệu live hoặc đội hình để đẩy độ tin cậy lên cao hơn."
                    ),
                    drivers=["Fixture context", "Missing live data"],
                )
            ],
        )

    agent.run = fake_run
    caplog.set_level(logging.INFO, logger="uvicorn.error")

    await agent.predict_markets(
        match={"home_team": "Mexico", "away_team": "Senegal"},
        markets=[market],
        prediction_context={"prediction_mode": "pre_match"},
    )

    assert "Market prediction LLM context" in caplog.text
    assert '"home_team": "Mexico"' in caplog.text
    assert "Market prediction LLM output" in caplog.text
    assert '"selection": "Mexico thắng"' in caplog.text
