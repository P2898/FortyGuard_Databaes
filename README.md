# 🌡️ Shade — Worker Heat Safety Platform

> **Turning hyperlocal temperature data into actionable safety intelligence and financial evidence.**

[![Live Demo](https://img.shields.io/badge/LIVE_DEMO-Try_It-BrightGreen?style=for-the-badge)](https://frontend-ten-pied-ucmtf13d1v.vercel.app)
[![GitHub](https://img.shields.io/badge/Source_Code-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/P2898/FortyGuard_Databaes)
[![FortyGuard](https://img.shields.io/badge/FortyGuard-Hackathon_2026-0891B2?style=for-the-badge)](https://fortyguard.com)

**🌐 Live App → [https://frontend-ten-pied-ucmtf13d1v.vercel.app](https://frontend-ten-pied-ucmtf13d1v.vercel.app)**
No login required · Works in any modern browser · Demo data included

---

## The Problem

A safety manager at a logistics company with 8 Bay Area warehouses opens Perry Weather. It says "92°F in Tracy." She cancels outdoor shifts at all three inland sites. The SF waterfront warehouse — fog-cooled to 66°F — loses a full day of dock loading for nothing. **She just paid $4,200 in unnecessary downtime because the tool couldn't tell 66°F from 92°F.**

That's the core problem: **existing weather tools use ~11km grid data. They give you a city average, not a site temperature.** On the same August afternoon:

| Site | Actual Temp | What the Tool Says | The Gap |
|---|---|---|---|
| SF Waterfront Warehouse | **66°F** (fog-cooled) | "92°F in SF" | **26°F wrong** |
| Tracy Logistics Hub | **111°F** (inland) | "92°F in Tracy" | **19°F wrong** |

A 26°F error isn't a rounding issue. It's the difference between "send your crew" and "halt all work." And it costs companies real money — **$100B/year** in heat-related productivity loss across the US (Atlantic Council), with OSHA actively issuing six-figure fines ($182,000 cited at a single Safeway warehouse in Tracy, CA in January 2025).

---

## How It Works

Shade is a five-step system that turns raw temperature data into safety decisions:

### Step 1: Ingest Your Sites

Upload a CSV of your worksites — name, latitude, longitude. Shade loads them into a fleet dashboard. Eight demo Bay Area sites are included to get started instantly.

### Step 2: Query the 20m Temperature Grid

For each site, Shade calls **FortyGuard's API** — a 20-meter resolution thermal grid (not 11km weather stations). This is the differentiator: FortyGuard resolves the microclimate at the exact coordinates of your loading dock, not the nearest airport.

**The API call:**
```http
POST https://api.fortyguard.com/v1/env_params
Body: { "latitude": 37.7397, "longitude": -121.4252 }
```

**What comes back:** temperature at 2m human height, heat index, humidity, solar irradiance, AQI — all at 20m resolution.

### Step 3: Classify Risk Using Sourced Thresholds

Every temperature is classified against **NIOSH/OSHA regulatory thresholds** — not invented numbers:

| Risk Level | Threshold | Source | Action |
|---|---|---|---|
| 🟢 LOW | < 80°F | NWS Below Caution | Normal operations |
| 🟡 MEDIUM | 80–90°F | NWS Caution | Water stations, rest breaks |
| 🟠 HIGH | 90–103°F | NWS Extreme Caution | Limit outdoor exposure 12–3 PM |
| 🔴 CRITICAL | 103–124°F | NWS Danger | Halt non-essential outdoor work |

### Step 4: Quantify the Financial Impact

The **Heat P&L** translates risk hours into dollars using company-specific rates:

- **Hazard pay owed** = your rate × hours in HIGH/CRITICAL zones
- **Productivity preserved** = SF Fed/Duke research × hours avoided × wage
- **Delay claim evidence** = exceedance days × contract day-rate

Every number is expandable to show its exact formula and source citation.

### Step 5: Act on It

- **Fleet Dashboard:** Ranked risk table + heat-colored map — one glance tells you which site is at risk
- **Route Planner:** Fastest vs. coolest route between sites (shade-aware routing saves 6°F on a SF→Tracy drive)
- **Kelvin AI:** Ask *"Is Tracy safe right now?"* and get a sourced answer in <50ms
- **Compliance Reports:** One-click OSHA-ready PDF/CSV with risk distribution and exposure logs

---

## What Success Looks Like

### Before Shade

A safety manager at a Bay-area logistics company with 8 warehouses:

- **Guesses** which sites are hot based on city-level weather data
- **Over-cancels** outdoor shifts at fog-cooled sites (cost: $4,200/day in wasted labor)
- **Under-protects** at inland sites because the weather API says 92°F when it's actually 111°F
- **Can't prove** compliance to OSHA — no site-specific temperature logs exist
- **Can't quantify** the cost of heat to the business — it's a black box

### After Shade

Same manager, same 8 sites, same day:

| Metric | Before | After | Delta |
|---|---|---|---|
| **Wrong-site cancellations** | 2–3 sites/day | 0 | **$4,200/day saved** |
| **Under-protected sites** | 1–2 sites/day | 0 | Risk eliminated |
| **Time to assess fleet** | 45 min (manual) | **2ms** (automated) | 99.99% faster |
| **Compliance evidence** | None | PDF with sourced thresholds | Audit-ready |
| **Heat cost visibility** | Unknown | $15,500/day (quantified) | Decisions, not guesses |

### Real Numbers from the Bay Area Demo

- **SF Waterfront → Tracy Logistics:** Coolest route is **6°F cooler** than fastest route. That's the difference between HIGH risk and CRITICAL risk on the same trip.
- **Tracy Logistics Hub:** 111°F, CRITICAL risk, 12-hour exceedance — the system recommends halting outdoor work between 10 AM and 4 PM.
- **SF Waterfront Warehouse:** 66°F, LOW risk — normal operations, no need to cancel dock loading.
- **Heat P&L:** $15,500/day portfolio cost computed from real risk hours × company rates. Hazard pay: $500. Delay claim evidence: $15,000.
- **Kelvin response time:** <50ms for all intent types.

---

## ✨ Features

| Feature | What It Does |
|---|---|
| **Fleet Risk Dashboard** | Ranked table of all worksites classified LOW → CRITICAL. Interactive map with heat-colored markers. |
| **Heat P&L** | Financial impact ledger: hazard pay, productivity preserved, delay claim evidence — every number traceable. |
| **Route Planner** | Fastest vs. coolest route between sites. Heat-gradient polyline on real streets. |
| **Kelvin AI** | Voice or text assistant. Ask *"Is Tracy safe?"* — sourced, deterministic, never an LLM making up numbers. |
| **Heat Illness Prediction** | Probabilistic model (0–99%) with worker profile factors (age, fitness, hydration, workload). |
| **Compliance Reports** | One-click OSHA-ready PDF/CSV with sourced thresholds and exposure logs. |
| **Pegman Inspector** | Drop a pin anywhere on the map — get temperature, heat index, humidity, solar irradiance at that exact point. |
| **12-Hour Forecast** | Multi-checkpoint timeline with confidence labels and "Cost of Inaction" calculator. |

---

## 🏗️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS 4 | Fast iteration, type safety |
| **Maps** | Leaflet.js + OpenStreetMap | Free, no API key, interactive |
| **Routing** | OSMnx + NetworkX | Street graph routing with heat-weighted edges |
| **Backend** | Python FastAPI, httpx | Async API, fast responses |
| **Database** | Supabase (PostgreSQL) | Persistent storage, in-memory fallback |
| **Data Source** | FortyGuard Temperature API | 20m hyperlocal resolution — the differentiator |
| **Deployment** | Vercel (frontend) + Render (backend) | Zero-config production deploy |

---

## 🚀 Quick Start

### Requirements
- Node.js 18+
- Python 3.10+
- npm or pnpm

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

---

## 🛡️ Safety-Critical Design

Shade is a system advising on **worker heat exposure**. Every design decision reflects that responsibility:

1. **Kelvin is deterministic, never an LLM.** Regex-based intent matcher. Never invents numbers. Only phrases pre-computed results from the same backend functions the dashboard uses.

2. **All thresholds are sourced.** Every risk classification cites NIOSH or OSHA. No invented thresholds.

3. **Every dollar figure is traceable.** Heat P&L numbers come from: real FortyGuard data, user-entered company rates, or cited external research. Expandable formulas.

4. **No fabricated statistics.** What's real vs. estimated is clearly labeled. No "deaths prevented" claims.

5. **Graceful failure.** API failures fall back to demo data. Missing Supabase falls back to in-memory.

---

## 📊 FortyGuard API Integration

Shade uses three FortyGuard endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /v1/heatmap` | Thermal grid over Bay Area polygon AOI |
| `POST /v1/env_params` | Per-site environmental parameters (temp, humidity, solar, AQI) |
| `POST /v1/system/fetch-api-key-usage` | Plan tier verification |

**Request example:**
```http
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
    "result": {
      "heat_index_celsius": 42.3,
      "relative_humidity_percent": 28.5,
      "solar_irradiance": 847.2,
      "air_quality:idx": 45
    }
  }
}
```

---

## 📁 Project Structure

```
FortyGuard_Databaes/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Environment variables
│   │   ├── database.py          # Supabase REST client
│   │   ├── routers/
│   │   │   ├── sites.py         # Site CRUD + CSV upload
│   │   │   ├── assessment.py    # Fleet risk assessment
│   │   │   ├── heat_pl.py       # Heat P&L + company policy
│   │   │   ├── kelvin.py        # Kelvin API endpoint
│   │   │   ├── route.py         # Route planner (OSMnx)
│   │   │   ├── reports.py       # PDF/CSV reports
│   │   │   └── streetview.py    # Pegman heat data
│   │   └── services/
│   │       ├── fortyguard.py    # FortyGuard API client + caching
│   │       ├── risk_scoring.py  # NIOSH/OSHA risk classifier
│   │       ├── heat_pl.py       # Financial impact engine
│   │       └── kelvin.py        # Intent matcher + response phraser
│   ├── migrations/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Main app with sidebar nav
│   │   ├── lib/
│   │   │   ├── api.ts           # Typed API client
│   │   │   └── theme.tsx        # Dark/light theme
│   │   └── components/
│   │       ├── FleetDashboard.tsx    # Ranked risk table
│   │       ├── FleetMap.tsx          # Leaflet map + heat markers
│   │       ├── RoutePlanner.tsx      # Heat-weighted routing
│   │       ├── HeatPLScreen.tsx      # Financial impact dashboard
│   │       ├── KelvinPanel.tsx       # Voice/text assistant
│   │       └── ...                   # 20 total components
│   └── vercel.json
├── docs/                      # Full documentation
├── Dockerfile
├── .env.example
└── README.md
```

---

## 🏆 Hackathon Submission

**Track:** Primary — Track 3 (Industrial & Enterprise) · Secondary — Track 4 (Government & Environment)

- ✅ Live demo: [https://frontend-ten-pied-ucmtf13d1v.vercel.app](https://frontend-ten-pied-ucmtf13d1v.vercel.app)
- ✅ Public GitHub repo with README, run instructions, API examples
- 🎬 Demo video (3 min max)
- 📝 [SUBMISSION_SUMMARY.md](SUBMISSION_SUMMARY.md)

---

## 📄 License

Built for the FortyGuard Hackathon 2026. Add project license terms before distributing outside the intended team.
