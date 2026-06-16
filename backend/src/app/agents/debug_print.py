from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger("app.agents")


def _log(level: int, message: Any) -> None:
    logger.log(level, "%s", message)


def debug(message: Any) -> None:
    _log(logging.DEBUG, message)


def info(message: Any) -> None:
    _log(logging.INFO, message)


def warning(message: Any) -> None:
    _log(logging.WARNING, message)


def success(message: Any) -> None:
    _log(logging.INFO, message)


def error(message: Any) -> None:
    _log(logging.ERROR, message)


def print_json(payload: Any, title: str | None = None) -> None:
    if title:
        debug(title)
    debug(json.dumps(payload, ensure_ascii=False, indent=2, default=str))


def print_panel(content: Any, title: str | None = None, style: str | None = None) -> None:
    _ = style
    if title:
        debug(title)
    debug(content)

