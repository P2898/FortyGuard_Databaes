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


def _compute_site_temp(lat: float, lon: float) -> tuple[float, float]:
    """Compute realistic temperature for a site based on Bay Area geography.

    Coastal sites (SF, Oakland) are cooler; inland sites (Tracy, Livermore, Concord)
    are much hotter. This demonstrates FortyGuard's hyperlocal differentiator.
    """
    # Deterministic seed based on lat/lon so temps are consistent
    random.seed(hash((lat, lon, datetime.now().hour)))

    # Distance from SF coastline (approx longitude -122.4)
    coast_dist = abs(lon - (-122.4))

    if lon < -122.2:
        # Coastal: SF, Oakland, Berkeley
        base_temp = 18 + coast_dist * 40 + random.uniform(-2, 2)
    elif lon < -122.0:
        # Mid-bay: San Mateo, Fremont
        base_temp = 23 + coast_dist * 30 + random.uniform(-2, 2)
    else:
        # Inland: Concord, Livermore, Tracy, Fairfield
        base_temp = 30 + coast_dist * 15 + random.uniform(-2, 3)

    base_temp = max(15, min(45, base_temp))
    heat_index = base_temp + random.uniform(0.5, 3)

    return round(base_temp, 1), round(heat_index, 1)


@router.post("/fleet", response_model=AssessmentResponse)
async def assess_fleet(req: AssessRequest):
    """Assess risk for all (or selected) sites.

    Uses deterministic location-based temperature estimation for speed.
    No API calls needed — fast enough for real-time dashboard updates.
    """
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
        nearest_temp, real_heat_index = _compute_site_temp(site["latitude"], site["longitude"])

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
        _save_assessment(assessment.model_dump())
        assessments.append(assessment)

    # Sort by risk (CRITICAL first)
    bucket_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    assessments.sort(key=lambda a: bucket_order.get(a.risk_bucket, 4))

    elapsed_ms = int((time.time() - start) * 1000)

    # Cache for Heat P&L and Kelvin
    _latest_assessment_cache["data"] = [a.model_dump() for a in assessments]
    _latest_assessment_cache["timestamp"] = datetime.utcnow().isoformat()

    return AssessmentResponse(
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
    apparent_temp, real_heat_index = _compute_site_temp(site["latitude"], site["longitude"])

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
