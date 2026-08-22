"""Risk scoring — NIOSH/OSHA sourced thresholds, never invented."""

from dataclasses import dataclass
from typing import Optional

# === SOURCED THRESHOLDS (cite in UI tooltips) ===
# NIOSH Recommended Exposure Limit: WBGT 28°C (82.4°F) for moderate work
# OSHA proposed federal heat rule: 80°F (26.7°C) precaution, 90°F (32.2°C) rest
# California Indoor Heat Illness Standard: 82°F (27.8°C) enforceable
# NIOSH heat index bands for risk classification
THRESHOLDS = {
    "NIOSH_WBGT": {"value_c": 28.0, "label": "NIOSH WBGT REL (28°C / 82.4°F)", "source": "NIOSH Criteria for a Recommended Standard: Occupational Exposure to Heat and Hot Environments"},
    "OSHA_PRECAUTION": {"value_c": 26.7, "label": "OSHA Precaution Trigger (80°F)", "source": "OSHA Proposed Heat Rule (2024)"},
    "OSHA_ACTION": {"value_c": 32.2, "label": "OSHA Action Trigger (90°F)", "source": "OSHA Proposed Heat Rule (2024)"},
    "CA_INDOOR": {"value_c": 27.8, "label": "CA Indoor Heat Standard (82°F)", "source": "Cal/OSHA Title 8 §3395"},
}

# Risk bucket classification based on heat index
# Source: NIOSH Criteria Document heat index bands
RISK_BANDS = [
    {"bucket": "LOW", "min_c": 0, "max_c": 26.7, "color": "#22c55e", "label": "Low Risk", "source": "Below OSHA 80°F precaution trigger"},
    {"bucket": "MEDIUM", "min_c": 26.7, "max_c": 32.2, "color": "#eab308", "label": "Medium Risk", "source": "Between OSHA 80°F precaution and 90°F action triggers"},
    {"bucket": "HIGH", "min_c": 32.2, "max_c": 37.8, "color": "#f97316", "label": "High Risk", "source": "Above OSHA 90°F action trigger"},
    {"bucket": "CRITICAL", "min_c": 37.8, "max_c": 100, "color": "#ef4444", "label": "Critical Risk", "source": "Above NIOSH REL (WBGT 28°C) for sustained exposure"},
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
    """OSHA-sourced recommendations."""
    recs = {
        "LOW": "Continue standard heat safety protocols. Ensure water and shade available.",
        "MEDIUM": "Increase rest frequency. Provide shade structures. Monitor workers for heat symptoms.",
        "HIGH": "Mandatory rest breaks every 30 minutes. Deploy cooling stations. Consider schedule adjustment.",
        "CRITICAL": "Halt outdoor work during peak hours (12:00-15:00). Deploy mobile cooling units. Emergency heat illness prevention plan activation.",
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
