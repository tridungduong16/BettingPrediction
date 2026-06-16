from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any


def apply_langfuse_instrumentation(agent_kwargs: dict[str, Any]) -> dict[str, Any]:
    return dict(agent_kwargs)


def update_current_langfuse_span(**kwargs: Any) -> None:
    _ = kwargs


def setup_langfuse() -> bool:
    return False


@contextmanager
def langfuse_generation_context(**kwargs: Any) -> Iterator[None]:
    _ = kwargs
    yield


def mark_langfuse_generation_error(**kwargs: Any) -> None:
    _ = kwargs


def update_langfuse_generation_from_response(**kwargs: Any) -> None:
    _ = kwargs

