"""Monitoring & Observability API endpoints."""

from fastapi import APIRouter
from app.services.monitoring import metrics

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@router.get("/health")
async def health_check():
    """System health check endpoint."""
    return metrics.get_metrics()["health"]


@router.get("/metrics")
async def get_metrics():
    """Get all application metrics."""
    return metrics.get_metrics()


@router.get("/metrics/cache")
async def cache_metrics():
    """Get cache performance metrics."""
    return metrics.get_metrics()["cache"]


@router.get("/metrics/api")
async def api_metrics():
    """Get external API call metrics."""
    m = metrics.get_metrics()
    return {
        "fortyguard": m["fortyguard"],
        "supabase": m["supabase"],
    }


@router.get("/metrics/agents")
async def agent_metrics():
    """Get multi-agent system metrics."""
    return metrics.get_metrics()["agents"]


@router.get("/metrics/operations")
async def operation_metrics():
    """Get per-operation performance metrics."""
    return metrics.get_metrics()["operations"]


@router.get("/alerts")
async def get_alerts():
    """Get recent system alerts."""
    return {"alerts": metrics.get_metrics()["recent_alerts"]}
