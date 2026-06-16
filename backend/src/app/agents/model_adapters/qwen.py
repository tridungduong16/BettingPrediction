from __future__ import annotations

import os

from pydantic_ai.models import Model
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.profiles.openai import OpenAIModelProfile, openai_model_profile
from pydantic_ai.providers.openai import OpenAIProvider

from app.core.app_config import app_config

DEFAULT_DASHSCOPE_COMPAT_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
QWEN_REASONING_PICKER_MODEL = "dashscope/qwen3.6-plus-reasoning"
QWEN_REASONING_BIFROST_MODEL = "alibaba/qwen3.6-plus-reasoning"
QWEN_REASONING_ALIAS = "qwen3.6-plus-reasoning"
QWEN_REASONING_API_MODEL = "qwen3.6-plus"
QWEN_REASONING_SUFFIXES: tuple[str, ...] = (
    "-xhigh-reasoning",
    "-high-reasoning",
    "-medium-reasoning",
    "-low-reasoning",
    "-reasoning",
)


class DashScopeOpenAIProvider(OpenAIProvider):
    @property
    def name(self) -> str:
        return "dashscope"


def _normalize_model_name(model_name: str) -> str:
    normalized = model_name.strip()
    if ":" in normalized:
        normalized = normalized.split(":", 1)[1]
    return normalized


def _is_qwen_reasoning_model(model_name: str) -> bool:
    normalized = _normalize_model_name(model_name)
    model_id = normalized.split("/", 1)[1] if "/" in normalized else normalized
    candidates = {
        QWEN_REASONING_PICKER_MODEL.lower(),
        QWEN_REASONING_BIFROST_MODEL.lower(),
        QWEN_REASONING_ALIAS.lower(),
    }
    return normalized.lower() in candidates or model_id.lower() == QWEN_REASONING_ALIAS.lower()


def _split_provider_model(model_name: str) -> tuple[str, str]:
    normalized = _normalize_model_name(model_name)
    if "/" not in normalized:
        return "", normalized
    provider, raw_model = normalized.split("/", 1)
    return provider.strip().lower(), raw_model.strip()


def _is_bifrost_qwen_model(model_name: str) -> bool:
    provider, raw_model = _split_provider_model(model_name)
    return provider == "alibaba" and raw_model.lower().startswith("qwen")


def split_qwen_reasoning_model_name(model_name: str) -> tuple[str, bool]:
    lowered = model_name.lower()
    for suffix in QWEN_REASONING_SUFFIXES:
        if not lowered.endswith(suffix):
            continue
        base_model = model_name[: -len(suffix)]
        if _is_bifrost_qwen_model(base_model):
            return base_model, True
    return model_name, False


def qwen_reasoning_extra_body(model_name: str) -> dict[str, bool] | None:
    _, is_reasoning = split_qwen_reasoning_model_name(model_name)
    if not is_reasoning:
        return None
    return {"enable_thinking": True}


def qwen_reasoning_profile(model_name: str) -> OpenAIModelProfile:
    profile = OpenAIModelProfile.from_profile(openai_model_profile(model_name))
    return profile.update(
        OpenAIModelProfile(
            supports_thinking=True,
            openai_chat_thinking_field="reasoning_content",
            openai_chat_send_back_thinking_parts="field",
        )
    )


def _dashscope_base_url() -> str:
    return (
        os.getenv("DASHSCOPE_BASE_URL")
        or app_config.DASHSCOPE_BASE_URL
        or app_config.DASHSCOPE_EMBEDDING_BASE_URL
        or DEFAULT_DASHSCOPE_COMPAT_BASE_URL
    )


def build_qwen_model(model_name: str) -> Model | None:
    if not _is_qwen_reasoning_model(model_name):
        return None

    api_key = app_config.DASHSCOPE_API_KEY or os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        raise ValueError("DASHSCOPE_API_KEY is required to use qwen3.6-plus-reasoning")

    provider = DashScopeOpenAIProvider(
        base_url=_dashscope_base_url(),
        api_key=api_key,
    )
    profile = OpenAIModelProfile(
        supports_thinking=True,
        openai_chat_thinking_field="reasoning_content",
        openai_chat_send_back_thinking_parts="field",
    )
    return OpenAIChatModel(
        QWEN_REASONING_API_MODEL,
        provider=provider,
        profile=profile,
        settings={"extra_body": {"enable_thinking": True}},
    )

