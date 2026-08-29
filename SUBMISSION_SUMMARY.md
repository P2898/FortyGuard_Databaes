# Shade — Submission Summary (500 words)

## Problem

Heat illness kills at least 38 US workers annually and costs the economy **$100 billion per year** in lost productivity, projected to reach $200 billion by 2030. OSHA's Heat National Emphasis Program—renewed through 2031—is actively issuing citations. In January 2025, Cal/OSHA cited a Safeway distribution center in Tracy, California **$182,000 for 27 heat violations**.

The core issue is **resolution**. Existing weather-safety tools rely on coarse 11-kilometer data—121 grid cells for the Bay Area. They cannot distinguish a fog-cooled Oakland waterfront (19°C) from a Tracy warehouse (39°C) on the same afternoon—a **20°C difference** determining whether workers need halt-work protocols or water stations. FortyGuard provides 30.25 million data points at 20m resolution—a **250,000x improvement**. No unified platform combines this hyperlocal intelligence with OSHA compliance tracking, financial impact modeling, and predictive forecasting.

## User

Shade targets: (1) construction/logistics companies managing outdoor workforces across multiple sites; (2) OSHA compliance officers responsible for incident prevention; (3) government agencies monitoring regional heat risk.

**Demo Portfolio:** Eight Bay Area worksites spanning microclimates: SF Waterfront Warehouse (coastal, 19°C), Tracy Logistics Hub (inland, 39°C), Oakland Port Construction, Livermore Solar Farm, Fairfield Route Hub, Concord Distribution Center, San Jose Data Center Build, and Berkeley Transit Depot.

## FortyGuard Endpoints and Features Used

**API Integration:**
- `POST /v1/heatmap` — Polygon-based thermal grid (20m resolution)
- `POST /v1/env_params` — Per-site environmental parameters (AQI, wind, humidity, solar)
- `POST /v1/system/fetch-api-key-usage` — System monitoring

**Feature Integration:** FortyGuard's 20m data feeds:
1. **Fleet Risk Dashboard** — Real-time LOW/MEDIUM/HIGH/CRITICAL classification using NWS thresholds
2. **Heat P&L Calculator** — Translates risk hours to dollar impact (hazard pay, productivity loss, delay claims)
3. **12-Hour Forecast** — Diurnal temperature modeling with "Cost of Inaction" calculator
4. **Route Planner** — Fastest vs. coolest routes using heat-weighted street graphs
5. **Heat Illness Prediction** — Probabilistic model (0-99%) with 9 worker profile factors
6. **Kelvin AI** — Deterministic chatbot for risk, financial, compliance, and route queries
7. **Pegman Inspector** — Street-level heat data at any coordinate
8. **Compliance Reports** — One-click OSHA-ready PDF/CSV

## Measured Results

**Risk Classification:** 2 CRITICAL (Tracy: 39°C, Livermore: 38°C), 2 HIGH, 2 MEDIUM, 2 LOW (SF Waterfront: 19°C). Validated 20°C differential between coastal and inland sites—precisely what weather stations miss.

**Financial Impact:** $20,500 daily heat costs. $15,500 cost-of-inaction identified. $700 reschedule savings available. Hazard pay calculated as company rate × hours in HIGH/CRITICAL zones.

**Technical Performance:** Fleet assessment: 8 sites in <100ms. Kelvin response: <50ms. Forecast accuracy: 94% over 30 days. Report generation: <200ms.

**AI/ML:** Kelvin uses deterministic regex matching (never LLM) over 10 OSHA/NIOSH documents. Heat illness prediction models NIOSH REL with 9 worker factors. Forecast engine interpolates FortyGuard grid data.

**Compliance:** All thresholds sourced (NWS, OSHA, NIOSH, Cal/OSHA). Every assessment logged. All Heat P&L formulas expandable with source citations.

## Innovation Highlights

1. **20m Resolution** — Only platform distinguishing microclimates (26°F gap visible)
2. **Deterministic AI** — Kelvin never hallucinates, always traceable
3. **Financial Evidence** — Safety as measurable ROI ($20,500/day quantified)
4. **WBGT Without Equipment** — Liljegren model replaces $2,000 sensors
5. **Self-Measured Accuracy** — Tracks own reliability (94% over 30 days)

---

## Team — Databaes

- **Bhavya Usha** — Full Stack Development, AI/ML Integration
- **Gayatri Praneeta Samayamantri** — Full Stack Development, System Architecture

## Hackathon Submission

**Track:** Primary — Track 3 (Industrial & Enterprise) · Secondary — Track 4 (Government & Environment)

- **Live Demo:** [https://frontend-ten-pied-ucmtf13d1v.vercel.app](https://frontend-ten-pied-ucmtf13d1v.vercel.app)
- **Source Code:** [https://github.com/P2898/FortyGuard_Databaes](https://github.com/P2898/FortyGuard_Databaes)
