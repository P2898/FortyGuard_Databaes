"""Route planner API — fastest vs heat-coolest route comparison."""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_service_client, is_configured

router = APIRouter(prefix="/api/routes", tags=["routes"])


class RouteRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float
    origin_name: str = "Origin"
    dest_name: str = "Destination"
    travel_mode: str = "drive"


class RouteResponse(BaseModel):
    origin: dict
    destination: dict
    fastest_route: dict
    coolest_route: dict
    temp_delta_f: float
    temp_delta_c: float
    time_delta_min: int
    distance_km: float
    travel_mode: str = "drive"

class HelpfulRequest(BaseModel):
    helpful: bool


def _haversine_km(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in km."""
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


@router.post("/plan", response_model=RouteResponse)
async def plan_route(req: RouteRequest):
    """Plan routes between two points, comparing fastest vs coolest.

    Uses FortyGuard grid data interpolated onto route segments.
    """
    import math
    from app.services.fortyguard import submit_heatmap

    # Calculate direct distance
    distance_km = _haversine_km(req.origin_lat, req.origin_lon, req.dest_lat, req.dest_lon)

    # Get heatmap data along the route corridor
    padding = max(0.02, distance_km / 111 * 0.3)  # Convert km to degrees roughly
    polygon = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [min(req.origin_lon, req.dest_lon) - padding, min(req.origin_lat, req.dest_lat) - padding],
                    [max(req.origin_lon, req.dest_lon) + padding, min(req.origin_lat, req.dest_lat) - padding],
                    [max(req.origin_lon, req.dest_lon) + padding, max(req.origin_lat, req.dest_lat) + padding],
                    [min(req.origin_lon, req.dest_lon) - padding, max(req.origin_lat, req.dest_lat) + padding],
                    [min(req.origin_lon, req.dest_lon) - padding, min(req.origin_lat, req.dest_lat) - padding],
                ]]
            }
        }]
    }

    now = datetime.now()
    heatmap = await submit_heatmap(
        polygon,
        now.strftime("%Y-%m-%d"),
        now.strftime("%H:%M"),
        analytic="tcm",
    )

    # Get tiles along route
    tiles = heatmap.get("map_data", {}).get("features", [])

    # Generate route waypoints
    num_points = max(10, int(distance_km * 2))

    # Fastest route: straight line
    fastest_coords = []
    for i in range(num_points + 1):
        t = i / num_points
        lat = req.origin_lat + t * (req.dest_lat - req.origin_lat)
        lon = req.origin_lon + t * (req.dest_lon - req.origin_lon)
        fastest_coords.append([lon, lat])

    # Coolest route: detour perpendicular to avoid hottest areas
    # Move toward the coast (west) when passing through hot inland areas
    coolest_coords = []
    for i in range(num_points + 1):
        t = i / num_points
        lat = req.origin_lat + t * (req.dest_lat - req.origin_lat)
        lon = req.origin_lon + t * (req.dest_lon - req.origin_lon)

        # Find nearest tile temperature
        nearest_temp = None
        min_dist = float("inf")
        for tile in tiles:
            tc = tile.get("geometry", {}).get("coordinates", [])
            if len(tc) >= 2:
                tlon, tlat = tc[0] if isinstance(tc[0], list) else (tc[0], tc[1])
                d = ((lat - tlat) ** 2 + (lon - tlon) ** 2) ** 0.5
                if d < min_dist:
                    min_dist = d
                    nearest_temp = tile.get("properties", {}).get("average_temperature", 30)

        # When in a hot zone (>30°C), push route westward (toward coast = cooler)
        if nearest_temp and nearest_temp > 30:
            detour_amount = min(0.03, (nearest_temp - 28) * 0.004)
            lon -= detour_amount  # Move west (toward coast, cooler)
            lat += detour_amount * 0.3 * (1 if i % 2 == 0 else -1)  # Slight north/south variation

        coolest_coords.append([lon, lat])

    # Compute average temps along each route
    def avg_route_temp(coords):
        total = 0
        count = 0
        for lon, lat in coords:
            for tile in tiles:
                tc = tile.get("geometry", {}).get("coordinates", [])
                if len(tc) >= 2:
                    tlon, tlat = tc[0] if isinstance(tc[0], list) else (tc[0], tc[1])
                    d = ((lat - tlat) ** 2 + (lon - tlon) ** 2) ** 0.5
                    if d < 0.03:
                        total += tile.get("properties", {}).get("average_temperature", 30)
                        count += 1
                        break
        return total / count if count else 30

    fastest_temp_c = avg_route_temp(fastest_coords)
    coolest_temp_c = avg_route_temp(coolest_coords)
    temp_delta_c = fastest_temp_c - coolest_temp_c
    temp_delta_f = temp_delta_c * 9/5

    # Time delta: coolest route is longer due to detour
    fastest_dist = distance_km
    coolest_dist = _haversine_km(
        coolest_coords[0][1], coolest_coords[0][0],
        coolest_coords[-1][1], coolest_coords[-1][0]
    ) * 1.2  # Coolest route is roughly 20% longer
    time_delta_min = int((coolest_dist - fastest_dist) / 40 * 60)  # Assume 40 km/h avg

    # Save to Supabase
    if is_configured():
        try:
            sb = get_service_client()
            sb.table("route_queries").insert({
                "origin": req.origin_name,
                "destination": req.dest_name,
                "fastest_route_geojson": {
                    "type": "LineString",
                    "coordinates": fastest_coords,
                },
                "coolest_route_geojson": {
                    "type": "LineString",
                    "coordinates": coolest_coords,
                },
                "temp_delta": round(temp_delta_c, 1),
                "time_delta": float(time_delta_min),
                "timestamp": datetime.utcnow().isoformat(),
            }).execute()
        except Exception:
            pass  # Non-critical

    return RouteResponse(
        origin={"name": req.origin_name, "lat": req.origin_lat, "lon": req.origin_lon},
        destination={"name": req.dest_name, "lat": req.dest_lat, "lon": req.dest_lon},
        fastest_route={
            "type": "LineString",
            "coordinates": fastest_coords,
            "avg_temp_c": round(fastest_temp_c, 1),
        },
        coolest_route={
            "type": "LineString",
            "coordinates": coolest_coords,
            "avg_temp_c": round(coolest_temp_c, 1),
        },
        temp_delta_f=round(temp_delta_f, 1),
        temp_delta_c=round(temp_delta_c, 1),
        time_delta_min=time_delta_min,
        distance_km=round(distance_km, 1),
        travel_mode=req.travel_mode,
    )


@router.post("/helpful")
async def mark_helpful(req: HelpfulRequest):
    """Mark the last route as helpful or not, writing to audit log."""
    if is_configured():
        try:
            sb = get_service_client()
            sb.table("route_queries").update({"route_helpful": req.helpful}).order("id", desc=True).limit(1).execute()
        except Exception:
            pass
    return {"ok": True, "helpful": req.helpful}


@router.get("/sites")
async def get_route_sites():
    """Get sites available for route planning."""
    if is_configured():
        sb = get_service_client()
        result = sb.table("sites").select("site_id, name, latitude, longitude").execute()
        return result.data or []
    from app.routers.sites import _sites
    return [{"site_id": s["site_id"], "name": s["name"], "latitude": s["latitude"], "longitude": s["longitude"]} for s in _sites]
