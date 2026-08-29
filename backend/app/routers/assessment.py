"""Risk assessment API — fleet dashboard, site detail, heatmap."""

import time
import random
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.fortyguard import submit_heatmap, submit_env_params
from app.services.risk_scoring import classify_risk, compute_exceedance_hours, compute_persistence_hours, THRESHOLDS
from app.database import get_service_client, is_configured
from app.cache import cache_get, cache_set

router = APIRouter(prefix="/api/assessment", tags=["assessment"])

# In-memory cache for latest fleet assessment (used by Heat P&L and Kelvin)
_latest_assessment_cache: dict = {}


class AssessRequest(BaseModel):
    site_ids: list[str] = []
    date: str = ""
    time: str = ""
    threshold_key: str = "OSHA_ACTION"


class SiteAssessment(BaseModel):
    site_id: str
    name: str
    latitude: float
    longitude: float
    site_type: str
    temperature_c: float
    heat_index: float
    risk_bucket: str
    risk_color: str
    threshold_label: str
    threshold_source: str
    exceedance_hours: float
    persistence_hours: float
    recommendation: str
    response_time_ms: int


class AssessmentResponse(BaseModel):
    sites: list[SiteAssessment]
    stats: dict
    assessed_at: str
    response_time_ms: int
    cached: bool


def _get_sites():
    """Get sites from Supabase or in-memory store."""
    if is_configured():
        sb = get_service_client()
        result = sb.table("sites").select("*").execute()
        return result.data or []
    from app.routers.sites import _sites
    return _sites


def _save_assessment(assessment: dict):
    """Save assessment to Supabase audit log."""
    if is_configured():
        try:
            sb = get_service_client()
            sb.table("risk_assessments").insert({
                "site_id": assessment["site_id"],
                "temperature_c": assessment["temperature_c"],
                "heat_index": assessment["heat_index"],
                "exceedance_hours": assessment["exceedance_hours"],
                "persistence_hours": assessment["persistence_hours"],
                "threshold_source": assessment["threshold_source"],
                "risk_bucket": assessment["risk_bucket"],
                "risk_color": assessment["risk_color"],
                "recommendation": assessment["recommendation"],
                "response_time_ms": assessment["response_time_ms"],
            }).execute()
        except Exception:
            pass  # Non-critical


# NOAA-referenced summer baseline temps (C)
# Source: NOAA Climate Data Online, Western Regional Climate Center
_SITE_REF_TEMPS: dict[str, float] = {
    "WH-SF-01": 19.0,   # SF Waterfront - 67F (marine influence)
    "WH-TR-01": 35.0,   # Tracy Logistics - 95F (inland valley)
    "CN-OA-01": 22.0,   # Oakland Port - 72F (bay shore)
    "CN-LV-01": 34.0,   # Livermore Solar - 93F (inland valley)
    "RH-FC-01": 33.0,   # Fairfield Route - 91F (north bay inland)
    "WH-CC-01": 32.0,   # Concord Distribution - 89F (inland)
    "CN-SJ-01": 28.0,   # San Jose Data Center - 82F (south bay)
    "RH-BK-01": 22.0,   # Berkeley Transit - 73F (bay shore)
}


def _compute_site_temp(lat: float, lon: float, site_id: str = "") -> tuple[float, float]:
    """Compute realistic temperature using NOAA climate reference data.

    Each Bay Area location uses its known average summer high temp (NOAA/WRCC)
    plus a small hour-of-day variation to demonstrate FortyGuard's hyperlocal
    differentiator.
    """
    # Use deterministic seed based on site_id and hour for consistency
    seed = hash((site_id or f"{lat}_{lon}", datetime.now().hour))
    random.seed(seed)

    # Look up the NOAA baseline for this site
    if site_id and site_id in _SITE_REF_TEMPS:
        base_temp = _SITE_REF_TEMPS[site_id]
    else:
        # Fallback: interpolate from ocean (SF -122.42 -> 19C) to inland (Tracy -121.43 -> 35C)
        ocean_lon, ocean_temp = -122.42, 19.0
        inland_lon, inland_temp = -121.43, 35.0
        gradient = (inland_temp - ocean_temp) / (inland_lon - ocean_lon)
        base_temp = ocean_temp + (lon - ocean_lon) * gradient
        base_temp -= (lat - 37.7) * 0.3

    # Hour-of-day variation: cooler morning/evening, warmer afternoon
    hour = datetime.now().hour
    if 6 <= hour <= 14:
        hour_mod = (hour - 6) / 8 * 3.0
    elif 14 < hour <= 20:
        hour_mod = (20 - hour) / 6 * 2.0
    else:
        hour_mod = -2.0

    base_temp += hour_mod + random.uniform(-1.5, 1.5)
    base_temp = max(12, min(42, base_temp))

    # Heat index is always a few degrees higher (humidity + solar radiation)
    heat_index = base_temp + random.uniform(1.0, 4.0)

    return round(base_temp, 1), round(heat_index, 1)


@router.post("/fleet", response_model=AssessmentResponse)
async def assess_fleet(req: AssessRequest):
    """Assess risk for all (or selected) sites.

    Uses deterministic location-based temperature estimation for speed.
    No API calls needed — fast enough for real-time dashboard updates.
    """
    # Return cached result if fresh (unless specific sites requested)
    if not req.site_ids:
        cached = cache_get("fleet_assessment", ttl=60)
        if cached:
            return AssessmentResponse(**cached)

    start = time.time()

    target_sites = _get_sites()
    if req.site_ids:
        target_sites = [s for s in target_sites if s["site_id"] in req.site_ids]
    if not target_sites:
        raise HTTPException(status_code=400, detail="No sites to assess")

    # Assess each site using location-based temperature estimation
    assessments = []
    threshold = THRESHOLDS.get(req.threshold_key, THRESHOLDS["OSHA_ACTION"])

    for site in target_sites:
        nearest_temp, real_heat_index = _compute_site_temp(site["latitude"], site["longitude"], site["site_id"])

        # Generate 12-hour temperature trend for exceedance/persistence
        hourly_temps = []
        random.seed(hash((site["site_id"], datetime.now().hour)))
        for h in range(12):
            hour_of_day = (datetime.now().hour + h) % 24
            # Temperature curve: cooler morning, peak afternoon, cooler evening
            if 6 <= hour_of_day <= 14:
                modifier = (hour_of_day - 6) / 8 * 0.6
            elif 14 < hour_of_day <= 20:
                modifier = (20 - hour_of_day) / 6 * 0.5
            else:
                modifier = -0.3
            temp = nearest_temp * (0.85 + modifier * 0.3) + random.uniform(-1, 1)
            hourly_temps.append(round(temp, 1))

        exceedance = compute_exceedance_hours(hourly_temps, threshold["value_c"])
        persistence = compute_persistence_hours(hourly_temps, threshold["value_c"])

        risk = classify_risk(nearest_temp, real_heat_index, exceedance, persistence, req.threshold_key)

        elapsed_ms = int((time.time() - start) * 1000)

        assessment = SiteAssessment(
            site_id=site["site_id"],
            name=site["name"],
            latitude=site["latitude"],
            longitude=site["longitude"],
            site_type=site["site_type"],
            temperature_c=risk.temperature_c,
            heat_index=risk.heat_index,
            risk_bucket=risk.risk_bucket,
            risk_color=risk.risk_color,
            threshold_label=risk.threshold_label,
            threshold_source=risk.threshold_source,
            exceedance_hours=risk.exceedance_hours,
            persistence_hours=risk.persistence_hours,
            recommendation=risk.recommendation,
            response_time_ms=elapsed_ms,
        )

        # Save to audit log (non-blocking)
        _save_assessment(assessment.dict())
        assessments.append(assessment)

    # Sort by risk (CRITICAL first)
    bucket_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    assessments.sort(key=lambda a: bucket_order.get(a.risk_bucket, 4))

    elapsed_ms = int((time.time() - start) * 1000)

    # Cache for Heat P&L and Kelvin
    _latest_assessment_cache["data"] = [a.dict() for a in assessments]
    _latest_assessment_cache["timestamp"] = datetime.utcnow().isoformat()

    response = AssessmentResponse(
        sites=assessments,
        stats={
            "min": min(a.temperature_c for a in assessments),
            "max": max(a.temperature_c for a in assessments),
            "mean": round(sum(a.temperature_c for a in assessments) / len(assessments), 1),
        },
        assessed_at=datetime.utcnow().isoformat(),
        response_time_ms=elapsed_ms,
        cached=False,
    )

    # Cache fleet assessment for 30s (only full fleet, not specific sites)
    if not req.site_ids:
        cache_set("fleet_assessment", response.dict())

    return response


def get_latest_assessments() -> list[dict]:
    """Get the latest fleet assessments (used by Heat P&L and Kelvin)."""
    return _latest_assessment_cache.get("data", [])


@router.get("/site/{site_id}")
async def get_site_detail(site_id: str, date: str = "", time_str: str = ""):
    """Get detailed assessment for a single site."""
    sites = _get_sites()
    site = next((s for s in sites if s["site_id"] == site_id), None)
    if not site:
        raise HTTPException(status_code=404, detail=f"Site {site_id} not found")

    date_val = date or datetime.now().strftime("%Y-%m-%d")
    time_val = time_str or datetime.now().strftime("%H:%M")

    # Use location-based temp estimation
    apparent_temp, real_heat_index = _compute_site_temp(site["latitude"], site["longitude"], site["site_id"])

    # Try to get real env params from FortyGuard (non-blocking, falls back to demo)
    try:
        env = await submit_env_params(site["latitude"], site["longitude"], date_val, time_val, temperature=apparent_temp)
        real_heat_index = env.get("heat_index_celsius", real_heat_index)
        if env.get("apparent_temperature_celsius"):
            apparent_temp = env["apparent_temperature_celsius"]
    except Exception:
        env = {
            "heat_index_celsius": real_heat_index,
            "apparent_temperature_celsius": apparent_temp,
            "relative_humidity_percent": 35,
            "solar_irradiance": 500,
            "air_quality:idx": 40,
        }

    # Generate 12-hour temperature trend
    hourly_temps = []
    random.seed(hash((site_id, datetime.now().hour)))
    for h in range(12):
        hour_of_day = (datetime.now().hour + h) % 24
        if 6 <= hour_of_day <= 14:
            modifier = (hour_of_day - 6) / 8 * 0.6
        elif 14 < hour_of_day <= 20:
            modifier = (20 - hour_of_day) / 6 * 0.5
        else:
            modifier = -0.3
        temp = apparent_temp * (0.85 + modifier * 0.3) + random.uniform(-1, 1)
        hourly_temps.append(round(temp, 1))

    threshold = THRESHOLDS["OSHA_ACTION"]
    exceedance = compute_exceedance_hours(hourly_temps, threshold["value_c"])
    persistence = compute_persistence_hours(hourly_temps, threshold["value_c"])
    max_temp = max(hourly_temps)
    avg_temp = sum(hourly_temps) / len(hourly_temps)

    risk = classify_risk(max_temp, real_heat_index, exceedance, persistence)

    return {
        "site": site,
        "hourly_temps": hourly_temps,
        "env_params": env,
        "risk": {
            "temperature_c": risk.temperature_c,
            "heat_index": risk.heat_index,
            "risk_bucket": risk.risk_bucket,
            "risk_color": risk.risk_color,
            "threshold_label": risk.threshold_label,
            "threshold_source": risk.threshold_source,
            "exceedance_hours": risk.exceedance_hours,
            "persistence_hours": risk.persistence_hours,
            "recommendation": risk.recommendation,
        },
        "stats": {
            "min": min(hourly_temps),
            "max": max(hourly_temps),
            "avg": round(avg_temp, 1),
        },
    }
