from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import unquote, urlparse

logger = logging.getLogger(__name__)


class PredictionCacheError(RuntimeError):
    """Raised when the prediction cache backend cannot complete a command."""


class PredictionCacheBackend:
    async def get_json(self, key: str) -> dict[str, Any] | None:
        raise NotImplementedError

    async def set_json(self, key: str, payload: dict[str, Any], ttl_seconds: int) -> None:
        raise NotImplementedError


@dataclass
class InMemoryPredictionCacheEntry:
    payload: dict[str, Any]
    expires_at: datetime


class InMemoryPredictionCache(PredictionCacheBackend):
    def __init__(self) -> None:
        self._store: dict[str, InMemoryPredictionCacheEntry] = {}

    async def get_json(self, key: str) -> dict[str, Any] | None:
        entry = self._store.get(key)
        if entry is None:
            return None

        if entry.expires_at <= datetime.now(UTC):
            self._store.pop(key, None)
            return None

        return entry.payload

    async def set_json(self, key: str, payload: dict[str, Any], ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            return

        self._store[key] = InMemoryPredictionCacheEntry(
            payload=payload,
            expires_at=datetime.now(UTC) + timedelta(seconds=ttl_seconds),
        )


class RedisPredictionCache(PredictionCacheBackend):
    def __init__(
        self,
        *,
        db: int = 0,
        host: str | None = None,
        key_prefix: str = "futbolia",
        password: str | None = None,
        port: int = 6379,
        timeout_seconds: float = 1.0,
        url: str | None = None,
    ) -> None:
        if url:
            parsed = urlparse(url)
            if parsed.scheme not in {"redis", "rediss"}:
                raise ValueError("REDIS_URL must use redis:// or rediss://")

            self._host = parsed.hostname or "localhost"
            self._port = parsed.port or 6379
            self._username = unquote(parsed.username) if parsed.username else None
            self._password = unquote(parsed.password) if parsed.password else None
            self._db = int(parsed.path.removeprefix("/") or "0")
            self._use_tls = parsed.scheme == "rediss"
        else:
            self._host = host or "localhost"
            self._port = port
            self._username = None
            self._password = password
            self._db = db
            self._use_tls = False

        self._key_prefix = key_prefix.strip(":") or "futbolia"
        self._timeout_seconds = timeout_seconds

    async def get_json(self, key: str) -> dict[str, Any] | None:
        response = await self._execute("GET", self._cache_key(key))
        if response is None:
            return None

        if not isinstance(response, bytes):
            raise PredictionCacheError("Redis GET returned an unexpected response")

        return json.loads(response.decode("utf-8"))

    async def set_json(self, key: str, payload: dict[str, Any], ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            return

        value = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        await self._execute("SET", self._cache_key(key), value, "EX", str(ttl_seconds))

    def _cache_key(self, key: str) -> str:
        return f"{self._key_prefix}:{key}"

    async def _execute(self, *parts: str) -> Any:
        try:
            return await asyncio.wait_for(self._execute_once(*parts), self._timeout_seconds)
        except TimeoutError as exc:
            raise PredictionCacheError("Redis command timed out") from exc
        except OSError as exc:
            raise PredictionCacheError(str(exc)) from exc

    async def _execute_once(self, *parts: str) -> Any:
        reader: asyncio.StreamReader
        writer: asyncio.StreamWriter
        reader, writer = await asyncio.open_connection(
            self._host,
            self._port,
            ssl=self._use_tls,
        )

        try:
            if self._password:
                if self._username:
                    await self._send_command(reader, writer, "AUTH", self._username, self._password)
                else:
                    await self._send_command(reader, writer, "AUTH", self._password)

            if self._db:
                await self._send_command(reader, writer, "SELECT", str(self._db))

            return await self._send_command(reader, writer, *parts)
        finally:
            writer.close()
            await writer.wait_closed()

    async def _send_command(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
        *parts: str,
    ) -> Any:
        writer.write(_encode_command(*parts))
        await writer.drain()
        return await _read_response(reader)


def _encode_command(*parts: str) -> bytes:
    encoded = [part.encode("utf-8") for part in parts]
    command = [f"*{len(encoded)}\r\n".encode("ascii")]
    for part in encoded:
        command.append(f"${len(part)}\r\n".encode("ascii"))
        command.append(part)
        command.append(b"\r\n")
    return b"".join(command)


async def _read_line(reader: asyncio.StreamReader) -> bytes:
    line = await reader.readline()
    if not line.endswith(b"\r\n"):
        raise PredictionCacheError("Redis returned a malformed response")
    return line[:-2]


async def _read_response(reader: asyncio.StreamReader) -> Any:
    prefix = await reader.readexactly(1)

    if prefix == b"+":
        return (await _read_line(reader)).decode("utf-8")

    if prefix == b"-":
        message = (await _read_line(reader)).decode("utf-8")
        raise PredictionCacheError(message)

    if prefix == b":":
        return int(await _read_line(reader))

    if prefix == b"$":
        length = int(await _read_line(reader))
        if length == -1:
            return None

        payload = await reader.readexactly(length)
        terminator = await reader.readexactly(2)
        if terminator != b"\r\n":
            raise PredictionCacheError("Redis returned a malformed bulk string")
        return payload

    if prefix == b"*":
        count = int(await _read_line(reader))
        if count == -1:
            return None
        return [await _read_response(reader) for _ in range(count)]

    raise PredictionCacheError("Redis returned an unknown response type")
