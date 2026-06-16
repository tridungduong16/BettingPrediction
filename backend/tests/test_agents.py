from __future__ import annotations

import importlib
import logging

import pytest

from app.agents import model_adapters
from app.agents.market_prediction import FutboliaMarketPredictionAgent
from app.agents.model_adapters import normalize_bifrost_model_name
from app.agents.prediction_chat import FutboliaPredictionAgent, PredictionAgentContext
from app.models.market_prediction import (
    MarketPrediction,
    MarketPredictionAgentOutput,
    MarketPredictionCandidate,
)


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


def test_prediction_agent_build_prompt_includes_context():
    prompt = FutboliaPredictionAgent._build_prompt(
        question="What changed?",
        context=PredictionAgentContext(
            match={"team1": "Mexico", "team2": "South Africa"},
            live_snapshot={"provider_status": "not_configured", "events": []},
            prediction_context={"confidence": 0.62},
        ),
    )

    assert "Context trận đấu" in prompt
    assert "Mexico" in prompt
    assert "not_configured" in prompt
    assert "What changed?" in prompt


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
                    risk="medium",
                    reasoning="Mexico có lợi thế nhẹ.",
                    drivers=["Fixture context"],
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
