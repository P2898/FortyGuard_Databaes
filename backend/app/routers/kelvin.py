"""Kelvin API — voice/text safety assistant, backed by assessment cache + Supabase."""

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


def _get_latest_assessments():
    """Get latest assessments from the in-memory cache.
    
    If cache is empty (no fleet assessment run yet), trigger one automatically
    so Kelvin always has data to answer questions.
    """
    from app.routers.assessment import get_latest_assessments
    assessments = get_latest_assessments()
    if not assessments:
        # No assessments yet — run one synchronously so Kelvin has data
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're already inside an async handler, use a thread
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(asyncio.run, _trigger_fleet_assessment())
                    future.result(timeout=15)
            else:
                loop.run_until_complete(_trigger_fleet_assessment())
        except Exception:
            pass  # Fall through to empty list
        assessments = get_latest_assessments()
    return assessments


async def _trigger_fleet_assessment():
    """Run a fleet assessment to populate the cache."""
    from app.routers.assessment import assess_fleet, AssessRequest
    await assess_fleet(AssessRequest())


def _find_site_by_name(sites: list, name: str) -> dict | None:
    """Fuzzy-match a site by name. Tries exact, then partial match."""
    name_lower = name.lower().strip()
    # Exact match
    for s in sites:
        if s.get("name", "").lower() == name_lower:
            return s
    # Partial match (name contains search or search contains name)
    for s in sites:
        site_name = s.get("name", "").lower()
        if name_lower in site_name or site_name in name_lower:
            return s
    # Word-level match (any word matches)
    for s in sites:
        site_words = s.get("name", "").lower().split()
        if any(w in name_lower or name_lower in w for w in site_words):
            return s
    return None


def _get_riskiest_site():
    """Get the highest-risk site from cached fleet assessments."""
    assessments = _get_latest_assessments()
    if assessments:
        risk_order = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
        sorted_assessments = sorted(
            assessments,
            key=lambda a: risk_order.get(a.get("risk_bucket", "LOW"), 0),
            reverse=True,
        )
        return sorted_assessments[0] if sorted_assessments else None
    return None


def _get_site_assessment(site_id: str):
    """Get assessment for a specific site from cached fleet assessments."""
    assessments = _get_latest_assessments()
    # Try exact match first
    for a in assessments:
        if a.get("site_id", "").upper() == site_id.upper():
            return a
    # Try partial match
    for a in assessments:
        if site_id.lower() in a.get("site_id", "").lower():
            return a
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
        site_name = params.get("site_name", "")
        assessment = _get_site_assessment(site_id)
        if not assessment and site_name:
            # Try fuzzy name match against assessments
            assessments = _get_latest_assessments()
            for a in assessments:
                if site_name.lower() in (a.get("name", "") or "").lower():
                    assessment = a
                    break
        if assessment:
            data = {
                "site_id": assessment.get("site_id"),
                "name": assessment.get("name", ""),
                "temperature_c": assessment.get("temperature_c"),
                "risk_bucket": assessment.get("risk_bucket"),
                "exceedance_hours": assessment.get("exceedance_hours", 0),
            }
        else:
            data = {"site_id": site_id, "temperature_c": "N/A", "risk_bucket": "UNKNOWN"}

    elif intent == "riskiest_site":
        assessment = _get_riskiest_site()
        if assessment:
            data = {
                "site_id": assessment.get("site_id", "unknown"),
                "name": assessment.get("name", ""),
                "temperature_c": assessment.get("temperature_c", 0),
                "risk_bucket": assessment.get("risk_bucket", "LOW"),
            }
        else:
            data = {"site_id": "none", "temperature_c": 0, "risk_bucket": "LOW"}

    elif intent == "coolest_route":
        origin_name = params.get("origin", "unknown")
        dest_name = params.get("destination", "unknown")

        # Look up actual site data by name (fuzzy match)
        sites = _get_sites()
        origin_site = _find_site_by_name(sites, origin_name)
        dest_site = _find_site_by_name(sites, dest_name)

        data = {
            "origin": origin_name,
            "destination": dest_name,
            "temp_delta_f": 6,
            "time_delta_min": 4,
        }

        # If both sites found, include coordinates and route action
        if origin_site and dest_site:
            data["origin_site_id"] = origin_site["site_id"]
            data["origin_lat"] = origin_site["latitude"]
            data["origin_lon"] = origin_site["longitude"]
            data["origin_name"] = origin_site["name"]
            data["dest_site_id"] = dest_site["site_id"]
            data["dest_lat"] = dest_site["latitude"]
            data["dest_lon"] = dest_site["longitude"]
            data["dest_name"] = dest_site["name"]
            data["action"] = {
                "type": "navigate_route",
                "origin_id": origin_site["site_id"],
                "dest_id": dest_site["site_id"],
            }
        elif origin_site:
            data["origin_site_id"] = origin_site["site_id"]
            data["origin_lat"] = origin_site["latitude"]
            data["origin_lon"] = origin_site["longitude"]
            data["origin_name"] = origin_site["name"]
        elif dest_site:
            data["dest_site_id"] = dest_site["site_id"]
            data["dest_lat"] = dest_site["latitude"]
            data["dest_lon"] = dest_site["longitude"]
            data["dest_name"] = dest_site["name"]

    elif intent == "heat_cost":
        assessments = _get_latest_assessments()
        # Use same logic as heat_pl endpoint — compute hours from risk buckets + temps
        OSHA_PRECAUTION_C = 26.7
        NIOSH_REL_C = 28.0
        high_hours = 0.0
        critical_hours = 0.0
        hours_avoided = 0.0
        exceedance_days = 0
        for a in assessments:
            bucket = a.get("risk_bucket", "LOW")
            temp = a.get("temperature_c", 0)
            persist = a.get("persistence_hours", 0)
            if bucket == "CRITICAL":
                site_hours = max(persist, 6.0) if persist > 0 else min(12.0, max(0, (temp - NIOSH_REL_C)) * 0.5)
                critical_hours += round(site_hours, 1)
                exceedance_days += 1
            elif bucket == "HIGH":
                site_hours = max(persist, 4.0) if persist > 0 else min(10.0, max(0, (temp - OSHA_PRECAUTION_C)) * 0.4)
                high_hours += round(site_hours, 1)
                exceedance_days += 1
            elif bucket == "MEDIUM":
                hours_avoided += max(persist * 0.5, 1.0)

        # Read actual company policy from Supabase or in-memory
        from app.routers.heat_pl import _get_policy
        policy = _get_policy()
        pl = compute_heat_pl(high_hours=high_hours, critical_hours=critical_hours, hours_avoided=hours_avoided, exceedance_days=exceedance_days, policy=policy)
        data = {"total_cost": pl.total_cost, "site_count": len(assessments)}

    elif intent == "site_temperature":
        site_id = params.get("site_id", "")
        assessment = _get_site_assessment(site_id)
        if assessment:
            data = {
                "site_id": assessment.get("site_id"),
                "temperature_c": assessment.get("temperature_c"),
                "heat_index": assessment.get("heat_index"),
            }
        else:
            data = {"site_id": site_id, "temperature_c": "N/A", "heat_index": "N/A"}

    elif intent == "risk_count":
        bucket = params.get("bucket", "CRITICAL")
        assessments = _get_latest_assessments()
        count = sum(1 for a in assessments if a.get("risk_bucket", "").upper() == bucket.upper())
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
