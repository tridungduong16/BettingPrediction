from __future__ import annotations

from typing import Protocol

from app.models.live_events import LiveMatchSnapshot


class LiveEventsConnector(Protocol):
    provider_name: str

    @property
    def configured(self) -> bool:
        """Whether the connector has enough credentials to call its provider."""

    async def fetch_snapshot(self, *, match_id: str, provider_fixture_id: str) -> LiveMatchSnapshot:
        """Fetch and normalize one live match snapshot."""


class LiveEventsNotConfiguredError(RuntimeError):
    """Raised when the selected live events provider has not been configured."""


class LiveEventsFetchError(RuntimeError):
    """Raised when the selected live events provider cannot return data."""

