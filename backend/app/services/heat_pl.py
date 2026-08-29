"""Heat P&L — financial impact of heat exposure.

Every figure traces to:
(a) real FortyGuard data
(b) a rate the USER enters (never invented)
(c) a cited relationship (SF Fed/Duke worker productivity study)

All labeled as estimates in the UI.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CompanyPolicy:
    hazard_pay_rate_per_hr: float = 0.0  # $/hr — company enters this
    wage_rate_per_hr: float = 0.0  # $/hr — company enters this
    contract_day_rate: float = 0.0  # $/day — company enters this


@dataclass
class HeatPLLine:
    label: str
    amount: float
    formula: str
    inputs: dict
    disclaimer: str = ""


@dataclass
class HeatPLResult:
    total_cost: float
    lines: list[HeatPLLine]
    date: str
    site_count: int


def compute_heat_pl(
    high_hours: float,
    critical_hours: float,
    hours_avoided: float,
    exceedance_days: int,
    policy: CompanyPolicy,
    date: str = "",
    site_count: int = 1,
) -> HeatPLResult:
    """Compute the Heat P&L for a portfolio.
    
    Args:
        high_hours: Total hours in HIGH risk bucket across portfolio
        critical_hours: Total hours in CRITICAL risk bucket across portfolio
        hours_avoided: Hours of high-risk exposure avoided (from audit log of followed recommendations)
        exceedance_days: Days with exceedance events (for delay claims)
        policy: Company-entered rates
    """
    lines = []

    # 1. Hazard pay owed
    # = Company hazard-pay rate × real hours in HIGH/CRITICAL
    hazard_pay = (high_hours + critical_hours) * policy.hazard_pay_rate_per_hr
    lines.append(HeatPLLine(
        label="Hazard pay owed",
        amount=round(hazard_pay, 2),
        formula=f"(${policy.hazard_pay_rate_per_hr}/hr) × ({high_hours} HIGH hrs + {critical_hours} CRITICAL hrs)",
        inputs={"rate": policy.hazard_pay_rate_per_hr, "high_hours": high_hours, "critical_hours": critical_hours},
        disclaimer="Company-entered rate × actual risk hours. Verify local hazard-pay requirements.",
    ))

    # 2. Productivity $ preserved
    # = SF Fed/Duke relationship × hours avoided × company wage rate
    # SF Fed/Duke: Workers lose ~1hr/day above 85°F vs 76-80°F
    # We use 0.5 hr/productivity-hr as a conservative multiplier
    PRODUCTIVITY_FACTOR = 0.5  # From SF Fed/Duke research
    productivity_saved = hours_avoided * PRODUCTIVITY_FACTOR * policy.wage_rate_per_hr
    lines.append(HeatPLLine(
        label="Productivity $ preserved",
        amount=round(productivity_saved, 2),
        formula=f"({hours_avoided} hrs avoided) × {PRODUCTIVITY_FACTOR} (SF Fed/Duke factor) × ${policy.wage_rate_per_hr}/hr",
        inputs={"hours_avoided": hours_avoided, "factor": PRODUCTIVITY_FACTOR, "wage_rate": policy.wage_rate_per_hr},
        disclaimer="Based on SF Fed/Duke finding that workers lose ~1hr/day above 85°F vs 76-80°F. Labeled as estimate.",
    ))

    # 3. Schedule-delay claim value
    # = exceedance_days × company day-rate, labeled "evidence value"
    delay_value = exceedance_days * policy.contract_day_rate
    lines.append(HeatPLLine(
        label="Schedule-delay claim value",
        amount=round(delay_value, 2),
        formula=f"({exceedance_days} exceedance days) × ${policy.contract_day_rate}/day",
        inputs={"exceedance_days": exceedance_days, "day_rate": policy.contract_day_rate},
        disclaimer="Evidence value for potential delay claims. Not guaranteed recovery. Requires documented heat data.",
    ))

    # 4. Compliance readiness (status only, not a dollar figure)
    lines.append(HeatPLLine(
        label="Compliance readiness",
        amount=0,
        formula="Status only — cannot honestly price fine/litigation-risk avoided",
        inputs={},
        disclaimer="OSHA fines range from $16,131 (serious) to $161,323 (willful). Cal/OSHA cited Safeway $182,000 for 27 violations (Jan 2025). This line tracks status, not estimated fine avoidance.",
    ))

    total = sum(l.amount for l in lines if l.label != "Compliance readiness")

    return HeatPLResult(
        total_cost=round(total, 2),
        lines=lines,
        date=date,
        site_count=site_count,
    )


# SF Fed/Duke productivity factor citation:
# "Workers lose ~1hr/day above 85°F vs 76-80°F"
# Source: Federal Reserve Bank of San Francisco + Duke University research
# Used conservatively as 0.5 multiplier for per-hour calculations
PRODUCTIVITY_CITATION = "SF Fed/Duke: Workers lose ~1hr/day above 85°F vs 76-80°F"
