"""Predictive Heat Forecast API — multi-checkpoint forecasts, accuracy tracking, cost of inaction."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.forecast import (
    generate_site_forecast,
    generate_portfolio_forecast,
    get_forecast_accuracy,
    get_dollars_flagged_summary,
    log_dollars_flagged,
    forecast_to_dict,
    FORECAST_CHECKPOINTS,
    NWS_BANDS,
    CONFIDENCE_BY_LEAD_TIME,
)
from app.services.heat_pl import CompanyPolicy
from app.services.monitoring import metrics

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


class ForecastRequest(BaseModel):
    site_ids: list = []  # Empty = all sites


@router.post("/portfolio")
async def get_portfolio_forecast(req: ForecastRequest = ForecastRequest()):
    """Generate 12-hour predictive forecasts for all sites.
    
    Returns multi-checkpoint timeline (0h, 3h, 6h, 9h, 12h) for each site,
    with cost of inaction and reschedule recommendations.
    """
    span = metrics.start_span("forecast_portfolio")

    try:
        # Get sites
        from app.routers.sites import _sites
        sites = _sites if _sites else []
        if not sites:
            from app.routers.sites import list_sites
            sites = await list_sites()

        # Filter by site_ids if provided
        if req.site_ids:
            sites = [s for s in sites if s.get("site_id") in req.site_ids]

        # Get assessments for base temperatures
        from app.routers.assessment import get_latest_assessments
        assessments = get_latest_assessments()

        # Get company policy for cost calculations
        from app.routers.heat_pl import _get_policy
        policy = _get_policy()

        # Generate forecasts
        forecast = generate_portfolio_forecast(sites, assessments, policy)

        # Log dollars flagged for each site
        for site_forecast in forecast.sites:
            if site_forecast.cost_of_inaction > 0:
                log_dollars_flagged(
                    site_forecast.cost_of_inaction,
                    site_forecast.site_id,
                    f"Predictive alert: {site_forecast.peak_risk_bucket} risk at {site_forecast.peak_hour}:00"
                )

        metrics.end_span(span, "ok")
        return forecast_to_dict(forecast)

    except Exception as e:
        metrics.end_span(span, "error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/site/{site_id}")
async def get_site_forecast(site_id: str):
    """Generate 12-hour predictive forecast for a single site."""
    span = metrics.start_span("forecast_site")

    try:
        # Get site
        from app.routers.sites import _sites
        sites = _sites if _sites else []
        if not sites:
            from app.routers.sites import list_sites
            sites = await list_sites()
        site = next((s for s in sites if s.get("site_id") == site_id), None)

        if not site:
            raise HTTPException(status_code=404, detail=f"Site {site_id} not found")

        # Get base temperature from assessment
        from app.routers.assessment import get_latest_assessments
        assessments = get_latest_assessments()
        assessment = next((a for a in assessments if a.get("site_id") == site_id), None)
        base_temp = assessment.get("temperature_c", 25.0) if assessment else 25.0

        # Get policy
        from app.routers.heat_pl import _get_policy
        policy = _get_policy()

        # Generate forecast
        forecast = generate_site_forecast(
            site_id=site_id,
            site_name=site.get("name", "Unknown"),
            lat=site.get("latitude", 0),
            lon=site.get("longitude", 0),
            base_temp=base_temp,
            policy=policy,
        )

        metrics.end_span(span, "ok")

        return {
            "site_id": forecast.site_id,
            "site_name": forecast.site_name,
            "peak_temp_c": forecast.peak_temp_c,
            "peak_heat_index_c": forecast.peak_heat_index_c,
            "peak_risk_bucket": forecast.peak_risk_bucket,
            "peak_hour": forecast.peak_hour,
            "hours_above_osha": forecast.hours_above_osha,
            "hours_above_danger": forecast.hours_above_danger,
            "cost_of_inaction": forecast.cost_of_inaction,
            "reschedule_savings": forecast.reschedule_savings,
            "reschedule_recommendation": forecast.reschedule_recommendation,
            "overall_confidence": forecast.overall_confidence,
            "overall_confidence_label": forecast.overall_confidence_label,
            "checkpoints": [
                {
                    "hours_from_now": c.hours_from_now,
                    "temp_c": c.temp_c,
                    "heat_index_c": c.heat_index_c,
                    "risk_bucket": c.risk_bucket,
                    "risk_color": c.risk_color,
                    "nws_band": c.nws_band,
                    "nws_description": c.nws_description,
                    "confidence": c.confidence,
                    "confidence_label": c.confidence_label,
                    "recommendation": c.recommendation,
                }
                for c in forecast.checkpoints
            ],
        }

    except HTTPException:
        raise
    except Exception as e:
        metrics.end_span(span, "error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accuracy")
async def get_accuracy(days: int = 30):
    """Get forecast accuracy metrics over the past N days.
    
    Returns self-measured accuracy: what % of past forecasts matched actual conditions.
    """
    return get_forecast_accuracy(days)


@router.get("/dollars-flagged")
async def get_dollars_flagged():
    """Get running total of dollars flagged this quarter.
    
    Shows: 'Shade has flagged $X in avoidable heat cost across your portfolio this quarter.'
    """
    return get_dollars_flagged_summary()


@router.get("/nws-bands")
async def get_nws_bands():
    """Get the NWS Heat Index bands with exact cutoffs and descriptions.
    
    Source: NWS Heat Index Chart (weather.gov/ama/heatindex)
    """
    return {
        "source": "National Weather Service Heat Index Chart",
        "source_url": "https://www.weather.gov/ama/heatindex",
        "bands": NWS_BANDS,
        "risk_classification": [
            {
                "bucket": b["bucket"],
                "range_c": f"{b['min_c']}-{b['max_c']}°C" if b["max_c"] < 100 else f">{b['min_c']}°C",
                "nws_equivalent": b["source"].split("(")[1].rstrip(")") if "(" in b["source"] else b["source"],
                "label": b["label"],
                "source": b["source"],
            }
            for b in [
                {"bucket": "LOW", "min_c": 0, "max_c": 26.7, "label": "Low Risk", "source": "Below NWS Caution (<80°F)"},
                {"bucket": "MEDIUM", "min_c": 26.7, "max_c": 32.2, "label": "Medium Risk", "source": "NWS Caution (80-90°F)"},
                {"bucket": "HIGH", "min_c": 32.2, "max_c": 39.4, "label": "High Risk", "source": "NWS Extreme Caution (90-103°F)"},
                {"bucket": "CRITICAL", "min_c": 39.4, "max_c": 51.1, "label": "Critical Risk", "source": "NWS Danger (103-124°F)"},
                {"bucket": "EXTREME", "min_c": 51.1, "max_c": 999, "label": "Extreme Risk", "source": "NWS Extreme Danger (125°F+)"},
            ]
        ],
        "confidence_levels": CONFIDENCE_BY_LEAD_TIME,
    }
