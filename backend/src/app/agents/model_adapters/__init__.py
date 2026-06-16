from __future__ import annotations

import logging
import time
from typing import Any

from pydantic_ai.models import Model
from pydantic_ai.models.openai import OpenAIChatModel, OpenAIResponsesModel
from pydantic_ai.profiles import ModelProfileSpec
from pydantic_ai.providers.openai import OpenAIProvider

from app.agents.model_adapters.deepseek import (
    deepseek_reasoning_extra_body,
    deepseek_reasoning_profile,
)
from app.agents.model_adapters.qwen import (
    build_qwen_model,
    qwen_reasoning_extra_body,
    qwen_reasoning_profile,
    split_qwen_reasoning_model_name,
)
from app.core.app_config import app_config

logger = logging.getLogger(__name__)
DEFAULT_BIFROST_PROVIDER = "openainexira"
DEFAULT_BIFROST_MODEL_NAME = f"{DEFAULT_BIFROST_PROVIDER}/gpt-5.4-mini"
VERTEX_BIFROST_PROVIDER = "vertex"
BYTEPLUS_BIFROST_PROVIDER = "byteplus"
BIFROST_PROVIDER_ALIASES: dict[str, str] = {
    "openai": DEFAULT_BIFROST_PROVIDER,
    "openainexira": DEFAULT_BIFROST_PROVIDER,
    "gemini": VERTEX_BIFROST_PROVIDER,
    "google": VERTEX_BIFROST_PROVIDER,
    "vertex": VERTEX_BIFROST_PROVIDER,
    "alibaba": "alibaba",
    "dashscope": "dashscope",
    "minimax": "minimax",
    "byteplus": BYTEPLUS_BIFROST_PROVIDER,
}
PYDANTIC_MODEL_PROVIDER_PREFIXES = {"openai"}
MODEL_PROVIDER_PREFIXES: tuple[tuple[str, str], ...] = (
    ("gpt-", DEFAULT_BIFROST_PROVIDER),
    ("o1", DEFAULT_BIFROST_PROVIDER),
    ("o3", DEFAULT_BIFROST_PROVIDER),
    ("o4", DEFAULT_BIFROST_PROVIDER),
    ("gemini-", VERTEX_BIFROST_PROVIDER),
    ("qwen", "alibaba"),
    ("deepseek-v4", BYTEPLUS_BIFROST_PROVIDER),
    ("deepseek", "alibaba"),
    ("minimax", "minimax"),
)
REASONING_SUFFIXES: tuple[tuple[str, str], ...] = (
    ("-xhigh-reasoning", "high"),
    ("-high-reasoning", "high"),
    ("-medium-reasoning", "medium"),
    ("-low-reasoning", "low"),
)


def _bifrost_provider() -> OpenAIProvider:
    return OpenAIProvider(
        base_url=app_config.BIFROST_ENDPOINT_URL,
        api_key=app_config.BIFROST_API_KEY,
    )


def _bifrost_base_url(model: Any) -> str | None:
    base_url = getattr(model, "base_url", None)
    return str(base_url).rstrip("/") if base_url is not None else None


def _request_timeout(model_settings: dict[str, Any] | None) -> object:
    if not model_settings:
        return None
    return model_settings.get("timeout")


def _with_bifrost_network_timeout(model_settings: dict[str, Any]) -> dict[str, Any]:
    timeout = _request_timeout(model_settings)
    if timeout is None:
        return model_settings
    try:
        timeout_seconds = float(timeout)
    except (TypeError, ValueError):
        return model_settings
    if timeout_seconds <= 0:
        return model_settings

    updated_settings = dict(model_settings)
    extra_body = updated_settings.get("extra_body")
    if extra_body is None:
        extra_body = {}
    if not isinstance(extra_body, dict):
        return model_settings
    extra_body = dict(extra_body)
    network_config = extra_body.get("network_config")
    if network_config is None:
        network_config = {}
    if not isinstance(network_config, dict):
        return model_settings
    network_config = dict(network_config)
    network_config.setdefault("default_request_timeout_in_seconds", timeout_seconds)
    extra_body["network_config"] = network_config
    updated_settings["extra_body"] = extra_body
    return updated_settings


def _request_tool_count(model_request_parameters: Any) -> int:
    native_tools = getattr(model_request_parameters, "native_tools", None)
    if native_tools is None:
        native_tools = getattr(model_request_parameters, "builtin_tools", None)
    return (
        len(getattr(model_request_parameters, "function_tools", None) or [])
        + len(getattr(model_request_parameters, "output_tools", None) or [])
        + len(native_tools or [])
    )


class BifrostOpenAIChatModel(OpenAIChatModel):
    def __init__(
        self,
        model_name: str,
        *,
        configured_model_name: str | None = None,
        settings: dict[str, Any] | None = None,
        profile: ModelProfileSpec | None = None,
    ) -> None:
        super().__init__(
            model_name,
            provider=_bifrost_provider(),
            settings=settings,
            profile=profile,
        )
        self.configured_model_name = configured_model_name or model_name

    async def _completions_create(
        self,
        messages: list[Any],
        stream: bool,
        model_settings: dict[str, Any],
        model_request_parameters: Any,
    ) -> Any:
        started_at = time.perf_counter()
        model_settings = _with_bifrost_network_timeout(model_settings)
        logger.debug(
            "Bifrost chat completion request start: model=%s api_model=%s stream=%s "
            "base_url=%s messages=%s tools=%s timeout=%s",
            self.configured_model_name,
            self.model_name,
            stream,
            _bifrost_base_url(self),
            len(messages),
            _request_tool_count(model_request_parameters),
            _request_timeout(model_settings),
        )
        try:
            response = await super()._completions_create(
                messages,
                stream,
                model_settings,
                model_request_parameters,
            )
        except Exception:
            logger.exception(
                "Bifrost chat completion request failed: model=%s api_model=%s stream=%s",
                self.configured_model_name,
                self.model_name,
                stream,
            )
            raise
        logger.debug(
            "Bifrost chat completion request opened: "
            "model=%s api_model=%s stream=%s elapsed_ms=%.1f",
            self.configured_model_name,
            self.model_name,
            stream,
            (time.perf_counter() - started_at) * 1000,
        )
        return response


class BifrostOpenAIResponsesModel(OpenAIResponsesModel):
    def __init__(
        self,
        model_name: str,
        *,
        configured_model_name: str | None = None,
        settings: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            model_name,
            provider=_bifrost_provider(),
            settings=settings,
        )
        self.configured_model_name = configured_model_name or model_name

    async def _responses_create(
        self,
        messages: list[Any],
        stream: bool,
        model_settings: dict[str, Any],
        model_request_parameters: Any,
    ) -> Any:
        started_at = time.perf_counter()
        model_settings = _with_bifrost_network_timeout(model_settings)
        logger.debug(
            "Bifrost responses request start: model=%s api_model=%s stream=%s "
            "base_url=%s messages=%s tools=%s timeout=%s",
            self.configured_model_name,
            self.model_name,
            stream,
            _bifrost_base_url(self),
            len(messages),
            _request_tool_count(model_request_parameters),
            _request_timeout(model_settings),
        )
        try:
            response = await super()._responses_create(
                messages,
                stream,
                model_settings,
                model_request_parameters,
            )
        except Exception:
            logger.exception(
                "Bifrost responses request failed: model=%s api_model=%s stream=%s",
                self.configured_model_name,
                self.model_name,
                stream,
            )
            raise
        logger.debug(
            "Bifrost responses request opened: model=%s api_model=%s stream=%s elapsed_ms=%.1f",
            self.configured_model_name,
            self.model_name,
            stream,
            (time.perf_counter() - started_at) * 1000,
        )
        return response


def canonicalize_bifrost_provider_name(provider_name: str) -> str:
    provider = provider_name.strip().strip("`")
    if not provider:
        return DEFAULT_BIFROST_PROVIDER
    return BIFROST_PROVIDER_ALIASES.get(provider.lower(), provider)


def _strip_pydantic_provider_prefix(model_name: str) -> str:
    if ":" not in model_name:
        return model_name
    provider_prefix, raw_model = model_name.split(":", 1)
    if provider_prefix.strip().lower() in PYDANTIC_MODEL_PROVIDER_PREFIXES:
        return raw_model.strip()
    return model_name


def _infer_bifrost_provider(model_id: str, default_provider: str | None) -> str:
    if default_provider is not None:
        return default_provider
    lowered = model_id.strip().lower()
    for prefix, provider in MODEL_PROVIDER_PREFIXES:
        if lowered.startswith(prefix):
            return provider
    return DEFAULT_BIFROST_PROVIDER


def normalize_bifrost_model_name(
    model_name: str | None,
    *,
    default_provider: str | None = None,
) -> str:
    normalized = (model_name or "").strip().strip("`")
    if not normalized:
        return DEFAULT_BIFROST_MODEL_NAME

    normalized = _strip_pydantic_provider_prefix(normalized)
    if not normalized:
        return DEFAULT_BIFROST_MODEL_NAME

    if "/" in normalized:
        provider, raw_model = normalized.split("/", 1)
        provider = canonicalize_bifrost_provider_name(provider)
        raw_model = raw_model.strip().strip("`")
        return f"{provider}/{raw_model}" if raw_model else DEFAULT_BIFROST_MODEL_NAME

    provider = canonicalize_bifrost_provider_name(
        _infer_bifrost_provider(normalized, default_provider)
    )
    return f"{provider}/{normalized}" if normalized else DEFAULT_BIFROST_MODEL_NAME


def split_bifrost_reasoning_model_name(model_name: str | None) -> tuple[str, str | None]:
    normalized = normalize_bifrost_model_name(model_name)
    lowered = normalized.lower()
    for suffix, effort in REASONING_SUFFIXES:
        if lowered.endswith(suffix):
            return normalized[: -len(suffix)], effort
    return normalized, None


def bifrost_model_name_for_api(model_name: str | None) -> str:
    normalized = normalize_bifrost_model_name(model_name)
    qwen_model_for_api, is_qwen_reasoning = split_qwen_reasoning_model_name(normalized)
    if is_qwen_reasoning:
        return qwen_model_for_api
    return split_bifrost_reasoning_model_name(normalized)[0]


def bifrost_reasoning_effort(model_name: str | None) -> str | None:
    return split_bifrost_reasoning_model_name(model_name)[1]


def bifrost_chat_completion_extra_body(model_name: str | None) -> dict[str, Any] | None:
    normalized = normalize_bifrost_model_name(model_name)

    deepseek_extra_body = deepseek_reasoning_extra_body(normalized)
    if deepseek_extra_body is not None:
        return deepseek_extra_body

    qwen_extra_body = qwen_reasoning_extra_body(normalized)
    if qwen_extra_body is not None:
        return qwen_extra_body

    reasoning_effort = bifrost_reasoning_effort(normalized)
    if reasoning_effort:
        return {"reasoning": {"effort": reasoning_effort}}
    return None


def build_bifrost_reasoning_model(
    model_name: str,
    reasoning_effort: str,
    *,
    configured_model_name: str | None = None,
) -> Model:
    return BifrostOpenAIResponsesModel(
        model_name,
        configured_model_name=configured_model_name,
        settings={"openai_reasoning_effort": reasoning_effort},
    )


def build_bifrost_chat_model(
    model_name: str,
    *,
    configured_model_name: str | None = None,
    settings: dict[str, Any] | None = None,
    profile: ModelProfileSpec | None = None,
) -> Model:
    return BifrostOpenAIChatModel(
        model_name,
        configured_model_name=configured_model_name or model_name,
        settings=settings,
        profile=profile,
    )


def resolve_pydantic_model(model_name: str | None) -> str | Model:
    normalized = normalize_bifrost_model_name(model_name)
    model_for_api, reasoning_effort = split_bifrost_reasoning_model_name(normalized)

    deepseek_extra_body = deepseek_reasoning_extra_body(normalized)
    if deepseek_extra_body is not None:
        return build_bifrost_chat_model(
            model_for_api,
            configured_model_name=normalized,
            settings={"extra_body": deepseek_extra_body},
            profile=deepseek_reasoning_profile(model_for_api),
        )

    qwen_model_for_api, is_qwen_reasoning = split_qwen_reasoning_model_name(normalized)
    if is_qwen_reasoning:
        return build_bifrost_chat_model(
            qwen_model_for_api,
            configured_model_name=normalized,
            settings={"extra_body": {"enable_thinking": True}},
            profile=qwen_reasoning_profile(qwen_model_for_api),
        )

    if reasoning_effort:
        return build_bifrost_reasoning_model(
            model_for_api,
            reasoning_effort,
            configured_model_name=normalized,
        )

    adapted = build_qwen_model(normalized)
    if adapted is not None:
        return adapted

    return build_bifrost_chat_model(normalized)
