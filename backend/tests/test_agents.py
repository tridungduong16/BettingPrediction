from __future__ import annotations

from app.agents.model_adapters import normalize_bifrost_model_name
from app.agents.prediction_chat import FutboliaPredictionAgent, PredictionAgentContext


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
