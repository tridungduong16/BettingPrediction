from __future__ import annotations


class OddsNotConfiguredError(RuntimeError):
    """Raised when an odds provider is not configured."""


class OddsFetchError(RuntimeError):
    """Raised when an odds provider cannot return usable data."""
