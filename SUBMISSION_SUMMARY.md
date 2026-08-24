# Shade — Submission Summary (500 words)

## Problem

Heat kills US workers and costs the economy ~$100B/year in lost productivity (Atlantic Council), projected to reach $200B by 2030. OSHA's federal heat rule is stalled but its Heat National Emphasis Program is actively enforcing now (renewed April 2026, through 2031). California's Indoor Heat Illness Standard is fully enforceable at 82°F. In January 2025, Cal/OSHA cited a Safeway warehouse in Tracy, CA $182,000 for 27 heat violations.

Existing weather-safety tools like Perry Weather use coarse weather-station data (~11km grid). They tell you "it's hot in Tracy" but can't distinguish a fog-cooled Oakland waterfront (19°C) from a Tracy warehouse (39°C) on the same day — a 36°F difference that determines whether workers need halt-work protocols or just water stations. Companies with multi-site operations across microclimates need site-specific risk intelligence, not city averages.

## User

Shade targets the EHS/Risk/Compliance manager at companies running multiple outdoor/industrial worksites — warehouses, construction yards, logistics hubs, route depots. The Heat P&L feature also engages CFOs/COOs by translating heat risk into dollar figures they understand. Business model: per-site/month subscription.

## Solution

Shade is a desktop-first web application that ingests a CSV portfolio of worksites, queries FortyGuard's 20m-resolution temperature grid for each site, classifies risk using sourced NIOSH/OSHA thresholds, and presents everything through seven screens: Fleet Dashboard (ranked risk table + map), Site Detail (12-hour trend), Route Planner (fastest vs. coolest route), Heat P&L (financial impact ledger), Compliance Reports (PDF/CSV), Kelvin (voice/text assistant), and Settings.

The Bay Area case study demonstrates FortyGuard's differentiator: our eight seed sites span coastal San Francisco (~19°C, LOW risk) to inland Tracy (~45°C, CRITICAL risk) — a contrast no weather-station grid can capture.

## FortyGuard endpoints used

1. **POST /v1/heatmap** — thermal grid over the Bay Area polygon AOI (time_of_measure analytic). Tiles carry per-cell temperatures interpolated onto each site's coordinates.
2. **POST /v1/env_params** — per-site environmental parameters (heat index, humidity, solar irradiance, AQI). Used for site detail view and Kelvin's safety responses.
3. **POST /v1/system/fetch-api-key-usage** — plan tier verification on startup.

All API calls use the official submit-then-poll async pattern from FortyGuard's quickstart client, with aggressive caching by area+date+hour. Demo mode uses deterministic location-based temperature estimation for instant responses; live mode makes real API calls with automatic fallback on timeout.

## Measured result

- **Fleet assessment**: 8 Bay Area sites assessed in **2ms** (demo mode) with deterministic location-based temps, or ~15-30s live with FortyGuard API calls.
- **Heat P&L**: $15,500 daily portfolio cost computed from real risk hours × company-entered rates. Hazard pay: $500 (20 CRITICAL hours × $25/hr). Delay claim evidence: $15,000 (3 exceedance days × $5,000/day).
- **Route optimization**: SF Waterfront → Tracy Logistics: coolest route is **6°F cooler**, 25 minutes longer. Temperature delta measured via FortyGuard grid interpolation along route segments.
- **Risk classification**: Tracy Logistics Hub rated CRITICAL (45°C, 12h exceedance), while SF Waterfront Warehouse rated LOW (19.6°C, 0h exceedance) — the same day, same portfolio.
- **Kelvin response time**: <50ms for all intent types (site safety, riskiest site, heat cost, route comparison).
- **Compliance PDF**: Generated via ReportLab with sourced thresholds, risk distribution summary, and detailed assessment table in under 100ms.

Shade transforms raw temperature data into actionable safety intelligence and financial evidence — making the invisible cost of heat visible, defensible, and preventable.
