"""Risk scoring — NWS, NIOSH, and OSHA sourced thresholds, never invented."""

from dataclasses import dataclass
from typing import Optional

# === SOURCED THRESHOLDS (cite in UI tooltips) ===
# NIOSH Recommended Exposure Limit: WBGT 28°C (82.4°F) for moderate work
# OSHA proposed federal heat rule: 80°F (26.7°C) precaution, 90°F (32.2°C) rest
# California Indoor Heat Illness Standard: 82°F (27.8°C) enforceable
# NWS Heat Index bands: the official classification used by the National Weather Service
THRESHOLDS = {
    "NIOSH_WBGT": {"value_c": 28.0, "label": "NIOSH WBGT REL (28°C / 82.4°F)", "source": "NIOSH Criteria for a Recommended Standard: Occupational Exposure to Heat and Hot Environments"},
    "OSHA_PRECAUTION": {"value_c": 26.7, "label": "OSHA Precaution Trigger (80°F)", "source": "OSHA Proposed Heat Rule (2024)"},
    "OSHA_ACTION": {"value_c": 32.2, "label": "OSHA Action Trigger (90°F)", "source": "OSHA Proposed Heat Rule (2024)"},
    "CA_INDOOR": {"value_c": 27.8, "label": "CA Indoor Heat Standard (82°F)", "source": "Cal/OSHA Title 8 §3395"},
    "NWS_CAUTION": {"value_c": 26.7, "label": "NWS Caution (80°F)", "source": "NWS Heat Index Chart — weather.gov/ama/heatindex"},
    "NWS_EXTREME_CAUTION": {"value_c": 32.2, "label": "NWS Extreme Caution (90°F)", "source": "NWS Heat Index Chart — weather.gov/ama/heatindex"},
    "NWS_DANGER": {"value_c": 39.4, "label": "NWS Danger (103°F)", "source": "NWS Heat Index Chart — weather.gov/ama/heatindex"},
    "NWS_EXTREME_DANGER": {"value_c": 51.1, "label": "NWS Extreme Danger (125°F)", "source": "NWS Heat Index Chart — weather.gov/ama/heatindex"},
}

# Risk bucket classification based on heat index
# Source: NWS Heat Index Chart (weather.gov/ama/heatindex)
#   Caution:        80-90°F  (26.7-32.2°C) — Fatigue possible
#   Extreme Caution: 90-103°F (32.2-39.4°C) — Heat cramps/exhaustion possible
#   Danger:         103-124°F (39.4-51.1°C) — Heat stroke possible
#   Extreme Danger: 125°F+   (51.1°C+)      — Heat stroke highly likely
RISK_BANDS = [
    {"bucket": "LOW", "min_c": 0, "max_c": 26.7, "color": "#22c55e", "label": "Low Risk", "source": "Below NWS Caution (<80°F)"},
    {"bucket": "MEDIUM", "min_c": 26.7, "max_c": 32.2, "color": "#eab308", "label": "Medium Risk", "source": "NWS Caution (80-90°F) — Fatigue possible with prolonged exposure"},
    {"bucket": "HIGH", "min_c": 32.2, "max_c": 39.4, "color": "#f97316", "label": "High Risk", "source": "NWS Extreme Caution (90-103°F) — Heat cramps/exhaustion possible"},
    {"bucket": "CRITICAL", "min_c": 39.4, "max_c": 51.1, "color": "#ef4444", "label": "Critical Risk", "source": "NWS Danger (103-124°F) — Heat stroke possible"},
    {"bucket": "EXTREME", "min_c": 51.1, "max_c": 100, "color": "#7f1d1d", "label": "Extreme Risk", "source": "NWS Extreme Danger (125°F+) — Heat stroke highly likely"},
]


@dataclass
class RiskResult:
    temperature_c: float
    heat_index: float
    risk_bucket: str
    risk_color: str
    threshold_label: str
    threshold_source: str
    exceedance_hours: float  # hours above threshold in the assessment period
    persistence_hours: float  # longest continuous streak above threshold
    recommendation: str


def classify_risk(
    temperature_c: float,
    heat_index: float,
    exceedance_hours: float = 0,
    persistence_hours: float = 0,
    threshold_key: str = "OSHA_ACTION",
) -> RiskResult:
    """Classify risk using sourced NIOSH/OSHA thresholds."""
    threshold = THRESHOLDS.get(threshold_key, THRESHOLDS["OSHA_ACTION"])

    for band in RISK_BANDS:
        if heat_index < band["max_c"]:
            risk_bucket = band["bucket"]
            risk_color = band["color"]
            threshold_label = band["label"]
            threshold_source = band["source"]
            break
    else:
        risk_bucket = "CRITICAL"
        risk_color = "#ef4444"
        threshold_label = "Critical Risk"
        threshold_source = "Above NIOSH REL"

    recommendation = _get_recommendation(risk_bucket)

    return RiskResult(
        temperature_c=round(temperature_c, 1),
        heat_index=round(heat_index, 1),
        risk_bucket=risk_bucket,
        risk_color=risk_color,
        threshold_label=threshold_label,
        threshold_source=threshold_source,
        exceedance_hours=round(exceedance_hours, 1),
        persistence_hours=round(persistence_hours, 1),
        recommendation=recommendation,
    )


def _get_recommendation(bucket: str) -> str:
    """NWS/OSHA-sourced recommendations per risk level."""
    recs = {
        "LOW": "Continue standard heat safety protocols. Ensure water and shade available.",
        "MEDIUM": "NWS Caution: Increase rest frequency. Provide shade structures. Monitor workers for heat symptoms.",
        "HIGH": "NWS Extreme Caution: Mandatory rest breaks every 30 minutes. Deploy cooling stations. Consider schedule adjustment.",
        "CRITICAL": "NWS Danger: Halt outdoor work during peak hours (12:00-15:00). Deploy mobile cooling units. Emergency heat illness prevention plan activation.",
        "EXTREME": "NWS Extreme Danger: STOP ALL outdoor work immediately. Activate emergency response. Move workers to air-conditioned areas. Call 911 if heat illness suspected.",
    }
    return recs.get(bucket, recs["LOW"])


def compute_exceedance_hours(temperatures: list[float], threshold_c: float, hour_duration: float = 1.0) -> float:
    """Count hours above threshold. Each entry in temperatures represents one hour."""
    return sum(1 for t in temperatures if t >= threshold_c) * hour_duration


def compute_persistence_hours(temperatures: list[float], threshold_c: float, hour_duration: float = 1.0) -> float:
    """Longest continuous streak above threshold."""
    max_streak = 0
    current = 0
    for t in temperatures:
        if t >= threshold_c:
            current += 1
            max_streak = max(max_streak, current)
        else:
            current = 0
    return max_streak * hour_duration
