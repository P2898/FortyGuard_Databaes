"""FortyGuard API integration — submit-then-poll pattern with caching.

Follows the official quickstart client's submit-then-poll pattern.
All endpoints are async task-based — submit, get activity_id, poll status.

Strategy: Use demo data by default for speed. When user explicitly requests
live data, make a single heatmap call and derive per-site temps from it.
Env params are called individually per-site only in site detail view.
"""

import time
import hashlib
import json
import asyncio
from typing import Any
import httpx
from app.config import FORTYGUARD_API_KEY, FORTYGUARD_BASE_URL

# In-memory cache keyed by hash
_cache: dict[str, Any] = {}
CACHE_TTL = 3600  # 1 hour

_TERMINAL_SUCCESS = {"succeeded", "completed"}
_TERMINAL_FAILURE = {"failed", "error"}

# Toggle: set FORTYGUARD_LIVE=true in .env to force live API calls
import os as _os
_FORCE_LIVE = _os.getenv("FORTYGUARD_LIVE", "false").lower() == "true"


def _cache_key(*args) -> str:
    raw = json.dumps(args, sort_keys=True, default=str)
    return hashlib.md5(raw.encode()).hexdigest()


def _get_cached(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < CACHE_TTL:
        return entry["data"]
    return None


def _set_cached(key: str, data: Any):
    _cache[key] = {"data": data, "ts": time.time()}


async def _poll_status(client: httpx.AsyncClient, activity_id: str, max_attempts: int = 30) -> dict:
    """Poll status endpoint until task terminates. Returns result dict."""
    for attempt in range(max_attempts):
        delay = min(3 * (2 ** (attempt // 2)), 20)
        await asyncio.sleep(delay)
        try:
            status_resp = await client.get(f"{FORTYGUARD_BASE_URL}/v1/status/{activity_id}")
        except httpx.RequestError:
            continue
        if status_resp.status_code == 404:
            continue
        if status_resp.status_code != 200:
            continue
        status_data = status_resp.json()
        data = status_data.get("data", status_data)
        status = str(data.get("status", "")).lower()
        if status in _TERMINAL_FAILURE:
            raise ValueError(f"FortyGuard task failed: {activity_id}")
        if status in _TERMINAL_SUCCESS:
            return data.get("result", data)
    raise TimeoutError(f"FortyGuard task timed out: {activity_id}")


async def submit_heatmap(
    polygon: dict,
    start_date: str,
    start_time: str,
    analytic: str = "tcm",
    granularity: int = 100,
    threshold: float = 32.2,
    direction: str = "above",
) -> dict:
    """Submit a heatmap request and poll until completion.

    Falls back to demo data if API key is missing, request fails, or times out.
    """
    key = _cache_key(polygon, start_date, start_time, analytic)
    cached = _get_cached(key)
    if cached is not None:
        return cached

    # Use demo data unless live mode is explicitly requested
    if not FORTYGUARD_API_KEY or not _FORCE_LIVE:
        demo = _demo_heatmap(polygon, start_date, start_time)
        _set_cached(key, demo)
        return demo

    headers = {"api-key": FORTYGUARD_API_KEY, "Content-Type": "application/json"}
    body: dict[str, Any] = {
        "polygon_aoi": polygon,
        "date_time": {
            "start_date": start_date,
            "start_time": start_time,
            "filter_type": 1,
        },
        "granularity": granularity,
        "analytic_type": analytic,
    }
    if analytic in ("exceedance", "persistence"):
        body["threshold"] = threshold
        body["direction"] = direction

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(f"{FORTYGUARD_BASE_URL}/v1/heatmap", headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            print(f"[FortyGuard] Heatmap submission error: {e}")
            demo = _demo_heatmap(polygon, start_date, start_time)
            _set_cached(key, demo)
            return demo

        if data.get("error"):
            print(f"[FortyGuard] Heatmap API error: {data.get('message', '')}")
            demo = _demo_heatmap(polygon, start_date, start_time)
            _set_cached(key, demo)
            return demo

        activity_id = data.get("data", {}).get("activity_id") or data.get("activity_id")
        if not activity_id:
            print(f"[FortyGuard] No activity_id in response")
            demo = _demo_heatmap(polygon, start_date, start_time)
            _set_cached(key, demo)
            return demo

        try:
            result = await _poll_status(client, activity_id)
            _set_cached(key, result)
            return result
        except (ValueError, TimeoutError) as e:
            print(f"[FortyGuard] Heatmap poll error: {e}")
            demo = _demo_heatmap(polygon, start_date, start_time)
            _set_cached(key, demo)
            return demo


async def submit_env_params(lat: float, lon: float, date: str, time_str: str, temperature: float = 30.0) -> dict:
    """Submit environmental parameters request.

    Falls back to demo data if API is unavailable.
    """
    if not FORTYGUARD_API_KEY or not _FORCE_LIVE:
        return _demo_env_params(lat, lon)

    headers = {"api-key": FORTYGUARD_API_KEY, "Content-Type": "application/json"}
    body = {
        "latitude": lat,
        "longitude": lon,
        "temperature": temperature,
        "date_time": {
            "start_date": date,
            "start_time": time_str,
            "filter_type": 1,
        },
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(f"{FORTYGUARD_BASE_URL}/v1/env_params", headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            print(f"[FortyGuard] env_params error: {e}")
            return _demo_env_params(lat, lon)

        if data.get("error"):
            return _demo_env_params(lat, lon)

        activity_id = data.get("data", {}).get("activity_id") or data.get("activity_id")
        if not activity_id:
            result_data = data.get("data", data)
            if any(k in json.dumps(result_data) for k in ["heat_index", "humidity"]):
                return result_data
            return _demo_env_params(lat, lon)

        try:
            result = await _poll_status(client, activity_id)
            return result
        except (ValueError, TimeoutError):
            return _demo_env_params(lat, lon)


def _demo_heatmap(polygon: dict, start_date: str, start_time: str) -> dict:
    """Generate realistic Bay Area demo heatmap data.

    Coastal sites (SF, Oakland) are cooler; inland sites (Tracy, Livermore, Concord)
    are much hotter. This mirrors FortyGuard's hyperlocal differentiator.
    """
    import random
    random.seed(hash((start_date, start_time)))  # Deterministic per time

    coords = polygon.get("features", [{}])[0].get("geometry", {}).get("coordinates", [[]])[0]
    if coords and len(coords) >= 4:
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        min_lon, max_lon = min(lons), max(lons)
        min_lat, max_lat = min(lats), max(lats)
    else:
        min_lon, max_lon = -122.5, -121.4
        min_lat, max_lat = 37.3, 38.3

    features = []

    # Real Bay Area locations with known temperatures
    BAY_AREA_PROFILES = [
        # Coastal (cool)
        {"name": "SF", "lon": -122.4, "lat": 37.8, "base_temp": 18},
        {"name": "Oakland", "lon": -122.27, "lat": 37.8, "base_temp": 20},
        {"name": "Berkeley", "lon": -122.27, "lat": 37.87, "base_temp": 20},
        # Mid-bay
        {"name": "San Mateo", "lon": -122.3, "lat": 37.56, "base_temp": 22},
        {"name": "Fremont", "lon": -121.99, "lat": 37.55, "base_temp": 25},
        {"name": "San Jose", "lon": -121.89, "lat": 37.34, "base_temp": 28},
        # Inland (hot)
        {"name": "Concord", "lon": -122.03, "lat": 37.98, "base_temp": 34},
        {"name": "Fairfield", "lon": -122.04, "lat": 38.25, "base_temp": 36},
        {"name": "Livermore", "lon": -121.91, "lat": 37.69, "base_temp": 37},
        {"name": "Tracy", "lon": -121.43, "lat": 37.74, "base_temp": 39},
    ]

    # Add grid points from profiles that fall within bounding box
    for profile in BAY_AREA_PROFILES:
        if min_lon <= profile["lon"] <= max_lon and min_lat <= profile["lat"] <= max_lat:
            temp = profile["base_temp"] + random.uniform(-1.5, 1.5)
            features.append({
                "geometry": {"coordinates": [profile["lon"], profile["lat"]]},
                "properties": {
                    "average_temperature": round(temp, 1),
                    "max_temperature": round(temp + random.uniform(1, 3), 1),
                    "min_temperature": round(temp - random.uniform(1, 3), 1),
                },
            })

    # Fill in additional grid points for density
    for i in range(25):
        lon = min_lon + random.random() * (max_lon - min_lon)
        lat = min_lat + random.random() * (max_lat - min_lat)

        # Temperature based on distance from coast (longitude)
        coast_distance = abs(lon - (-122.4))
        if lon < -122.2:
            temp = 18 + random.random() * 5 + coast_distance * 20
        elif lon < -122.0:
            temp = 22 + random.random() * 6 + coast_distance * 15
        else:
            temp = 32 + random.random() * 10 + coast_distance * 8
        temp = min(temp, 45)

        features.append({
            "geometry": {"coordinates": [lon, lat]},
            "properties": {
                "average_temperature": round(temp, 1),
                "max_temperature": round(temp + random.random() * 3, 1),
                "min_temperature": round(temp - random.random() * 3, 1),
            },
        })

    temps = [f["properties"]["average_temperature"] for f in features]

    return {
        "map_data": {"features": features},
        "stats_data": {
            "temperature_stats": {
                "min": round(min(temps), 1),
                "max": round(max(temps), 1),
                "mean": round(sum(temps) / len(temps), 1),
                "units": "celsius",
            }
        },
    }


def _demo_env_params(lat: float, lon: float) -> dict:
    """Generate realistic demo environmental parameters based on location."""
    import random
    random.seed(hash((lat, lon)))  # Deterministic per location

    is_coastal = lon < -122.15

    if is_coastal:
        base_temp = 19 + random.random() * 4
        humidity = 65 + random.random() * 20
        solar = 300 + random.random() * 300
    else:
        base_temp = 33 + random.random() * 8
        humidity = 20 + random.random() * 20
        solar = 600 + random.random() * 400

    hi = base_temp + 0.5 * humidity / 100 * (base_temp - 26)

    return {
        "heat_index_celsius": round(hi, 1),
        "apparent_temperature_celsius": round(base_temp + random.random() * 2, 1),
        "wet_bulb_temperature_celsius": round(base_temp - 5 - random.random() * 5, 1),
        "relative_humidity_percent": round(humidity, 1),
        "precipitation_mm": round(random.random() * 0.5, 2),
        "cloud_cover_octas": round(random.random() * 4),
        "air_quality:idx": round(20 + random.random() * 60),
        "solar_irradiance": round(solar, 1),
        "elevation": round(5 + random.random() * 100, 1),
    }
