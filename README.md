# Shade — FortyGuard Hackathon'26

**Worker safety, OSHA compliance, and heat-cost platform powered by FortyGuard's 20m hyperlocal temperature data.**

Shade turns FortyGuard's hyperlocal heat data into a multi-site worker-safety and heat-cost platform for companies that run many outdoor/industrial worksites. It doesn't just say "it's hot" — it tells a company exactly what heat cost them today, in dollars, with the paperwork to back it up.

---

## What it does

- **Fleet Risk Dashboard** — ranks all worksites as LOW/MEDIUM/HIGH/CRITICAL using FortyGuard data and sourced NIOSH/OSHA thresholds. One glance tells you where the danger is.
- **Heat-Colored Route Map** — compares fastest vs. heat-coolest route between two sites, rendered as a blue-to-red gradient polyline on Leaflet/OSM.
- **Heat P&L** — reframes heat as a financial ledger: hazard pay owed, productivity dollars preserved, schedule-delay claim value, and compliance readiness — every number traceable to real data or a cited source.
- **Kelvin** — voice/text safety assistant. Deterministic backend answers, never an LLM making up numbers. Supports Web Speech API mic input with voice toggle.
- **Compliance Reports** — generates "Shade Heat Exposure Record — Form SG-1" as PDF (ReportLab) and CSV, for site-level or company-wide rollup.
- **Audit Log** — every risk assessment is logged and queryable, serving as the single source of truth for Kelvin and reports.
- **CSV Upload** — ingest worksite portfolios via CSV (site_id, name, lat, lon, type). Validates US coordinates, no duplicates.

## Case study: San Francisco Bay Area

Deliberate choice. Coastal SF/Oakland stays mild (fog-cooled ~19°C) while inland Tracy/Livermore/Concord regularly hits 35-40°C+ the same day. That 20°F+ contrast is the best possible demo of FortyGuard's hyperlocal differentiator — a city-average weather API would completely miss it. Bonus: the real $182K Cal/OSHA Safeway fine happened in Tracy, part of this exact corridor.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Leaflet.js + OpenStreetMap |
| Backend | Python FastAPI, httpx |
| Database | Supabase (Postgres) with in-memory fallback |
| PDF Generation | ReportLab |
| Voice | Browser Web Speech API (STT + TTS) |
| Data Source | FortyGuard Temperature API |

## Quick start

### Requirements

- Node.js 18+
- Python 3.10+
- pnpm or npm

### 1. Clone and install

```bash
git clone https://github.com/P2898/FortyGuard_Databaes.git
cd FortyGuard_Databaes

# Frontend
cd frontend && npm install && cd ..

# Backend
cd backend && pip install -r requirements.txt && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set your FortyGuard API key:
# FORTYGUARD_API_KEY=your_key_here
```

### 3. Run

**Terminal 1 — Backend:**
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** — no login required.

## FortyGuard API request/response example

**Request — Environmental parameters for Tracy Logistics Hub:**

```json
POST https://api.fortyguard.com/v1/env_params
Headers: { "api-key": "YOUR_API_KEY", "Content-Type": "application/json" }
Body: {
  "latitude": 37.7397,
  "longitude": -121.4252,
  "temperature": 39,
  "date_time": {
    "start_date": "2026-08-24",
    "start_time": "14:00",
    "filter_type": 1
  }
}
```

**Response:**

```json
{
  "data": {
    "activity_id": "abc123...",
    "status": "succeeded",
    "result": {
      "heat_index_celsius": 42.3,
      "relative_humidity_percent": 28.5,
      "solar_irradiance": 847.2,
      "air_quality:idx": 45
    }
  }
}
```

## What's real vs. estimated

| Data point | Source |
|---|---|
| Site temperatures | FortyGuard 20m grid data (live) or deterministic location-based estimation (demo mode) |
| Risk thresholds | NIOSH WBGT REL (28°C), OSHA proposed triggers (80°F/90°F), CA Indoor Heat Standard (82°F) |
| Hazard pay owed | Company-entered rate × real hours in HIGH/CRITICAL |
| Productivity $ preserved | SF Fed/Duke research relationship (workers lose ~1hr/day above 85°F) × hours avoided × company wage rate — labeled as estimate |
| Schedule-delay claim value | Exceedance days × company day-rate — labeled as "evidence value, not guaranteed recovery" |
| Compliance readiness | Status only, never priced as avoided fine |
| Heat index calculations | Simplified Rothfusz regression from temperature + humidity |
| Route temperature deltas | FortyGuard grid interpolated onto route segments |

**Never fabricated:** market-size figures, health-outcome claims, death-prevention claims, or regulatory compliance guarantees.

## Project structure

```
backend/
  app/
    main.py              — FastAPI entry point
    config.py             — Environment variable loading
    database.py           — Supabase client (with in-memory fallback)
    routers/
      sites.py            — Site CRUD + CSV upload + Bay Area seed data
      assessment.py       — Fleet risk assessment engine
      heat_pl.py          — Heat P&L financial computations
      kelvin.py           — Voice/text safety assistant
      route.py            — Route planner with heat-colored routing
      reports.py          — PDF/CSV compliance report generation
    services/
      fortyguard.py       — FortyGuard API integration (submit-poll-cache)
      risk_scoring.py     — NIOSH/OSHA threshold classification
      heat_pl.py          — Financial impact computation
      kelvin.py           — Intent matching + response phrasing
frontend/
  src/
    App.tsx               — Main layout with sidebar navigation
    lib/api.ts            — API client types and functions
    components/
      FleetDashboard.tsx  — Ranked risk table + distribution chart
      FleetMap.tsx        — Leaflet map with risk-colored markers
      SiteDetail.tsx      — Per-site trend chart + env params
      RoutePlanner.tsx    — Heat-colored route comparison
      HeatPLScreen.tsx    — Financial impact dashboard
      ReportsScreen.tsx   — Compliance report generation
      KelvinPanel.tsx     — Voice/text safety assistant
      SettingsScreen.tsx  — Company policy rates
      UploadScreen.tsx    — CSV upload + validation
```

## License

Built for the FortyGuard Hackathon 2026. Add project license terms before distributing outside the intended team.
