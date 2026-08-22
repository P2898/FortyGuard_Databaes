"""Shade — FastAPI backend entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import sites, assessment, heat_pl, kelvin

app = FastAPI(
    title="Shade API",
    description="Worker safety, OSHA compliance, and heat-cost platform powered by FortyGuard",
    version="1.0.0",
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


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "shade"}


@app.get("/api/config")
async def get_config():
    """Return public config (no secrets)."""
    return {
        "name": "Shade",
        "version": "1.0.0",
        "fortyguard_configured": bool(__import__("os").getenv("FORTYGUARD_API_KEY")),
        "supabase_configured": bool(__import__("os").getenv("SUPABASE_URL")),
    }
