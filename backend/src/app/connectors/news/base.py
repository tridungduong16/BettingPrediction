from __future__ import annotations


class NewsSearchNotConfiguredError(RuntimeError):
    """Raised when a news search provider is not configured."""


class NewsSearchFetchError(RuntimeError):
    """Raised when a news search provider cannot return usable data."""

