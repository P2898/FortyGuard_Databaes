"""Simple in-memory cache with TTL."""

import time
from typing import Any

_cache: dict[str, dict] = {}


def get_cached(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < entry.get("ttl", 30):
        return entry["data"]
    return None


def set_cached(key: str, data: Any, ttl: int = 30):
    _cache[key] = {"data": data, "ts": time.time(), "ttl": ttl}


def clear_cache():
    _cache.clear()
