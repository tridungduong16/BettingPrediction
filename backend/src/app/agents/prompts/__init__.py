from __future__ import annotations

from pathlib import Path
from typing import Literal

PROMPTS_DIR = Path(__file__).resolve().parent
PredictionChatPromptLanguage = Literal["vi", "en"]
PREDICTION_CHAT_PROMPT_FILES: dict[PredictionChatPromptLanguage, str] = {
    "vi": "futbolia_prediction_chat_vi.prompty",
    "en": "futbolia_prediction_chat_en.prompty",
}
MARKET_PREDICTION_PROMPT_FILE = "futbolia_market_prediction.prompty"
MATCH_INSIGHT_PROMPT_FILE = "futbolia_match_insight.prompty"


def load_prompt(filename: str) -> str:
    prompt_path = (PROMPTS_DIR / filename).resolve()
    if PROMPTS_DIR not in prompt_path.parents:
        raise RuntimeError("prompt file must be inside the prompts directory")
    return prompt_path.read_text(encoding="utf-8").strip()


def load_prediction_chat_prompt(language: PredictionChatPromptLanguage = "vi") -> str:
    return load_prompt(PREDICTION_CHAT_PROMPT_FILES[language])


def load_market_prediction_prompt() -> str:
    return load_prompt(MARKET_PREDICTION_PROMPT_FILE)


def load_match_insight_prompt() -> str:
    return load_prompt(MATCH_INSIGHT_PROMPT_FILE)
