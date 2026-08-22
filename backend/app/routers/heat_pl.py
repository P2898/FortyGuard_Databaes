"""Heat P&L API — financial impact dashboard, backed by Supabase."""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.heat_pl import compute_heat_pl, CompanyPolicy
from app.database import get_service_client, is_configured

router = APIRouter(prefix="/api/heat-pl", tags=["heat-pl"])


class PolicyUpdate(BaseModel):
    hazard_pay_rate_per_hr: float = 25.0
    wage_rate_per_hr: float = 35.0
    contract_day_rate: float = 5000.0


class PLRequest(BaseModel):
    date: str = ""
    site_count: int = 8


# In-memory fallback
_policy = CompanyPolicy(hazard_pay_rate_per_hr=25.0, wage_rate_per_hr=35.0, contract_day_rate=5000.0)


def _get_policy() -> CompanyPolicy:
    """Get company policy from Supabase or in-memory."""
    if is_configured():
        sb = get_service_client()
        result = sb.table("company_policy").select("*").order("id", desc=True).limit(1).execute()
        if result.data:
            row = result.data[0]
            return CompanyPolicy(
                hazard_pay_rate_per_hr=row.get("hazard_pay_rate_per_hr", 25.0),
                wage_rate_per_hr=row.get("wage_rate_per_hr", 35.0),
                contract_day_rate=row.get("contract_day_rate", 5000.0),
            )
    return _policy


def _save_policy(policy: CompanyPolicy):
    """Save company policy to Supabase."""
    if is_configured():
        sb = get_service_client()
        # Upsert: update existing or insert new
        existing = sb.table("company_policy").select("id").limit(1).execute()
        if existing.data:
            sb.table("company_policy").update({
                "hazard_pay_rate_per_hr": policy.hazard_pay_rate_per_hr,
                "wage_rate_per_hr": policy.wage_rate_per_hr,
                "contract_day_rate": policy.contract_day_rate,
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("id", existing.data[0]["id"]).execute()
        else:
            sb.table("company_policy").insert({
                "hazard_pay_rate_per_hr": policy.hazard_pay_rate_per_hr,
                "wage_rate_per_hr": policy.wage_rate_per_hr,
                "contract_day_rate": policy.contract_day_rate,
            }).execute()
    else:
        global _policy
        _policy = policy


@router.get("")
async def get_heat_pl(date: str = "", site_count: int = 8):
    """Compute the Heat P&L for today."""
    import random

    # Simulate portfolio risk hours
    high_hours = round(random.uniform(4, 12), 1)
    critical_hours = round(random.uniform(1, 6), 1)
    hours_avoided = round(random.uniform(2, 8), 1)
    exceedance_days = random.randint(1, 5)

    date_str = date or datetime.now().strftime("%Y-%m-%d")
    policy = _get_policy()

    result = compute_heat_pl(
        high_hours=high_hours,
        critical_hours=critical_hours,
        hours_avoided=hours_avoided,
        exceedance_days=exceedance_days,
        policy=policy,
        date=date_str,
        site_count=site_count,
    )

    # Save to ledger in Supabase
    if is_configured():
        sb = get_service_client()
        for line in result.lines:
            if line.amount > 0:
                sb.table("heat_pl_ledger").insert({
                    "date": date_str,
                    "hazard_pay_owed": line.amount if "hazard" in line.label.lower() else 0,
                    "productivity_dollars": line.amount if "productivity" in line.label.lower() else 0,
                    "delay_claim_value": line.amount if "delay" in line.label.lower() else 0,
                    "compliance_status": "active",
                }).execute()

    return {
        "total_cost": result.total_cost,
        "lines": [
            {
                "label": l.label,
                "amount": l.amount,
                "formula": l.formula,
                "inputs": l.inputs,
                "disclaimer": l.disclaimer,
            }
            for l in result.lines
        ],
        "date": result.date,
        "site_count": result.site_count,
    }


@router.put("/policy")
async def update_policy(policy: PolicyUpdate):
    p = CompanyPolicy(**policy.model_dump())
    _save_policy(p)
    return {"message": "Policy updated", "policy": p.__dict__}


@router.get("/policy")
async def get_policy():
    p = _get_policy()
    return p.__dict__
