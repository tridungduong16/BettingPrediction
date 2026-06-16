from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from collections.abc import AsyncIterator, Callable, Sequence
from contextlib import suppress
from typing import Any, TypeVar

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict
from pydantic_ai import Agent
from pydantic_ai.messages import ImageUrl, ModelMessage
from pydantic_ai.models import Model

from app.agents.mcp_client import mcp_client
from app.agents.observability.langfuse import (
    apply_langfuse_instrumentation,
    update_current_langfuse_span,
)
from app.core.app_config import app_config, normalize_openai_base_url

DepsT = TypeVar("DepsT")
OutputT = TypeVar("OutputT")


def _mcp_signature(config: dict | None) -> str | None:
    if not config:
        return None
    try:
        payload = json.dumps(config, sort_keys=True, ensure_ascii=False)
    except Exception:
        payload = str(config)
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def _model_log_name(model: object) -> str:
    if isinstance(model, str):
        return model
    configured_model_name = getattr(model, "configured_model_name", None)
    api_model_name = getattr(model, "model_name", None)
    if configured_model_name and api_model_name and configured_model_name != api_model_name:
        return f"{configured_model_name} api_model={api_model_name}"
    if configured_model_name:
        return str(configured_model_name)
    if api_model_name:
        return str(api_model_name)
    return type(model).__name__


class StreamEvent(BaseModel):
    type: str
    content: Any
    metadata: dict[str, Any] | None = None


class AgentConfig(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    model: str | Model = "openai:openainexira/gpt-5.4-mini"
    system_prompt: str | None = None
    retries: int = 1
    output_type: type | None = None
    load_env: bool = True
    bifrost_url: str | None = None
    bifrost_key: str | None = None
    model_settings: dict[str, Any] | None = None


class BasePydanticAgent[DepsT, OutputT]:
    def __init__(
        self,
        config: AgentConfig | None = None,
        deps_type: type | None = None,
        tools: list[Callable] | None = None,
    ) -> None:
        self.config = config or AgentConfig()
        self.logger = logging.getLogger(self.__class__.__name__)
        self.deps_type = deps_type
        self.init_tools = tools or []
        self.mcp_client = mcp_client
        self.cache_agents: dict[str, dict[str, Any]] = {}
        self.cache_agent_mcp_signature: dict[str, str | None] = {}
        self.agent: Agent | None = None
        self._message_history: list[ModelMessage] = []
        self._message_history_by_thread: dict[str, list[ModelMessage]] = {}
        self._tools: dict[str, Callable] = {}
        self._event_queue: asyncio.Queue[StreamEvent | None] | None = None

        if self.config.load_env:
            self._setup_environment()

    async def init_agent(self, user_id: str | None = None, mcp_servers: dict | None = None) -> None:
        if not user_id:
            if self.init_tools:
                self._register_tools_batch(self.init_tools)
            else:
                self._tools = {}
                self.agent = self._create_agent(self.deps_type)
            return
        await self.switch_agent(user_id, mcp_servers)

    async def switch_agent(self, user_id: str, mcp_servers: dict | None = None) -> None:
        if not mcp_servers:
            desired_sig = None
            mcp_tools: list[Callable] = []
            needs_rebuild = user_id not in self.cache_agents
        else:
            desired_sig = _mcp_signature(mcp_servers)
            current_sig = self.cache_agent_mcp_signature.get(user_id)
            needs_rebuild = user_id not in self.cache_agents or desired_sig != current_sig
            mcp_tools = await self.get_mcp_tools(mcp_servers) if needs_rebuild else []

        if needs_rebuild:
            all_tools = self.init_tools + mcp_tools
            self._register_tools_batch(all_tools)
            self.cache_agents[user_id] = {"agent": self.agent, "tools": self._tools}
            self.cache_agent_mcp_signature[user_id] = desired_sig
            return

        cached = self.cache_agents[user_id]
        self.agent = cached["agent"]
        self._tools = cached["tools"]

    async def get_mcp_tools(self, mcp_servers: dict | None = None) -> list[Callable]:
        if not mcp_servers:
            return []
        servers = mcp_servers.get("mcpServers") if isinstance(mcp_servers, dict) else None
        server_count = len(servers) if isinstance(servers, dict) else 0
        self.mcp_client.configure(mcp_servers, tool_name_prefix=server_count > 1)
        return [self.wrap_structured_tool(tool) for tool in await self.mcp_client.get_tools()]

    @staticmethod
    def wrap_structured_tool(tool: Any) -> Callable:
        async def call_tool(ctx: Any, **kwargs: Any) -> Any:
            _ = ctx
            return await tool.arun(kwargs)

        call_tool.__name__ = tool.name
        call_tool.__doc__ = tool.description or ""
        return call_tool

    def _setup_environment(self) -> None:
        load_dotenv()
        bifrost_url = (
            normalize_openai_base_url(self.config.bifrost_url) or app_config.BIFROST_ENDPOINT_URL
        )
        bifrost_key = self.config.bifrost_key or app_config.BIFROST_API_KEY

        if bifrost_url:
            os.environ["OPENAI_BASE_URL"] = bifrost_url
        if bifrost_key:
            os.environ["OPENAI_API_KEY"] = bifrost_key

    def _create_agent(
        self,
        deps_type: type | None = None,
        tools: list[Callable] | None = None,
    ) -> Agent:
        agent_kwargs: dict[str, Any] = {
            "model": self.config.model,
            "retries": self.config.retries,
            "tools": tools or [],
        }
        if self.config.system_prompt:
            agent_kwargs["system_prompt"] = self.config.system_prompt
        if self.config.output_type:
            agent_kwargs["output_type"] = self.config.output_type
        if deps_type:
            agent_kwargs["deps_type"] = deps_type
        if self.config.model_settings:
            agent_kwargs["model_settings"] = self.config.model_settings

        return Agent(**apply_langfuse_instrumentation(agent_kwargs))

    def _wrap_tool_with_events(self, func: Callable, tool_name: str) -> Callable:
        import inspect
        from functools import wraps

        if inspect.iscoroutinefunction(func):

            @wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                return await self._run_tool_with_events(func, tool_name, args, kwargs)

            return async_wrapper

        @wraps(func)
        async def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            return await self._run_tool_with_events(func, tool_name, args, kwargs, sync=True)

        return sync_wrapper

    async def _run_tool_with_events(
        self,
        func: Callable,
        tool_name: str,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
        *,
        sync: bool = False,
    ) -> Any:
        tool_input = self._tool_args_payload(args, kwargs)
        started_at = time.perf_counter()
        await self._emit_tool_event("tool_call", {"name": tool_name, "args": tool_input})
        update_current_langfuse_span(
            name=tool_name,
            input=tool_input,
            metadata={"tool_name": tool_name, "tool_phase": "started"},
            status_message="tool_started",
        )
        try:
            result = func(*args, **kwargs) if sync else await func(*args, **kwargs)
        except Exception as exc:
            update_current_langfuse_span(
                name=tool_name,
                output=self._preview_observability_value(exc),
                metadata={
                    "tool_name": tool_name,
                    "tool_phase": "failed",
                    "tool_duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
                },
                level="ERROR",
                status_message="tool_failed",
            )
            raise

        await self._emit_tool_event("tool_result", {"name": tool_name, "result": str(result)})
        update_current_langfuse_span(
            name=tool_name,
            output=self._preview_observability_value(result),
            metadata={
                "tool_name": tool_name,
                "tool_phase": "completed",
                "tool_duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            },
            status_message="tool_completed",
        )
        return result

    @staticmethod
    def _tool_args_payload(args: tuple[Any, ...], kwargs: dict[str, Any]) -> dict[str, Any]:
        if kwargs:
            return kwargs
        return {f"arg{i}": arg for i, arg in enumerate(args[1:])}

    @staticmethod
    def _preview_observability_value(value: Any, max_chars: int = 500) -> str:
        try:
            if isinstance(value, (dict, list, tuple)):
                text = json.dumps(value, ensure_ascii=False, default=str)
            else:
                text = str(value)
        except Exception:
            text = repr(value)
        return text if len(text) <= max_chars else text[: max_chars - 3].rstrip() + "..."

    @staticmethod
    def _stringify_output_value(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, BaseModel):
            return value.model_dump_json(exclude_none=True)
        if isinstance(value, (dict, list, tuple)):
            return json.dumps(value, ensure_ascii=False, default=str)
        text_attr = getattr(value, "text", None)
        return text_attr if isinstance(text_attr, str) else str(value)

    def register_tool(
        self,
        func: Callable | None = None,
        *,
        name: str | None = None,
        auto_emit_events: bool = True,
    ) -> Callable:
        def decorator(f: Callable) -> Callable:
            if self.agent is None:
                self.agent = self._create_agent(self.deps_type)
            tool_name = name or getattr(f, "name", f.__name__)
            self._tools[tool_name] = f
            wrapped = self._wrap_tool_with_events(f, tool_name) if auto_emit_events else f
            return self.agent.tool(wrapped)

        if func is None:
            return decorator
        return decorator(func)

    @staticmethod
    def _resolve_tool_name(f: Callable, name: str | None = None) -> str:
        return name or getattr(f, "name", f.__name__)

    def _register_tools_batch(self, tools: list[Callable]) -> None:
        self._tools = {}
        wrapped: list[Callable] = []
        for tool in tools:
            tool_name = self._resolve_tool_name(tool)
            self._tools[tool_name] = tool
            wrapped.append(self._wrap_tool_with_events(tool, tool_name))
        self.agent = self._create_agent(self.deps_type, tools=wrapped)

    def _effective_history_for_run(
        self,
        message_history: list[ModelMessage] | None,
        thread_id_for_history: str | None,
    ) -> list[ModelMessage]:
        if message_history is not None:
            return message_history
        if thread_id_for_history is not None:
            return list(self._message_history_by_thread.get(thread_id_for_history, []))
        return self._message_history

    def _store_history_after_run(
        self,
        messages: list[ModelMessage],
        thread_id_for_history: str | None,
    ) -> None:
        if thread_id_for_history is not None:
            self._message_history_by_thread[thread_id_for_history] = messages
        else:
            self._message_history = messages

    async def run(
        self,
        prompt: str,
        *,
        deps: DepsT | None = None,
        message_history: list[ModelMessage] | None = None,
        thread_id_for_history: str | None = None,
        persist_message_history: bool = True,
        **kwargs: Any,
    ) -> OutputT:
        if self.agent is None:
            await self.init_agent()
        assert self.agent is not None
        effective = self._effective_history_for_run(message_history, thread_id_for_history)
        result = await self.agent.run(prompt, deps=deps, message_history=effective, **kwargs)
        if persist_message_history:
            self._store_history_after_run(result.all_messages(), thread_id_for_history)
        return result.output

    def run_sync(
        self,
        prompt: str,
        *,
        deps: DepsT | None = None,
        message_history: list[ModelMessage] | None = None,
        **kwargs: Any,
    ) -> OutputT:
        if self.agent is None:
            self.agent = self._create_agent(self.deps_type)
        result = self.agent.run_sync(
            prompt,
            deps=deps,
            message_history=message_history or self._message_history,
            **kwargs,
        )
        self._message_history = result.all_messages()
        return result.output

    async def stream_events(
        self,
        prompt: str,
        *,
        deps: DepsT | None = None,
        message_history: list[ModelMessage] | None = None,
        image_urls: list[str] | None = None,
        thread_id_for_history: str | None = None,
        persist_message_history: bool = True,
        delta: bool = True,
        debounce_by: float | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[StreamEvent]:
        event_queue: asyncio.Queue[StreamEvent | None] = asyncio.Queue()
        self._event_queue = event_queue

        async def queue_event(event: StreamEvent | None) -> None:
            await event_queue.put(event)

        async def run_agent() -> None:
            try:
                if self.agent is None:
                    await self.init_agent()
                assert self.agent is not None

                user_prompt: str | Sequence[object]
                if image_urls:
                    user_prompt = [prompt, *[ImageUrl(url=url) for url in image_urls]]
                else:
                    user_prompt = prompt

                effective_history = self._effective_history_for_run(
                    message_history,
                    thread_id_for_history,
                )
                async with self.agent.run_stream(
                    user_prompt,
                    deps=deps,
                    message_history=effective_history,
                    **kwargs,
                ) as result:
                    async for chunk in result.stream_text(delta=delta, debounce_by=debounce_by):
                        await queue_event(
                            StreamEvent(
                                type="text_delta" if delta else "text_full",
                                content=self._stringify_output_value(chunk),
                            )
                        )

                    final_output = await result.get_output()
                    all_msgs = result.all_messages()
                    if persist_message_history:
                        self._store_history_after_run(all_msgs, thread_id_for_history)
                    await queue_event(
                        StreamEvent(
                            type="done",
                            content=final_output,
                            metadata={"usage": result.usage(), "message_count": len(all_msgs)},
                        )
                    )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                await queue_event(StreamEvent(type="error", content=str(exc)))
            finally:
                await queue_event(None)

        agent_task = asyncio.create_task(run_agent())
        try:
            while True:
                event = await event_queue.get()
                if event is None:
                    break
                yield event
        finally:
            if not agent_task.done():
                agent_task.cancel()
            with suppress(asyncio.CancelledError):
                await agent_task
            if self._event_queue is event_queue:
                self._event_queue = None

    async def _emit_tool_event(self, event_type: str, content: Any) -> None:
        if self._event_queue is not None:
            await self._event_queue.put(StreamEvent(type=event_type, content=content))

    def get_message_history(self) -> list[ModelMessage]:
        return self._message_history.copy()

    def set_message_history(self, messages: list[ModelMessage]) -> None:
        self._message_history = messages.copy()

    def clear_message_history(self) -> None:
        self._message_history = []

    def get_registered_tools(self) -> dict[str, Callable]:
        return self._tools.copy()

    def update_system_prompt(self, new_prompt: str) -> None:
        self.config.system_prompt = new_prompt
        old_tools = self._tools.copy()
        self.agent = self._create_agent(self.deps_type)
        self._tools = {}
        for name, func in old_tools.items():
            self.register_tool(func, name=name)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}("
            f"model={_model_log_name(self.config.model)}, "
            f"tools={len(self._tools)}, "
            f"messages={len(self._message_history)})"
        )
