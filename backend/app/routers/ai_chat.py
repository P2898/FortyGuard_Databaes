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
        # RAG retrieval
        context_docs = retrieve_context(request.message, top_k=3)
        
        # Optional: gather site data for context-aware responses
        site_data = None
        if request.include_site_data:
            site_data = await _gather_context()
        
        # Generate RAG response
        rag_response = generate_response(request.message, context_docs, site_data)
        
        # Optional: multi-agent analysis
        agents_invoked = None
        if request.use_agents and site_data:
            agent_result = await orchestrator.query_agents(request.message, {
                "sites": site_data.get("sites", []),
                "assessments": site_data.get("assessments", []),
                "heat_pl": site_data.get("heat_pl", {}),
                "policy": site_data.get("policy", {}),
            })
            agents_invoked = agent_result.get("agents_invoked", [])
            
            # Merge agent recommendations
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
    """Gather site/assessment data for context-aware responses."""
    from app.services.cache import get_cached, set_cached
    
    # Try cache first
    cached = get_cached("chat_context")
    if cached:
        metrics.record_cache_hit()
        return cached
    
    metrics.record_cache_miss()
    
    # Gather from database/API
    try:
        from app.database import supabase
        
        # Get sites
        site_list = []
        if supabase:
            try:
                resp = supabase.table("sites").select("*").execute()
                site_list = resp.data if hasattr(resp, 'data') else []
            except Exception:
                site_list = []
        
        context = {
            "sites": site_list,
            "assessments": [],
            "heat_pl": {},
            "policy": {},
        }
        
        set_cached("chat_context", context, ttl=30)
        return context
    except Exception:
        return {"sites": [], "assessments": [], "heat_pl": {}, "policy": {}}
