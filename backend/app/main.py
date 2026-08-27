"""Shade — FastAPI backend entry point."""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import sites, assessment, heat_pl, kelvin, route, reports, streetview, ai_chat, monitoring, transcribe

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed demo sites in background (non-blocking)
    asyncio.create_task(sites.seed_sites_on_startup())
    yield

app = FastAPI(
    title="Shade API",
    description="Worker safety, OSHA compliance, and heat-cost platform powered by FortyGuard",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(sites.router)
app.include_router(assessment.router)
app.include_router(heat_pl.router)
app.include_router(kelvin.router)
app.include_router(route.router)
app.include_router(reports.router)
app.include_router(streetview.router)
app.include_router(ai_chat.router)
app.include_router(monitoring.router)
app.include_router(transcribe.router)


@app.get("/api/health")
async def health():
    from app.services.monitoring import metrics as monitoring_metrics
    return {"status": "ok", "service": "shade", "metrics": monitoring_metrics.get_metrics()["health"]}


@app.get("/api/config")
async def get_config():
    """Return public config (no secrets)."""
    return {
        "name": "Shade",
        "version": "1.0.0",
        "fortyguard_configured": bool(__import__("os").getenv("FORTYGUARD_API_KEY")),
        "supabase_configured": bool(__import__("os").getenv("SUPABASE_URL")),
    }
