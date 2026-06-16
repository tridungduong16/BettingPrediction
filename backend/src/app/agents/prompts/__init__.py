from __future__ import annotations

from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent
PREDICTION_CHAT_PROMPT_FILE = "futbolia_prediction_chat.prompty"
MARKET_PREDICTION_PROMPT_FILE = "futbolia_market_prediction.prompty"
MATCH_INSIGHT_PROMPT_FILE = "futbolia_match_insight.prompty"


def load_prompt(filename: str) -> str:
    prompt_path = (PROMPTS_DIR / filename).resolve()
    if PROMPTS_DIR not in prompt_path.parents:
        raise RuntimeError("prompt file must be inside the prompts directory")
    return prompt_path.read_text(encoding="utf-8").strip()


def load_prediction_chat_prompt() -> str:
    return load_prompt(PREDICTION_CHAT_PROMPT_FILE)


def load_market_prediction_prompt() -> str:
    return load_prompt(MARKET_PREDICTION_PROMPT_FILE)


def load_match_insight_prompt() -> str:
    return load_prompt(MATCH_INSIGHT_PROMPT_FILE)
