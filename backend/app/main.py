"""Shade — FastAPI backend entry point."""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import sites, assessment, heat_pl, kelvin, route, reports, streetview, ai_chat, monitoring, transcribe, forecast

async def _prewarm_assessment():
    """Pre-warm fleet assessment cache on startup so first page load has data."""
    import time
    try:
        # Wait for sites to be seeded
        await asyncio.sleep(2)
        from app.routers.assessment import assess_fleet, AssessRequest
        start = time.time()
        result = await assess_fleet(AssessRequest())
        elapsed = int((time.time() - start) * 1000)
        print(f"[prewarm] Fleet assessment cached: {len(result.sites)} sites in {elapsed}ms")
    except Exception as e:
        print(f"[prewarm] Assessment pre-warm failed (non-critical): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed demo sites in background (non-blocking)
    asyncio.create_task(sites.seed_sites_on_startup())
    # Pre-warm assessment cache (runs after sites are seeded)
    asyncio.create_task(_prewarm_assessment())
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
app.include_router(forecast.router)


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
