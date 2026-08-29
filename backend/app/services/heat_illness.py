"""
Heat Illness Prediction Model

Predicts heat illness probability based on:
- Environmental conditions (temperature, heat index, humidity, solar radiation)
- Worker profile (age, acclimatization, fitness, hydration, clothing, medical conditions)
- Work characteristics (workload intensity, duration, work-rest cycles)

Based on NIOSH Criteria for a Recommended Standard (Publication No. 86-122),
OSHA Heat Illness Prevention Campaign, and ACGIH TLV for Heat Stress.

Output: probability (0-100%), risk level, and human-friendly advice.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional


# ─── Data Models ─────────────────────────────────────────────────────────────

@dataclass
class WorkerProfile:
    """Worker characteristics that affect heat illness risk."""
    age: int = 35                    # Worker age in years
    acclimatized: bool = True        # Has worker been gradually exposed for 7-14 days?
    fitness_level: str = "moderate"  # "sedentary", "moderate", "fit", "athletic"
    hydration_status: str = "normal" # "dehydrated", "normal", "well_hydrated"
    clothing: str = "standard"       # "light", "standard", "heavy", "protective"
    medical_conditions: List[str] = field(default_factory=list)  # ["obesity", "cardiovascular", "diabetes", "medications"]
    body_weight_kg: float = 75.0
    experience_months: int = 12      # Months working in heat


@dataclass
class EnvironmentalConditions:
    """Current environmental conditions at the work site."""
    temperature_c: float = 30.0      # Air temperature (°C)
    heat_index_c: float = 33.0       # Heat index (°C) — what it feels like
    humidity_percent: float = 50.0   # Relative humidity (%)
    solar_radiation_wm2: float = 500.0  # Solar irradiance (W/m²)
    wind_speed_ms: float = 2.0       # Wind speed (m/s)
    wbgt_c: float = 0.0             # Wet Bulb Globe Temperature (°C) — computed if not provided


@dataclass
class WorkProfile:
    """Work characteristics."""
    workload: str = "moderate"       # "light", "moderate", "heavy", "very_heavy"
    duration_hours: float = 4.0      # Hours of continuous work
    rest_break_min: int = 15         # Rest break duration (minutes)
    rest_frequency_min: int = 60     # How often rest breaks are taken (minutes)
    work_start_hour: int = 10        # Hour work starts (0-23)
    outdoor: bool = True             # Outdoor work?


@dataclass
class PredictionResult:
    """Output of the heat illness prediction."""
    probability_percent: float       # 0-100% probability of heat illness
    risk_level: str                  # "LOW", "MODERATE", "HIGH", "VERY_HIGH", "EXTREME"
    risk_color: str                  # Hex color for display
    wbgt_c: float                    # Computed WBGT
    risk_category_osha: str          # NIOSH risk category
    threshold_crossed: str           # Which threshold is being exceeded
    exposure_limit_percent: float    # % of NIOSH REL being used
    factors: Dict[str, float]        # Contribution of each factor (0-1)
    advice_human: str                # Human-friendly plain-language advice
    advice_actions: List[str]        # Specific actions to take
    work_rest_recommendation: str    # Recommended work-rest cycle
    source: str                      # "NIOSH REL" / "OSHA Action" / etc.


# ─── WBGT Estimation ─────────────────────────────────────────────────────────

def estimate_wbgt(temp_c: float, humidity: float, solar_wm2: float, wind_ms: float) -> float:
    """
    Estimate Wet Bulb Globe Temperature from available data.
    Uses simplified Liljegren model approximation.
    
    When actual WBGT equipment isn't available, this estimation is standard practice.
    """
    # Saturation vapor pressure (Tetens formula)
    es = 0.6108 * (2.7183 ** (17.27 * temp_c / (temp_c + 237.3)))
    
    # Actual vapor pressure
    ea = es * humidity / 100.0
    
    # Natural wet bulb temperature approximation
    tw = temp_c * 0.45 + ea * 3.6 + 2.8
    
    # Globe temperature (solar radiation effect)
    tg = temp_c + solar_wm2 * 0.012 + 0.5
    
    # WBGT (outdoor with sun)
    wbgt = 0.7 * tw + 0.2 * tg + 0.1 * temp_c
    
    # Wind cooling effect (minimal at low speeds)
    if wind_ms > 3.0:
        wbgt -= (wind_ms - 3.0) * 0.3
    
    return round(max(wbgt, temp_c * 0.7), 1)


# ─── NIOSH REL Thresholds (WBGT in °C) ─────────────────────────────────────

NIOSH_REL = {
    # (WBGT threshold °C, workload)
    "light":     {"acclimated": 28.0, "unacclimated": 26.7},
    "moderate":  {"acclimated": 25.0, "unacclimated": 23.0},
    "heavy":     {"acclimated": 23.0, "unacclimated": 20.0},
    "very_heavy": {"acclimated": 18.0, "unacclimated": 16.0},
}

# Work-rest cycles (work minutes per rest period at various WBGT levels)
WORK_REST_CYCLES = {
    "light": {
        (25, 28): "50 min work / 10 min rest",
        (28, 30): "40 min work / 20 min rest",
        (30, 33): "25 min work / 35 min rest",
        (33, 99): "STOP — exceed safe limits",
    },
    "moderate": {
        (22, 25): "45 min work / 15 min rest",
        (25, 28): "30 min work / 30 min rest",
        (28, 30): "20 min work / 40 min rest",
        (30, 99): "STOP — exceed safe limits",
    },
    "heavy": {
        (20, 23): "35 min work / 25 min rest",
        (23, 25): "20 min work / 40 min rest",
        (25, 28): "10 min work / 50 min rest",
        (28, 99): "STOP — exceed safe limits",
    },
    "very_heavy": {
        (16, 18): "25 min work / 35 min rest",
        (18, 20): "15 min work / 45 min rest",
        (20, 99): "STOP — exceed safe limits",
    },
}


# ─── Risk Multipliers ────────────────────────────────────────────────────────

def _age_multiplier(age: int) -> float:
    """Age increases heat illness risk. OSHA notes >65 is highest risk."""
    if age < 25:
        return 0.9   # Younger workers slightly lower risk (but less experienced)
    elif age < 40:
        return 1.0   # Baseline
    elif age < 55:
        return 1.15  # Moderate increase
    elif age < 65:
        return 1.3   # Significant increase
    else:
        return 1.5   # OSHA high-risk category


def _acclimatization_multiplier(acclimated: bool, experience_months: int) -> float:
    """Acclimatization is the single biggest factor. OSHA: 7-14 days needed."""
    if acclimated and experience_months >= 3:
        return 0.7   # Well acclimated
    elif acclimated:
        return 0.85  # Partially acclimated
    elif experience_months >= 1:
        return 1.0   # Some experience
    else:
        return 1.4   # New worker — highest risk (OSHA data: most deaths in first 3 days)


def _fitness_multiplier(level: str) -> float:
    return {"sedentary": 1.3, "moderate": 1.0, "fit": 0.85, "athletic": 0.8}.get(level, 1.0)


def _hydration_multiplier(status: str) -> float:
    return {"dehydrated": 1.5, "normal": 1.0, "well_hydrated": 0.85}.get(status, 1.0)


def _clothing_multiplier(clothing: str) -> float:
    """Heavy/protective clothing traps heat. WBGT adjustments from ACGIH."""
    return {"light": 0.85, "standard": 1.0, "heavy": 1.15, "protective": 1.4}.get(clothing, 1.0)


def _medical_multiplier(conditions: List[str]) -> float:
    """Medical conditions significantly increase risk."""
    mult = 1.0
    risk_map = {
        "obesity": 1.2,
        "cardiovascular": 1.4,
        "diabetes": 1.3,
        "medications": 1.25,  # Diuretics, beta-blockers, etc.
        "dehydration": 1.3,
        "alcohol": 1.2,
        "fever": 1.5,
        "skin_condition": 1.1,
    }
    for cond in conditions:
        mult *= risk_map.get(cond.lower(), 1.0)
    return min(mult, 2.5)  # Cap at 2.5x


def _workload_multiplier(workload: str) -> float:
    """Higher workload = more metabolic heat production."""
    return {"light": 0.8, "moderate": 1.0, "heavy": 1.3, "very_heavy": 1.6}.get(workload, 1.0)


def _duration_multiplier(hours: float) -> float:
    """Longer exposure increases cumulative risk."""
    if hours <= 2:
        return 0.9
    elif hours <= 4:
        return 1.0
    elif hours <= 6:
        return 1.15
    else:
        return 1.3


def _time_of_day_multiplier(hour: int, outdoor: bool) -> float:
    """Peak heat hours (12-16) are most dangerous."""
    if not outdoor:
        return 0.85  # Indoor slightly lower
    if 12 <= hour <= 16:
        return 1.2   # Peak heat
    elif 10 <= hour <= 18:
        return 1.0   # Warm period
    elif 6 <= hour <= 10:
        return 0.8   # Morning — safest
    else:
        return 0.7   # Evening/night


# ─── Main Prediction Function ────────────────────────────────────────────────

def predict_heat_illness(
    env: EnvironmentalConditions,
    worker: WorkerProfile = None,
    work: WorkProfile = None,
) -> PredictionResult:
    """
    Predict heat illness probability based on environmental conditions,
    worker profile, and work characteristics.
    
    Uses NIOSH REL thresholds as the foundation, modified by individual risk factors.
    """
    if worker is None:
        worker = WorkerProfile()
    if work is None:
        work = WorkProfile()
    
    # 1. Compute WBGT if not provided
    if env.wbgt_c <= 0:
        wbgt = estimate_wbgt(env.temperature_c, env.humidity_percent, env.solar_radiation_wm2, env.wind_speed_ms)
    else:
        wbgt = env.wbgt_c
    
    # 2. Find NIOSH REL threshold for this workload
    workload_key = work.workload if work.workload in NIOSH_REL else "moderate"
    accl_key = "acclimated" if worker.acclimatized else "unacclimated"
    rel_threshold = NIOSH_REL[workload_key][accl_key]
    
    # 3. Compute exposure ratio (WBGT / REL threshold)
    # >1.0 means exceeding the exposure limit
    exposure_ratio = wbgt / rel_threshold if rel_threshold > 0 else 1.0
    exposure_pct = min(exposure_ratio * 100, 200)  # Cap at 200%
    
    # 4. Compute base risk from exposure ratio
    if exposure_ratio < 0.8:
        base_risk = 5 + (exposure_ratio - 0.5) * 30  # 5-14%
    elif exposure_ratio < 1.0:
        base_risk = 14 + (exposure_ratio - 0.8) * 80  # 14-30%
    elif exposure_ratio < 1.2:
        base_risk = 30 + (exposure_ratio - 1.0) * 100  # 30-50%
    elif exposure_ratio < 1.5:
        base_risk = 50 + (exposure_ratio - 1.2) * 100  # 50-80%
    else:
        base_risk = 80 + min((exposure_ratio - 1.5) * 40, 19)  # 80-99%
    
    # 5. Apply individual risk multipliers
    age_mult = _age_multiplier(worker.age)
    accl_mult = _acclimatization_multiplier(worker.acclimatized, worker.experience_months)
    fitness_mult = _fitness_multiplier(worker.fitness_level)
    hydration_mult = _hydration_multiplier(worker.hydration_status)
    clothing_mult = _clothing_multiplier(worker.clothing)
    medical_mult = _medical_multiplier(worker.medical_conditions)
    workload_mult = _workload_multiplier(work.workload)
    duration_mult = _duration_multiplier(work.duration_hours)
    tod_mult = _time_of_day_multiplier(work.work_start_hour, work.outdoor)
    
    # Combined multiplier (not all multiplicative — use geometric mean approach)
    all_mults = [age_mult, accl_mult, fitness_mult, hydration_mult, clothing_mult,
                 medical_mult, workload_mult, duration_mult, tod_mult]
    
    # Geometric mean of multipliers (prevents runaway multiplication)
    import math
    geo_mean = math.exp(sum(math.log(m) for m in all_mults) / len(all_mults))
    
    # 6. Final probability
    final_probability = min(base_risk * geo_mean, 99.0)
    
    # 7. Risk level classification
    if final_probability < 15:
        risk_level = "LOW"
        risk_color = "#22c55e"
        threshold_crossed = "Below OSHA action level"
    elif final_probability < 35:
        risk_level = "MODERATE"
        risk_color = "#eab308"
        threshold_crossed = "Approaching NIOSH REL"
    elif final_probability < 60:
        risk_level = "HIGH"
        risk_color = "#f97316"
        threshold_crossed = "Exceeds NIOSH REL"
    elif final_probability < 80:
        risk_level = "VERY_HIGH"
        risk_color = "#ef4444"
        threshold_crossed = "Well above NIOSH REL"
    else:
        risk_level = "EXTREME"
        risk_color = "#7f1d1d"
        threshold_crossed = "Danger zone — immediate stop required"
    
    # 8. Determine which threshold is crossed
    if wbgt >= 28.0:
        source = "Above NIOSH REL (WBGT 28°C)"
    elif wbgt >= 26.7:
        source = "Above OSHA Action Level (WBGT 26.7°C)"
    elif wbgt >= 25.0:
        source = "Approaching NIOSH REL"
    else:
        source = "Below action thresholds"
    
    # 9. Work-rest recommendation
    workload_cycles = WORK_REST_CYCLES.get(workload_key, WORK_REST_CYCLES["moderate"])
    work_rest_rec = "Standard intervals"
    for (low, high), rec in workload_cycles.items():
        if low <= wbgt < high:
            work_rest_rec = rec
            break
    
    # 10. Factor contributions (for explainability)
    factors = {
        "heat_exposure": round(exposure_ratio / 2.0, 2),  # Normalized 0-1
        "age": round((age_mult - 0.8) / 0.7, 2),
        "acclimatization": round((accl_mult - 0.7) / 0.7, 2),
        "fitness": round((fitness_mult - 0.8) / 0.5, 2),
        "hydration": round((hydration_mult - 0.85) / 0.65, 2),
        "clothing": round((clothing_mult - 0.85) / 0.55, 2),
        "medical": round((medical_mult - 1.0) / 1.5, 2),
        "workload": round((workload_mult - 0.8) / 0.8, 2),
        "duration": round((duration_mult - 0.9) / 0.4, 2),
        "time_of_day": round((tod_mult - 0.7) / 0.5, 2),
    }
    
    # 11. Generate human-friendly advice
    advice_human, advice_actions = _generate_advice(
        risk_level, wbgt, env, worker, work, exposure_ratio
    )
    
    return PredictionResult(
        probability_percent=round(final_probability, 1),
        risk_level=risk_level,
        risk_color=risk_color,
        wbgt_c=wbgt,
        risk_category_osha=f"{workload_key.title()} work — {accl_key}",
        threshold_crossed=threshold_crossed,
        exposure_limit_percent=round(exposure_pct, 1),
        factors=factors,
        advice_human=advice_human,
        advice_actions=advice_actions,
        work_rest_recommendation=work_rest_rec,
        source=source,
    )


# ─── Human-Friendly Advice Generator ─────────────────────────────────────────

def _generate_advice(
    risk_level: str, wbgt: float, env: EnvironmentalConditions,
    worker: WorkerProfile, work: WorkProfile, exposure_ratio: float,
) -> tuple:
    """Generate plain-language advice that humans can act on immediately."""
    
    temp_f = env.temperature_c * 9 / 5 + 32
    hi_f = env.heat_index_c * 9 / 5 + 32
    
    advice_actions = []
    
    if risk_level == "LOW":
        advice = (
            f"✅ **Safe to work outdoors.** The heat index is {env.heat_index_c:.0f}°C ({hi_f:.0f}°F), "
            f"which is in the manageable range. Workers can proceed with normal activities.\n\n"
            f"**What to do:**\n"
            f"• Keep water bottles filled — aim for 1 cup every 15-20 minutes\n"
            f"• Take shade breaks if working more than 2 hours continuously\n"
            f"• Watch for early warning signs: excessive thirst, heavy sweating\n"
            f"• Best working hours: early morning (6-10 AM) if possible"
        )
        advice_actions = [
            "Ensure water stations are stocked and accessible",
            "Confirm shade structures are deployed",
            "Remind workers of hydration schedule",
            "Buddy system — no one works alone in heat",
        ]
    
    elif risk_level == "MODERATE":
        advice = (
            f"⚠️ **Work with caution.** The heat index is {env.heat_index_c:.0f}°C ({hi_f:.0f}°F), "
            f"which means heat cramps and exhaustion are possible with prolonged exposure.\n\n"
            f"**What to do right now:**\n"
            f"• Mandatory rest breaks every 30-45 minutes in shade\n"
            f"• Increase water intake — 1 cup every 15 minutes minimum\n"
            f"• Use the buddy system — check on each other for symptoms\n"
            f"• Reschedule heavy physical work to before 10 AM or after 4 PM\n"
            f"• Have cooling towels and ice packs ready"
        )
        advice_actions = [
            "Mandate 10-minute rest breaks every 45 minutes",
            "Deploy additional shade structures and misting fans",
            "Assign buddy pairs — no solo outdoor work",
            "Monitor workers for: heavy sweating, dizziness, nausea",
            "Pre-position ice and cold water at work zones",
            "Consider rescheduling heavy tasks to cooler hours",
        ]
    
    elif risk_level == "HIGH":
        advice = (
            f"🟠 **Significant risk — limit outdoor exposure.** The heat index is {env.heat_index_c:.0f}°C ({hi_f:.0f}°F). "
            f"Heat exhaustion is likely with continued outdoor work. Heat cramps are very possible.\n\n"
            f"**What to do right now:**\n"
            f"• Mandatory rest every 30 minutes — 15 min minimum in shade/AC\n"
            f"• Stop all heavy physical work during peak heat (12-3 PM)\n"
            f"• Assign a safety monitor to watch for heat illness symptoms\n"
            f"• Keep emergency cooling supplies on site (ice baths, cold towels)\n"
            f"• Consider sending non-essential workers indoors"
        )
        advice_actions = [
            "HALT heavy outdoor work from 12:00-15:00",
            "Mandatory 15-min rest every 30 minutes of work",
            "Assign dedicated safety observer for heat symptoms",
            "Pre-position emergency cooling equipment on-site",
            "Reschedule all non-essential outdoor tasks to early AM",
            "Verify first aid kit includes heat illness supplies",
            "Ensure emergency contact numbers are posted",
        ]
    
    elif risk_level == "VERY_HIGH":
        advice = (
            f"🔴 **Dangerous conditions — minimize outdoor work.** The heat index is {env.heat_index_c:.0f}°C ({hi_f:.0f}°F). "
            f"Heat stroke is possible. This is a serious safety hazard.\n\n"
            f"**What to do right now:**\n"
            f"• STOP all heavy outdoor work immediately if not essential\n"
            f"• Only critical maintenance should continue, with 1:1 work-rest ratio\n"
            f"• Every worker must have a buddy watching for heat stroke symptoms\n"
            f"• Emergency cooling station must be within 50 feet of all workers\n"
            f"• If anyone shows confusion, slurred speech, or stops sweating — call 911"
        )
        advice_actions = [
            "STOP non-essential outdoor work immediately",
            "1:1 work-to-rest ratio for critical tasks only",
            "Emergency cooling station with ice baths on standby",
            "Safety monitor assigned to every 2 workers",
            "911 on speed dial — heat stroke is life-threatening",
            "Post-incident review required after any heat event",
            "Document all exposure hours for OSHA compliance",
        ]
    
    else:  # EXTREME
        advice = (
            f"🚨 **EMERGENCY — STOP ALL OUTDOOR WORK.** The heat index is {env.heat_index_c:.0f}°C ({hi_f:.0f}°F). "
            f"Heat stroke is highly likely and can be fatal.\n\n"
            f"**Immediate actions:**\n"
            f"• STOP all outdoor work immediately — no exceptions\n"
            f"• Move all workers to air-conditioned or shaded areas\n"
            f"• Ensure cold water and ice are immediately available\n"
            f"• Monitor every worker for 2 hours after heat exposure ends\n"
            f"• If anyone shows confusion, hot/dry skin, or seizures — call 911 immediately\n"
            f"• Document the heat event for OSHA compliance"
        )
        advice_actions = [
            "STOP ALL outdoor work — evacuate to cool area",
            "Call 911 if any worker shows heat stroke symptoms",
            "Provide cold water and ice immediately",
            "Monitor all workers for 2 hours post-exposure",
            "Document event for OSHA compliance record",
            "Do not resume outdoor work until conditions improve",
            "Post-incident review mandatory within 24 hours",
        ]
    
    # Add weather-specific advice
    if env.humidity_percent > 70:
        advice += f"\n\n💧 **High humidity ({env.humidity_percent:.0f}%)** makes it harder for sweat to evaporate and cool the body. Extra hydration and rest breaks are critical."
    
    if work.outdoor and 12 <= work.work_start_hour <= 15:
        advice += f"\n\n⏰ **Peak heat hours.** Work starting at {work.work_start_hour}:00 coincides with the hottest part of the day. Consider rescheduling to before 10 AM."
    
    if not worker.acclimatized:
        advice += f"\n\n🆕 **Worker is not acclimatized.** New workers are at highest risk — OSHA data shows most heat deaths occur in the first 3 days. Reduce workload by 50% and increase rest frequency."
    
    if worker.age >= 65:
        advice += f"\n\n👤 **Worker aged {worker.age}** is in OSHA's highest-risk age group. Extra monitoring and shorter work periods are essential."
    
    return advice, advice_actions


def prediction_to_dict(result: PredictionResult) -> Dict:
    """Convert PredictionResult to JSON-serializable dict."""
    return {
        "probability_percent": result.probability_percent,
        "risk_level": result.risk_level,
        "risk_color": result.risk_color,
        "wbgt_c": result.wbgt_c,
        "risk_category_osha": result.risk_category_osha,
        "threshold_crossed": result.threshold_crossed,
        "exposure_limit_percent": result.exposure_limit_percent,
        "factors": result.factors,
        "advice_human": result.advice_human,
        "advice_actions": result.advice_actions,
        "work_rest_recommendation": result.work_rest_recommendation,
        "source": result.source,
    }
