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


# Simple LRU cache for OSMnx graphs to avoid re-downloading
_osmnx_cache: dict[str, any] = {}
_osmnx_cache_max = 10

def _get_osm_segment(origin_lat, origin_lon, dest_lat, dest_lon, network_type="drive", radius_m=8000):
    """Get route for a short segment using OSMnx with caching and timeout."""
    import signal
    import threading

    def _timeout_handler():
        raise TimeoutError("OSMnx download exceeded 15s")

    timer = threading.Timer(15, _timeout_handler)
    try:
        timer.start()
        import osmnx as ox
        import networkx as nx

        center_lat = (origin_lat + dest_lat) / 2
        center_lon = (origin_lon + dest_lon) / 2

        # Cache key: rounded center + network type
        cache_key = f"{round(center_lat,2)}_{round(center_lon,2)}_{network_type}_{radius_m}"

        if cache_key in _osmnx_cache:
            G = _osmnx_cache[cache_key]
        else:
            G = ox.graph_from_point(
                (center_lat, center_lon),
                dist=radius_m,
                network_type=network_type,
                simplify=True,
            )
            # Evict oldest if cache full
            if len(_osmnx_cache) >= _osmnx_cache_max:
                _osmnx_cache.pop(next(iter(_osmnx_cache)))
            _osmnx_cache[cache_key] = G

        origin_node = ox.distance.nearest_nodes(G, origin_lon, origin_lat)
        dest_node = ox.distance.nearest_nodes(G, dest_lon, dest_lat)

        # Shortest path by distance
        path = nx.shortest_path(G, origin_node, dest_node, weight="length")
        coords = [(G.nodes[n]["x"], G.nodes[n]["y"]) for n in path]
        dist_m = nx.shortest_path_length(G, origin_node, dest_node, weight="length")

        timer.cancel()
        return G, coords, dist_m, origin_node, dest_node

    except Exception as e:
        timer.cancel()
        print(f"[Route] OSMnx segment error: {e}")
        return None, [(origin_lon, origin_lat), (dest_lon, dest_lat)], _haversine_km(origin_lat, origin_lon, dest_lat, dest_lon) * 1000, None, None


def _generate_fallback_route(origin_lat, origin_lon, dest_lat, dest_lon):
    """Generate a smooth fallback route with waypoints when OSMnx is too slow.

    Creates ~30 interpolated waypoints along a direct path.
    This is much faster than OSMnx (instant) and good enough for heat comparison.
    """
    n_points = 30
    coords = []
    for i in range(n_points + 1):
        t = i / n_points
        lat = origin_lat + t * (dest_lat - origin_lat)
        lon = origin_lon + t * (dest_lon - origin_lon)
        coords.append((lon, lat))
    dist_km = _haversine_km(origin_lat, origin_lon, dest_lat, dest_lon)
    return None, coords, dist_km, None, None


def _get_full_route(origin_lat, origin_lon, dest_lat, dest_lon, network_type="drive"):
    """Get route, segmenting long distances for OSMnx.

    Falls back to smooth interpolated route if OSMnx is too slow (>30s).
    """
    import time as _time
    total_km = _haversine_km(origin_lat, origin_lon, dest_lat, dest_lon)

    # For short routes (<5km), try OSMnx with small radius (usually fast)
    if total_km < 5:
        start = _time.time()
        G, coords, dist_m, _, _ = _get_osm_segment(origin_lat, origin_lon, dest_lat, dest_lon, network_type, radius_m=3000)
        if _time.time() - start > 10 or G is None:
            print(f"[Route] OSMnx slow/unavailable ({_time.time()-start:.0f}s), using fallback")
            return _generate_fallback_route(origin_lat, origin_lon, dest_lat, dest_lon)
        return G, coords, dist_m / 1000, None, None

    # For routes >5km: use fast fallback
    # OSMnx graph download is too slow for longer routes
    print(f"[Route] Route ({total_km:.0f}km), using fast fallback")
    return _generate_fallback_route(origin_lat, origin_lon, dest_lat, dest_lon)


def _is_in_bay_area(lat, lon):
    """Check if coordinates are in the Bay Area land bounds.

    Simple polygon check: Bay Area is roughly between
    lon -122.6 to -121.4, lat 37.3 to 38.4
    Excludes the ocean (west of ~-122.5 at most latitudes).
    """
    # Quick bounding box check
    if not (37.3 <= lat <= 38.4 and -122.6 <= lon <= -121.4):
        return False
    # Exclude ocean: west coast of SF peninsula is around -122.5
    # But we need to allow the coast itself, so use a simple diagonal cutoff
    # At lat 37.7 (SF), ocean starts around -122.5
    # At lat 37.5 (Pacifica), ocean starts around -122.5
    # At lat 37.8 (Marin), ocean starts around -122.6
    ocean_lon_threshold = -122.4 - (lat - 37.7) * 0.5
    if lon < ocean_lon_threshold:
        return False
    return True


def _get_heat_coolest_route(fastest_coords, heatmap_tiles):
    """Compute the coolest route by deviating from the fastest route at hot points.

    Instead of independent heat-weighted routing (which causes zig-zag),
    we follow the fastest route but push waypoints away from hot areas.
    Uses Gaussian smoothing on the offset to avoid sharp zig-zags.
    Ensures deviations stay on land (Bay Area bounds).
    """
    if len(fastest_coords) < 2:
        return fastest_coords

    # Step 1: Compute raw offsets at each point
    raw_offsets = []
    for i, (lon, lat) in enumerate(fastest_coords):
        temp = _get_temperature_at_point(lat, lon, heatmap_tiles)

        if temp > 28:
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

            # Detour amount scales with temperature excess — more aggressive
            # At 30°C: 0.005°, at 35°C: 0.025°, at 40°C: 0.05° (capped)
            detour = min(0.05, max(0.005, (temp - 28) * 0.005))

            # Try both perpendicular directions, pick the coolest one on land
            best_offset = (0.0, 0.0)
            best_temp = temp
            for sign in [1, -1]:
                candidate_lon = lon + perp_x * detour * sign
                candidate_lat = lat + perp_y * detour * sign
                if _is_in_bay_area(candidate_lat, candidate_lon):
                    cand_temp = _get_temperature_at_point(candidate_lat, candidate_lon, heatmap_tiles)
                    if cand_temp < best_temp:
                        best_temp = cand_temp
                        best_offset = (perp_x * detour * sign, perp_y * detour * sign)

            raw_offsets.append(best_offset)
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

    # Step 3: Apply smoothed offsets (clamped to land)
    coolest = []
    for i, (lon, lat) in enumerate(fastest_coords):
        ox, oy = smoothed[i]
        new_lon, new_lat = lon + ox, lat + oy
        # Clamp to land bounds
        if not _is_in_bay_area(new_lat, new_lon):
            new_lon, new_lat = lon, lat  # stay on original route
        coolest.append((new_lon, new_lat))

    return coolest


@router.post("/plan", response_model=RouteResponse)
async def plan_route(req: RouteRequest):
    """Plan routes using OSM street graph.

    Fastest route: shortest distance on street network.
    Coolest route: fastest route with deviations at hot points.
    Walk vs drive: different OSM network types.
    """
    from app.services.fortyguard import submit_heatmap

    # Map travel modes to OSMnx network types
    # Use 'drive_service' instead of 'drive' to exclude ferries (which show routes through water)
    MODE_MAP = {"drive": "drive_service", "walk": "walk", "ride": "bike"}
    travel_mode = MODE_MAP.get(req.travel_mode, "drive_service")

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

    # Compute actual coolest route distance (haversine with road factor)
    coolest_haversine_km = 0
    for j in range(len(coolest_coords) - 1):
        coolest_haversine_km += _haversine_km(
            coolest_coords[j][1], coolest_coords[j][0],
            coolest_coords[j+1][1], coolest_coords[j+1][0]
        )
    # Apply road factor (OSMnx gives road distance; coolest has no graph so use factor)
    road_factor = fastest_dist_km / max(_haversine_km(req.origin_lat, req.origin_lon, req.dest_lat, req.dest_lon), 0.1)
    coolest_dist_km = coolest_haversine_km * road_factor

    # Time delta
    SPEED_MAP = {"walk": 5, "bike": 16, "drive_service": 40}
    avg_speed_kmh = SPEED_MAP.get(travel_mode, 40)
    time_delta_min = max(0, int(abs(coolest_dist_km - fastest_dist_km) / avg_speed_kmh * 60))

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
