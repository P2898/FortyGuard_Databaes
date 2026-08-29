"""Heat Illness Prediction API endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from app.services.heat_illness import (
    predict_heat_illness,
    prediction_to_dict,
    EnvironmentalConditions,
    WorkerProfile,
    WorkProfile,
)
from app.services.monitoring import metrics

router = APIRouter(prefix="/api/heat-prediction", tags=["heat-prediction"])


class PredictionRequest(BaseModel):
    # Environmental conditions
    temperature_c: float = 30.0
    heat_index_c: float = 33.0
    humidity_percent: float = 50.0
    solar_radiation_wm2: float = 500.0
    wind_speed_ms: float = 2.0
    wbgt_c: float = 0.0

    # Worker profile
    age: int = 35
    acclimatized: bool = True
    fitness_level: str = "moderate"
    hydration_status: str = "normal"
    clothing: str = "standard"
    medical_conditions: List[str] = []
    body_weight_kg: float = 75.0
    experience_months: int = 12

    # Work characteristics
    workload: str = "moderate"
    duration_hours: float = 4.0
    rest_break_min: int = 15
    rest_frequency_min: int = 60
    work_start_hour: int = 10
    outdoor: bool = True


@router.post("")
async def get_prediction(req: PredictionRequest):
    """Predict heat illness probability based on conditions + worker profile."""
    span = metrics.start_span("heat_prediction")

    env = EnvironmentalConditions(
        temperature_c=req.temperature_c,
        heat_index_c=req.heat_index_c,
        humidity_percent=req.humidity_percent,
        solar_radiation_wm2=req.solar_radiation_wm2,
        wind_speed_ms=req.wind_speed_ms,
        wbgt_c=req.wbgt_c,
    )
    worker = WorkerProfile(
        age=req.age,
        acclimatized=req.acclimatized,
        fitness_level=req.fitness_level,
        hydration_status=req.hydration_status,
        clothing=req.clothing,
        medical_conditions=req.medical_conditions,
        body_weight_kg=req.body_weight_kg,
        experience_months=req.experience_months,
    )
    work = WorkProfile(
        workload=req.workload,
        duration_hours=req.duration_hours,
        rest_break_min=req.rest_break_min,
        rest_frequency_min=req.rest_frequency_min,
        work_start_hour=req.work_start_hour,
        outdoor=req.outdoor,
    )

    result = predict_heat_illness(env, worker, work)
    metrics.end_span(span, "ok")
    return prediction_to_dict(result)
