"""AI Chat endpoint — RAG-powered knowledge assistant."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.rag import retrieve_context, generate_response
from app.services.agents import orchestrator
from app.services.monitoring import metrics

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatRequest(BaseModel):
    message: str
    include_site_data: bool = True
    use_agents: bool = False


class ChatResponse(BaseModel):
    answer: str
    intent: str
    confidence: float
    sources: list
    suggestions: list
    agents_invoked: Optional[list] = None
    response_time_ms: float


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """RAG-powered chat endpoint with optional multi-agent coordination."""
    span = metrics.start_span("ai_chat", {"message_length": len(request.message)})

    try:
        context_docs = retrieve_context(request.message, top_k=3)

        site_data = None
        if request.include_site_data:
            site_data = await _gather_context()

        rag_response = generate_response(request.message, context_docs, site_data)

        agents_invoked = None
        if request.use_agents and site_data:
            agent_result = await orchestrator.query_agents(request.message, {
                "sites": site_data.get("sites", []),
                "assessments": site_data.get("assessments", []),
                "heat_pl": site_data.get("heat_pl", {}),
                "policy": site_data.get("policy", {}),
            })
            agents_invoked = agent_result.get("agents_invoked", [])
            rag_response["suggestions"].extend(agent_result.get("all_recommendations", [])[:3])

        metrics.end_span(span, "ok")

        return ChatResponse(
            answer=rag_response["answer"],
            intent=rag_response["intent"],
            confidence=rag_response["confidence"],
            sources=rag_response["sources"],
            suggestions=rag_response["suggestions"],
            agents_invoked=agents_invoked,
            response_time_ms=round(span.duration_ms, 1),
        )

    except Exception as e:
        import traceback
        print(f"[ai_chat] Error: {e}")
        traceback.print_exc()
        metrics.end_span(span, "error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/portfolio")
async def analyze_portfolio():
    """Run multi-agent portfolio analysis."""
    span = metrics.start_span("agent_portfolio_analysis")

    try:
        site_data = await _gather_context()

        result = await orchestrator.analyze_portfolio(
            sites=site_data.get("sites", []),
            assessments=site_data.get("assessments", []),
            heat_pl=site_data.get("heat_pl", {}),
            policy=site_data.get("policy", {}),
        )

        metrics.end_span(span, "ok")
        return result

    except Exception as e:
        metrics.end_span(span, "error")
        raise HTTPException(status_code=500, detail=str(e))


async def _gather_context() -> dict:
    """Gather site/assessment/Heat P&L/policy data for context-aware responses.

    Pulls from:
    1. Sites: in-memory seed data or Supabase
    2. Assessments: from in-memory cache (populated by fleet assessment)
    3. Heat P&L: computed from assessments + company policy
    4. Policy: from Supabase or defaults
    """
    from app.services.cache import get_cached, set_cached

    cached = get_cached("chat_context")
    if cached:
        metrics.record_cache_hit()
        return cached

    metrics.record_cache_miss()

    try:
        # 1. Get sites (use the same in-memory list the server uses)
        from app.routers import sites as sites_router
        site_list = sites_router._sites if sites_router._sites else []

        # If seed data hasn't loaded yet, fetch via the API-style function
        if not site_list:
            try:
                site_list = await sites_router.list_sites()
            except Exception:
                site_list = []

        # 2. Get assessments from in-memory cache
        from app.routers.assessment import get_latest_assessments, _latest_assessment_cache
        assessments = get_latest_assessments()

        # 3. Get company policy
        from app.routers.heat_pl import _get_policy
        from app.services.heat_pl import compute_heat_pl

        policy = _get_policy()
        policy_dict = {
            "hazard_pay_rate_per_hr": policy.hazard_pay_rate_per_hr,
            "wage_rate_per_hr": policy.wage_rate_per_hr,
            "contract_day_rate": policy.contract_day_rate,
        }

        # 4. Compute Heat P&L from assessments
        heat_pl = {}
        if assessments:
            try:
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

                pl_result = compute_heat_pl(
                    high_hours=round(high_hours, 1),
                    critical_hours=round(critical_hours, 1),
                    hours_avoided=round(hours_avoided, 1),
                    exceedance_days=exceedance_days,
                    policy=policy,
                    date="",
                    site_count=len(assessments),
                )

                heat_pl = {
                    "total_cost": pl_result.total_cost,
                    "lines": [
                        {
                            "label": l.label,
                            "amount": l.amount,
                            "formula": l.formula,
                            "inputs": l.inputs,
                            "disclaimer": l.disclaimer,
                        }
                        for l in pl_result.lines
                    ],
                    "date": pl_result.date,
                    "site_count": pl_result.site_count,
                }
            except Exception as e:
                print(f"[ai_chat] Could not compute Heat P&L: {e}")
                import traceback; traceback.print_exc()
                heat_pl = {}

        context = {
            "sites": site_list,
            "assessments": assessments,
            "heat_pl": heat_pl,
            "policy": policy_dict,
        }

        print(f"[ai_chat] Context gathered: {len(site_list)} sites, {len(assessments)} assessments, heat_pl total=${heat_pl.get('total_cost', 0)}")

        set_cached("chat_context", context, ttl=30)
        return context

    except Exception as e:
        print(f"[ai_chat] _gather_context error: {e}")
        import traceback; traceback.print_exc()
        return {"sites": [], "assessments": [], "heat_pl": {}, "policy": {}}
