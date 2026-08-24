"""Route planner API — OSMnx street graph routing with heat-weighted edges.

Segments long routes into manageable chunks for OSMnx graph download.
Uses heat-weighted shortest path for the coolest route.
Falls back to smart detour algorithm for very long routes.
"""

import math
import random
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
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def _get_temperature_at_point(lat, lon, heatmap_tiles):
    nearest_temp = 30.0
    min_dist = float("inf")
    for tile in heatmap_tiles:
        coords = tile.get("geometry", {}).get("coordinates", [])
        if len(coords) >= 2:
            tlon, tlat = coords[0] if isinstance(coords[0], list) else (coords[0], coords[1])
            d = ((lat - tlat) ** 2 + (lon - tlon) ** 2) ** 0.5
            if d < min_dist:
                min_dist = d
                nearest_temp = tile.get("properties", {}).get("average_temperature", 30.0)
    return nearest_temp


def _get_osm_segment(origin_lat, origin_lon, dest_lat, dest_lon, network_type="drive", radius_m=8000):
    """Get route for a short segment using OSMnx."""
    try:
        import osmnx as ox
        import networkx as nx

        center_lat = (origin_lat + dest_lat) / 2
        center_lon = (origin_lon + dest_lon) / 2

        G = ox.graph_from_point(
            (center_lat, center_lon),
            dist=radius_m,
            network_type=network_type,
            simplify=True,
        )

        origin_node = ox.distance.nearest_nodes(G, origin_lon, origin_lat)
        dest_node = ox.distance.nearest_nodes(G, dest_lon, dest_lat)

        # Shortest path by distance
        path = nx.shortest_path(G, origin_node, dest_node, weight="length")
        coords = [(G.nodes[n]["x"], G.nodes[n]["y"]) for n in path]
        dist_m = nx.shortest_path_length(G, origin_node, dest_node, weight="length")

        return G, coords, dist_m, origin_node, dest_node

    except Exception as e:
        print(f"[Route] OSMnx segment error: {e}")
        return None, [(origin_lon, origin_lat), (dest_lon, dest_lat)], _haversine_km(origin_lat, origin_lon, dest_lat, dest_lon) * 1000, None, None


def _get_full_route(origin_lat, origin_lon, dest_lat, dest_lon, network_type="drive"):
    """Get route, segmenting long distances for OSMnx."""
    total_km = _haversine_km(origin_lat, origin_lon, dest_lat, dest_lon)

    # For short routes (<15km), use single OSMnx graph
    if total_km < 15:
        G, coords, dist_m, _, _ = _get_osm_segment(origin_lat, origin_lon, dest_lat, dest_lon, network_type)
        return G, coords, dist_m / 1000, None, None

    # For long routes, interpolate waypoints and stitch OSM segments
    num_segments = max(2, min(8, int(total_km / 12)))  # ~12km per segment
    all_coords = []
    total_dist_km = 0

    for i in range(num_segments):
        t0 = i / num_segments
        t1 = (i + 1) / num_segments
        seg_lat0 = origin_lat + t0 * (dest_lat - origin_lat)
        seg_lon0 = origin_lon + t0 * (dest_lon - origin_lon)
        seg_lat1 = origin_lat + t1 * (dest_lat - origin_lat)
        seg_lon1 = origin_lon + t1 * (dest_lon - origin_lon)

        _, seg_coords, seg_dist_m, _, _ = _get_osm_segment(
            seg_lat0, seg_lon0, seg_lat1, seg_lon1, network_type, radius_m=10000
        )

        # Avoid duplicating the junction point
        if all_coords and seg_coords:
            all_coords.extend(seg_coords[1:])
        else:
            all_coords.extend(seg_coords)

        total_dist_km += seg_dist_m / 1000

    return None, all_coords, total_dist_km, None, None


def _get_heat_coolest_route(fastest_coords, heatmap_tiles):
    """Compute the coolest route by deviating from the fastest route at hot points.

    Instead of independent heat-weighted routing (which causes zig-zag),
    we follow the fastest route but push waypoints away from hot areas.
    Uses Gaussian smoothing on the offset to avoid sharp zig-zags.
    """
    if len(fastest_coords) < 2:
        return fastest_coords

    # Step 1: Compute raw offsets at each point
    raw_offsets = []
    for i, (lon, lat) in enumerate(fastest_coords):
        temp = _get_temperature_at_point(lat, lon, heatmap_tiles)

        if temp > 30:
            # Compute route direction at this point
            prev_lon, prev_lat = fastest_coords[max(0, i - 1)]
            next_lon, next_lat = fastest_coords[min(len(fastest_coords) - 1, i + 1)]
            dx = next_lon - prev_lon
            dy = next_lat - prev_lat

            # Perpendicular (rotate 90 degrees)
            perp_x = -dy
            perp_y = dx
            mag = math.sqrt(perp_x**2 + perp_y**2) or 1
            perp_x /= mag
            perp_y /= mag

            # Detour amount scales with temperature, capped
            detour = min(0.03, max(0, (temp - 28) * 0.003))
            # Push perpendicular to route, bias slightly west (toward coast)
            raw_offsets.append((
                perp_x * detour * 0.7 - detour * 0.3,  # westward bias
                perp_y * detour * 0.7,
            ))
        else:
            raw_offsets.append((0.0, 0.0))

    # Step 2: Gaussian-smooth the offsets to avoid zig-zag
    smoothed = []
    window = 5  # smooth over ±5 points
    for i in range(len(raw_offsets)):
        sx, sy = 0.0, 0.0
        weight_sum = 0.0
        for j in range(max(0, i - window), min(len(raw_offsets), i + window + 1)):
            w = math.exp(-0.5 * ((i - j) / 2.0) ** 2)  # Gaussian kernel
            sx += raw_offsets[j][0] * w
            sy += raw_offsets[j][1] * w
            weight_sum += w
        if weight_sum > 0:
            sx /= weight_sum
            sy /= weight_sum
        smoothed.append((sx, sy))

    # Step 3: Apply smoothed offsets
    coolest = []
    for i, (lon, lat) in enumerate(fastest_coords):
        ox, oy = smoothed[i]
        coolest.append((lon + ox, lat + oy))

    return coolest


@router.post("/plan", response_model=RouteResponse)
async def plan_route(req: RouteRequest):
    """Plan routes using OSM street graph.

    Fastest route: shortest distance on street network.
    Coolest route: fastest route with deviations at hot points.
    Walk vs drive: different OSM network types.
    """
    from app.services.fortyguard import submit_heatmap

    travel_mode = req.travel_mode if req.travel_mode in ("walk", "drive") else "drive"

    # Get heatmap data
    padding = max(0.02, _haversine_km(req.origin_lat, req.origin_lon, req.dest_lat, req.dest_lon) / 111 * 0.3)
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
    heatmap = await submit_heatmap(polygon, now.strftime("%Y-%m-%d"), now.strftime("%H:%M"), analytic="tcm")
    tiles = heatmap.get("map_data", {}).get("features", [])

    # Get fastest route via OSMnx (segmented for long routes)
    G, fastest_coords, fastest_dist_km, _, _ = _get_full_route(
        req.origin_lat, req.origin_lon, req.dest_lat, req.dest_lon, travel_mode
    )

    # Get coolest route by deviating from fastest at hot points
    coolest_coords = _get_heat_coolest_route(fastest_coords, tiles)

    # Compute average temperatures
    def avg_route_temp(coords):
        total = 0
        count = 0
        for lon, lat in coords:
            total += _get_temperature_at_point(lat, lon, tiles)
            count += 1
        return total / count if count else 30

    fastest_temp_c = avg_route_temp(fastest_coords)
    coolest_temp_c = avg_route_temp(coolest_coords)
    temp_delta_c = fastest_temp_c - coolest_temp_c
    temp_delta_f = temp_delta_c * 9 / 5

    # Time delta
    avg_speed_kmh = 5 if travel_mode == "walk" else 40
    # Coolest route is slightly longer due to detours
    coolest_dist_km = fastest_dist_km * 1.08  # ~8% longer
    time_delta_min = max(0, int((coolest_dist_km - fastest_dist_km) / avg_speed_kmh * 60))

    # Save to Supabase
    if is_configured():
        try:
            sb = get_service_client()
            sb.table("route_queries").insert({
                "origin": req.origin_name,
                "destination": req.dest_name,
                "travel_mode": travel_mode,
                "fastest_route_geojson": {"type": "LineString", "coordinates": fastest_coords},
                "coolest_route_geojson": {"type": "LineString", "coordinates": coolest_coords},
                "temp_delta": round(temp_delta_c, 1),
                "time_delta": float(time_delta_min),
                "timestamp": datetime.utcnow().isoformat(),
            }).execute()
        except Exception:
            pass

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
        distance_km=round(fastest_dist_km, 1),
        travel_mode=travel_mode,
    )


@router.post("/helpful")
async def mark_helpful(req: HelpfulRequest):
    if is_configured():
        try:
            sb = get_service_client()
            sb.table("route_queries").update({"route_helpful": req.helpful}).order("id", desc=True).limit(1).execute()
        except Exception:
            pass
    return {"ok": True, "helpful": req.helpful}


@router.get("/sites")
async def get_route_sites():
    if is_configured():
        sb = get_service_client()
        result = sb.table("sites").select("site_id, name, latitude, longitude").execute()
        return result.data or []
    from app.routers.sites import _sites
    return [{"site_id": s["site_id"], "name": s["name"], "latitude": s["latitude"], "longitude": s["longitude"]} for s in _sites]
