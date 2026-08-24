"""Street view heat data — returns FortyGuard environmental parameters for a point.

Used by the pegman drag-and-drop feature: drop the pegman anywhere on the map
and get instant heat data for that exact location.
"""

from datetime import datetime
from fastapi import APIRouter, Query
from app.services.fortyguard import submit_env_params

router = APIRouter(prefix="/api/streetview", tags=["streetview"])


@router.get("/heat-data")
async def get_heat_data(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
):
    """Get heat data for a specific point on the map.

    Returns temperature (2m human height), heat index, humidity,
    solar irradiance, and AQI from FortyGuard's environmental parameters.
    """
    now = datetime.now()
    data = await submit_env_params(
        lat, lon,
        now.strftime("%Y-%m-%d"),
        now.strftime("%H:%M"),
    )

    return {
        "lat": lat,
        "lon": lon,
        "temperature_c": round(
            data.get("apparent_temperature_celsius",
                     data.get("heat_index_celsius", 30.0)), 1
        ),
        "heat_index_c": round(data.get("heat_index_celsius", 30.0), 1),
        "humidity": round(data.get("relative_humidity_percent", 50.0), 1),
        "solar_irradiance": round(data.get("solar_irradiance", 400.0), 1),
        "aqi": round(data.get("air_quality:idx", 50.0), 0),
    }
