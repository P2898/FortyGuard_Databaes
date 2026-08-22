"""Kelvin API — voice/text safety assistant, backed by Supabase audit log."""

from fastapi import APIRouter
from pydantic import BaseModel
from app.services.kelvin import match_intent, phrase_response
from app.services.heat_pl import compute_heat_pl, CompanyPolicy
from app.database import get_service_client, is_configured

router = APIRouter(prefix="/api/kelvin", tags=["kelvin"])


class KelvinRequest(BaseModel):
    message: str


class KelvinResponse(BaseModel):
    intent: str
    response: str
    data: dict
    confidence: float


def _get_sites():
    """Get sites from Supabase or in-memory."""
    if is_configured():
        sb = get_service_client()
        result = sb.table("sites").select("*").execute()
        return result.data or []
    from app.routers.sites import _sites
    return _sites


def _get_latest_assessment(site_id: str):
    """Get latest assessment for a site from Supabase."""
    if is_configured():
        sb = get_service_client()
        result = sb.table("risk_assessments").select("*").eq("site_id", site_id).order("timestamp", desc=True).limit(1).execute()
        if result.data:
            return result.data[0]
    return None


def _get_riskiest_site():
    """Get the highest-risk site from the latest assessments."""
    if is_configured():
        sb = get_service_client()
        result = sb.table("risk_assessments").select("*").order("timestamp", desc=True).limit(50).execute()
        if result.data:
            risk_order = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
            assessments = sorted(result.data, key=lambda a: risk_order.get(a.get("risk_bucket", "LOW"), 0), reverse=True)
            return assessments[0] if assessments else None
    return None


@router.post("", response_model=KelvinResponse)
async def ask_kelvin(req: KelvinRequest):
    """Process a user query through Kelvin's intent router."""
    match = match_intent(req.message)
    intent = match["intent"]
    params = match["params"]
    confidence = match["confidence"]

    data = {}

    if intent == "site_safety":
        site_id = params.get("site_id", "")
        assessment = _get_latest_assessment(site_id)
        if assessment:
            data = {"site_id": site_id, "temperature_c": assessment.get("temperature_c"), "risk_bucket": assessment.get("risk_bucket")}
        else:
            data = {"site_id": site_id, "temperature_c": "N/A", "risk_bucket": "UNKNOWN"}

    elif intent == "riskiest_site":
        assessment = _get_riskiest_site()
        if assessment:
            data = {"site_id": assessment.get("site_id"), "temperature_c": assessment.get("temperature_c"), "risk_bucket": assessment.get("risk_bucket")}
        else:
            data = {"site_id": "none", "temperature_c": 0, "risk_bucket": "LOW"}

    elif intent == "coolest_route":
        data = {
            "origin": params.get("origin", "unknown"),
            "destination": params.get("destination", "unknown"),
            "temp_delta_f": 6,
            "time_delta_min": 4,
        }

    elif intent == "heat_cost":
        policy = CompanyPolicy(hazard_pay_rate_per_hr=25.0, wage_rate_per_hr=35.0, contract_day_rate=5000.0)
        pl = compute_heat_pl(high_hours=8, critical_hours=3, hours_avoided=5, exceedance_days=2, policy=policy)
        data = {"total_cost": pl.total_cost}

    elif intent == "site_temperature":
        site_id = params.get("site_id", "")
        assessment = _get_latest_assessment(site_id)
        if assessment:
            data = {"site_id": site_id, "temperature_c": assessment.get("temperature_c"), "heat_index": assessment.get("heat_index")}
        else:
            data = {"site_id": site_id, "temperature_c": "N/A", "heat_index": "N/A"}

    elif intent == "risk_count":
        bucket = params.get("bucket", "CRITICAL")
        if is_configured():
            sb = get_service_client()
            result = sb.table("risk_assessments").select("*").eq("risk_bucket", bucket.upper()).execute()
            count = len(result.data or [])
        else:
            count = 0
        data = {"bucket": bucket.upper(), "count": count}

    elif intent == "help":
        data = {}

    else:
        data = {"raw": req.message}

    response_text = phrase_response(intent, data, req.message)

    return KelvinResponse(
        intent=intent,
        response=response_text,
        data=data,
        confidence=confidence,
    )
