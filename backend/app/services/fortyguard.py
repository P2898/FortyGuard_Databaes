"""FortyGuard API integration — submit-then-poll pattern with caching."""

import time
import hashlib
import json
from typing import Any
import httpx
from app.config import FORTYGUARD_API_KEY, FORTYGUARD_BASE_URL

# Simple in-memory cache keyed by (area_hash, date, hour)
_cache: dict[str, Any] = {}
CACHE_TTL = 3600  # 1 hour


def _cache_key(polygon: dict, date: str, time_str: str, analytic: str) -> str:
    raw = json.dumps({"poly": polygon, "date": date, "time": time_str, "analytic": analytic}, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


def _get_cached(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < CACHE_TTL:
        return entry["data"]
    return None


def _set_cached(key: str, data: Any):
    _cache[key] = {"data": data, "ts": time.time()}


async def submit_heatmap(
    polygon: dict,
    start_date: str,
    start_time: str,
    analytic: str = "time_of_measure",
    granularity: int = 100,
) -> dict:
    """Submit a heatmap request and poll until completion."""
    key = _cache_key(polygon, start_date, start_time, analytic)
    cached = _get_cached(key)
    if cached is not None:
        return cached

    if not FORTYGUARD_API_KEY:
        # Return demo data when no API key
        return _demo_heatmap(polygon, start_date, start_time)

    headers = {"api-key": FORTYGUARD_API_KEY, "Content-Type": "application/json"}
    body = {
        "polygon_aoi": polygon,
        "date_time": {"start_date": start_date, "start_time": start_time, "filter_type": 1},
        "analytic_type": analytic,
        "granularity": granularity,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        # Submit
        resp = await client.post(f"{FORTYGUARD_BASE_URL}/v1/heatmap", headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()
        activity_id = data.get("data", {}).get("activity_id") or data.get("activity_id")
        if not activity_id:
            raise ValueError("FortyGuard did not return an activity_id")

        # Poll
        for attempt in range(40):
            await _backoff(attempt)
            status_resp = await client.get(
                f"{FORTYGUARD_BASE_URL}/v1/status/{activity_id}", headers=headers
            )
            if status_resp.status_code == 404:
                continue
            status_data = status_resp.json()
            status = str(status_data.get("data", {}).get("status") or status_data.get("status", "")).lower()
            if status in ("failed", "error"):
                raise ValueError(f"FortyGuard task failed: {activity_id}")
            if status in ("completed", "succeeded"):
                result = status_data.get("data", {}).get("result") or status_data.get("result")
                _set_cached(key, result)
                return result

    raise TimeoutError("FortyGuard task timed out")


async def _backoff(attempt: int):
    delay = min(3 * (2 ** attempt), 30)
    import asyncio
    await asyncio.sleep(delay)


async def submit_env_params(lat: float, lon: float, date: str, time_str: str) -> dict:
    """Submit environmental parameters request."""
    if not FORTYGUARD_API_KEY:
        return _demo_env_params(lat, lon)

    headers = {"api-key": FORTYGUARD_API_KEY, "Content-Type": "application/json"}
    body = {
        "location": {"lat": lat, "lon": lon},
        "date_time": {"start_date": date, "start_time": time_str, "filter_type": 1},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{FORTYGUARD_BASE_URL}/v1/env_params", headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()
        activity_id = data.get("data", {}).get("activity_id") or data.get("activity_id")
        if not activity_id:
            return _demo_env_params(lat, lon)

        for attempt in range(20):
            await _backoff(attempt)
            status_resp = await client.get(
                f"{FORTYGUARD_BASE_URL}/v1/status/{activity_id}", headers=headers
            )
            if status_resp.status_code == 404:
                continue
            status_data = status_resp.json()
            status = str(status_data.get("data", {}).get("status") or status_data.get("status", "")).lower()
            if status in ("completed", "succeeded"):
                return status_data.get("data", {}).get("result") or status_data.get("result", {})

    return _demo_env_params(lat, lon)


def _demo_heatmap(polygon: dict, start_date: str, start_time: str) -> dict:
    """Generate demo heatmap data when no API key is available."""
    import random
    features = []
    # Get bounding box from polygon
    coords = polygon.get("features", [{}])[0].get("geometry", {}).get("coordinates", [[]])[0]
    if coords and len(coords) >= 4:
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        min_lon, max_lon = min(lons), max(lons)
        min_lat, max_lat = min(lats), max(lats)
    else:
        min_lon, max_lon = -122.0, -121.8
        min_lat, max_lat = 37.3, 37.4

    for i in range(20):
        lon = min_lon + random.random() * (max_lon - min_lon)
        lat = min_lat + random.random() * (max_lat - min_lat)
        temp = 28 + random.random() * 12  # 28-40°C range
        features.append({
            "geometry": {"coordinates": [lon, lat]},
            "properties": {
                "average_temperature": round(temp, 1),
                "max_temperature": round(temp + random.random() * 3, 1),
            },
        })

    return {
        "map_data": {"features": features},
        "stats_data": {
            "temperature_stats": {
                "min": round(min(f["properties"]["average_temperature"] for f in features), 1),
                "max": round(max(f["properties"]["average_temperature"] for f in features), 1),
                "mean": round(sum(f["properties"]["average_temperature"] for f in features) / len(features), 1),
            }
        },
    }


def _demo_env_params(lat: float, lon: float) -> dict:
    """Generate demo environmental parameters."""
    import random
    return {
        "heat_index": round(30 + random.random() * 15, 1),
        "humidity": round(30 + random.random() * 50, 1),
        "solar_irradiance": round(400 + random.random() * 600, 1),
        "aqi": round(20 + random.random() * 80),
    }
