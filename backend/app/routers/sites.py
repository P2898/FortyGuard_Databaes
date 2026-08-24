"""Site portfolio API — CRUD + CSV upload, backed by Supabase."""

import csv
import io
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.database import get_service_client, is_configured

router = APIRouter(prefix="/api/sites", tags=["sites"])


class SiteCreate(BaseModel):
    site_id: str
    name: str
    latitude: float
    longitude: float
    site_type: str = "other"


class SiteResponse(BaseModel):
    site_id: str
    name: str
    latitude: float
    longitude: float
    site_type: str
    created_at: str


# In-memory fallback when Supabase is not configured
_sites: list[dict] = []


# Bay Area seed data — deliberate choice for FortyGuard's hyperlocal differentiator
SEED_SITES = [
    {"site_id": "WH-SF-01", "name": "SF Waterfront Warehouse", "latitude": 37.7955, "longitude": -122.3937, "site_type": "warehouse"},
    {"site_id": "WH-TR-01", "name": "Tracy Logistics Hub", "latitude": 37.7397, "longitude": -121.4252, "site_type": "warehouse"},
    {"site_id": "CN-OA-01", "name": "Oakland Port Construction", "latitude": 37.7955, "longitude": -122.2789, "site_type": "construction"},
    {"site_id": "CN-LV-01", "name": "Livermore Solar Farm", "latitude": 37.6905, "longitude": -121.9142, "site_type": "construction"},
    {"site_id": "RH-FC-01", "name": "Fairfield Route Hub", "latitude": 38.2494, "longitude": -122.0400, "site_type": "route_hub"},
    {"site_id": "WH-CC-01", "name": "Concord Distribution Center", "latitude": 37.9780, "longitude": -122.0311, "site_type": "warehouse"},
    {"site_id": "CN-SJ-01", "name": "San Jose Data Center Build", "latitude": 37.3382, "longitude": -121.8863, "site_type": "construction"},
    {"site_id": "RH-BK-01", "name": "Berkeley Transit Depot", "latitude": 37.8716, "longitude": -122.2727, "site_type": "route_hub"},
]


def _validate_site(site_id: str, lat: float, lon: float, site_type: str):
    """Validate US coordinates and site type."""
    if not (24.0 <= lat <= 72.0 and -180.0 <= lon <= -60.0):
        raise HTTPException(status_code=400, detail="Coordinates must be within the US")
    if site_type not in ("warehouse", "construction", "route_hub", "other"):
        raise HTTPException(status_code=400, detail="site_type must be warehouse, construction, route_hub, or other")


async def seed_sites_on_startup():
    """Seed Bay Area demo sites on startup."""
    if is_configured():
        sb = get_service_client()
        existing = sb.table("sites").select("site_id").execute()
        existing_ids = {s["site_id"] for s in (existing.data or [])}
        for site in SEED_SITES:
            if site["site_id"] not in existing_ids:
                sb.table("sites").insert({
                    **site,
                    "created_at": datetime.utcnow().isoformat(),
                }).execute()
    else:
        if not _sites:
            for site in SEED_SITES:
                _sites.append({**site, "created_at": datetime.utcnow().isoformat()})


@router.get("", response_model=list[SiteResponse])
async def list_sites():
    if is_configured():
        sb = get_service_client()
        result = sb.table("sites").select("*").execute()
        return result.data or []
    return _sites


@router.post("", response_model=SiteResponse)
async def create_site(site: SiteCreate):
    _validate_site(site.site_id, site.latitude, site.longitude, site.site_type)
    entry = {**site.model_dump(), "created_at": datetime.utcnow().isoformat()}

    if is_configured():
        sb = get_service_client()
        # Check duplicate
        existing = sb.table("sites").select("site_id").eq("site_id", site.site_id).execute()
        if existing.data:
            raise HTTPException(status_code=409, detail=f"Site {site.site_id} already exists")
        sb.table("sites").insert(entry).execute()
    else:
        if any(s["site_id"] == site.site_id for s in _sites):
            raise HTTPException(status_code=409, detail=f"Site {site.site_id} already exists")
        _sites.append(entry)

    return entry


@router.post("/upload", response_model=list[SiteResponse])
async def upload_csv(file: UploadFile = File(...)):
    """Upload a CSV file with columns: site_id, name, latitude, longitude, site_type"""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    required_cols = {"site_id", "name", "latitude", "longitude"}
    if not required_cols.issubset(set(reader.fieldnames or [])):
        raise HTTPException(status_code=400, detail=f"CSV must contain columns: {required_cols}")

    added = []
    errors = []

    if is_configured():
        sb = get_service_client()
        existing = sb.table("sites").select("site_id").execute()
        existing_ids = {s["site_id"] for s in (existing.data or [])}

        for i, row in enumerate(reader, start=2):
            try:
                lat = float(row["latitude"])
                lon = float(row["longitude"])
                if not (24.0 <= lat <= 72.0 and -180.0 <= lon <= -60.0):
                    errors.append(f"Row {i}: Coordinates must be within the US")
                    continue
                if row["site_id"] in existing_ids:
                    errors.append(f"Row {i}: Site {row['site_id']} already exists")
                    continue
                entry = {
                    "site_id": row["site_id"],
                    "name": row["name"],
                    "latitude": lat,
                    "longitude": lon,
                    "site_type": row.get("site_type", "other"),
                    "created_at": datetime.utcnow().isoformat(),
                }
                sb.table("sites").insert(entry).execute()
                existing_ids.add(row["site_id"])
                added.append(entry)
            except (ValueError, KeyError) as e:
                errors.append(f"Row {i}: {str(e)}")
    else:
        for i, row in enumerate(reader, start=2):
            try:
                lat = float(row["latitude"])
                lon = float(row["longitude"])
                if not (24.0 <= lat <= 72.0 and -180.0 <= lon <= -60.0):
                    errors.append(f"Row {i}: Coordinates must be within the US")
                    continue
                if any(s["site_id"] == row["site_id"] for s in _sites):
                    errors.append(f"Row {i}: Site {row['site_id']} already exists")
                    continue
                entry = {
                    "site_id": row["site_id"],
                    "name": row["name"],
                    "latitude": lat,
                    "longitude": lon,
                    "site_type": row.get("site_type", "other"),
                    "created_at": datetime.utcnow().isoformat(),
                }
                _sites.append(entry)
                added.append(entry)
            except (ValueError, KeyError) as e:
                errors.append(f"Row {i}: {str(e)}")

    if errors and not added:
        raise HTTPException(status_code=400, detail=f"Upload errors: {'; '.join(errors)}")

    return added


@router.delete("/{site_id}")
async def delete_site(site_id: str):
    if is_configured():
        sb = get_service_client()
        existing = sb.table("sites").select("site_id").eq("site_id", site_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail=f"Site {site_id} not found")
        sb.table("sites").delete().eq("site_id", site_id).execute()
    else:
        global _sites
        before = len(_sites)
        _sites = [s for s in _sites if s["site_id"] != site_id]
        if len(_sites) == before:
            raise HTTPException(status_code=404, detail=f"Site {site_id} not found")

    return {"deleted": site_id}
