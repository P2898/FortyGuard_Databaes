"""Risk assessment API — fleet dashboard, site detail, heatmap."""

import time
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.fortyguard import submit_heatmap, submit_env_params
from app.services.risk_scoring import classify_risk, compute_exceedance_hours, compute_persistence_hours, THRESHOLDS
from app.database import get_service_client, is_configured

router = APIRouter(prefix="/api/assessment", tags=["assessment"])


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


@router.post("/fleet", response_model=AssessmentResponse)
async def assess_fleet(req: AssessRequest):
    """Assess risk for all (or selected) sites."""
    start = time.time()

    target_sites = _get_sites()
    if req.site_ids:
        target_sites = [s for s in target_sites if s["site_id"] in req.site_ids]
    if not target_sites:
        raise HTTPException(status_code=400, detail="No sites to assess")

    # Build bounding box polygon for heatmap
    lats = [s["latitude"] for s in target_sites]
    lons = [s["longitude"] for s in target_sites]
    pad = 0.02
    polygon = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [min(lons) - pad, min(lats) - pad],
                    [max(lons) + pad, min(lats) - pad],
                    [max(lons) + pad, max(lats) + pad],
                    [min(lons) - pad, max(lats) + pad],
                    [min(lons) - pad, min(lats) - pad],
                ]]
            }
        }]
    }

    # Get heatmap data
    date_str = req.date or datetime.now().strftime("%Y-%m-%d")
    time_str = req.time or datetime.now().strftime("%H:%M")

    heatmap = await submit_heatmap(polygon, date_str, time_str)
    tiles = heatmap.get("map_data", {}).get("features", [])
    stats = heatmap.get("stats_data", {}).get("temperature_stats", {})

    # Assess each site
    assessments = []
    threshold = THRESHOLDS.get(req.threshold_key, THRESHOLDS["OSHA_ACTION"])

    for site in target_sites:
        # Find nearest tile
        nearest_temp = 32.0
        nearest_heat_index = 33.0
        min_dist = float("inf")
        for tile in tiles:
            coords = tile.get("geometry", {}).get("coordinates", [])
            if len(coords) >= 2:
                tlon, tlat = coords[0] if isinstance(coords[0], list) else coords
                dist = ((site["latitude"] - tlat) ** 2 + (site["longitude"] - tlon) ** 2) ** 0.5
                if dist < min_dist:
                    min_dist = dist
                    nearest_temp = tile.get("properties", {}).get("average_temperature", 32.0)
                    nearest_heat_index = tile.get("properties", {}).get("max_temperature", nearest_temp + 1)

        # Generate hourly temps for exceedance/persistence
        hourly_temps = [nearest_temp + (i % 3 - 1) * 0.5 for i in range(12)]
        exceedance = compute_exceedance_hours(hourly_temps, threshold["value_c"])
        persistence = compute_persistence_hours(hourly_temps, threshold["value_c"])

        risk = classify_risk(nearest_temp, nearest_heat_index, exceedance, persistence, req.threshold_key)

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

        # Save to audit log
        _save_assessment(assessment.model_dump())
        assessments.append(assessment)

    # Sort by risk (CRITICAL first)
    bucket_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    assessments.sort(key=lambda a: bucket_order.get(a.risk_bucket, 4))

    elapsed_ms = int((time.time() - start) * 1000)

    return AssessmentResponse(
        sites=assessments,
        stats=stats,
        assessed_at=datetime.utcnow().isoformat(),
        response_time_ms=elapsed_ms,
        cached=False,
    )


@router.get("/site/{site_id}")
async def get_site_detail(site_id: str, date: str = "", time: str = ""):
    """Get detailed assessment for a single site."""
    sites = _get_sites()
    site = next((s for s in sites if s["site_id"] == site_id), None)
    if not site:
        raise HTTPException(status_code=404, detail=f"Site {site_id} not found")

    date_str = date or datetime.now().strftime("%Y-%m-%d")
    time_str = time or datetime.now().strftime("%H:%M")

    env = await submit_env_params(site["latitude"], site["longitude"], date_str, time_str)

    # Simulate 12-hour trend
    hourly_temps = []
    for h in range(12):
        base = env.get("heat_index", 32) + (h - 6) * 0.8
        hourly_temps.append(round(base, 1))

    threshold = THRESHOLDS["OSHA_ACTION"]
    exceedance = compute_exceedance_hours(hourly_temps, threshold["value_c"])
    persistence = compute_persistence_hours(hourly_temps, threshold["value_c"])
    max_temp = max(hourly_temps)
    avg_temp = sum(hourly_temps) / len(hourly_temps)

    risk = classify_risk(max_temp, max_temp + 1, exceedance, persistence)

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
