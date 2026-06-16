from __future__ import annotations

from typing import Any

from pydantic_ai.profiles.openai import OpenAIModelProfile, openai_model_profile

DEEPSEEK_REASONING_SUFFIXES: tuple[tuple[str, str], ...] = (
    ("-xhigh-reasoning", "max"),
    ("-high-reasoning", "high"),
    ("-medium-reasoning", "high"),
    ("-low-reasoning", "high"),
)


def _split_provider_model(model_name: str) -> tuple[str, str]:
    if "/" not in model_name:
        return "", model_name.strip()
    provider, raw_model = model_name.split("/", 1)
    return provider.strip().lower(), raw_model.strip()


def is_byteplus_deepseek_v4_model(model_name: str) -> bool:
    provider, raw_model = _split_provider_model(model_name)
    return provider == "byteplus" and raw_model.lower().startswith("deepseek-v4-")


def split_deepseek_reasoning_model_name(model_name: str) -> tuple[str, str | None]:
    lowered = model_name.lower()
    for suffix, effort in DEEPSEEK_REASONING_SUFFIXES:
        if not lowered.endswith(suffix):
            continue
        base_model = model_name[: -len(suffix)]
        if is_byteplus_deepseek_v4_model(base_model):
            return base_model, effort
    return model_name, None


def deepseek_reasoning_extra_body(model_name: str) -> dict[str, Any] | None:
    _, effort = split_deepseek_reasoning_model_name(model_name)
    if effort is None:
        return None
    return {
        "thinking": {"type": "enabled"},
        "reasoning": {"effort": effort},
    }


def deepseek_reasoning_profile(model_name: str) -> OpenAIModelProfile:
    profile = OpenAIModelProfile.from_profile(openai_model_profile(model_name))
    return profile.update(
        OpenAIModelProfile(
            supports_thinking=True,
            openai_chat_thinking_field="reasoning_content",
            openai_chat_send_back_thinking_parts="field",
        )
    )

