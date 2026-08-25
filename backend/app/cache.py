"""Simple in-memory TTL cache for backend responses."""

import time
from typing import Any

_cache: dict[str, tuple[float, Any]] = {}
DEFAULT_TTL = 30  # seconds


def cache_get(key: str, ttl: int = DEFAULT_TTL) -> Any | None:
    """Return cached value if still fresh, else None."""
    if key in _cache:
        ts, val = _cache[key]
        if time.time() - ts < ttl:
            return val
    return None


def cache_set(key: str, value: Any) -> None:
    """Store value with current timestamp."""
    _cache[key] = (time.time(), value)


def cache_clear(key: str | None = None) -> None:
    """Clear a specific key or all cache."""
    if key:
        _cache.pop(key, None)
    else:
        _cache.clear()
