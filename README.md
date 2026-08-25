# 🌡️ Shade — FortyGuard Hackathon'26

> **Worker safety, OSHA compliance, and heat-cost platform powered by FortyGuard's 20m hyperlocal temperature data.**

[![Live Demo](https://img.shields.io/badge/LIVE_DEMO-click_me-brightgreen)](https://frontend-ten-pied-ucmtf13d1v.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-black)](https://github.com/P2898/FortyGuard_Databaes)
[![FortyGuard](https://img.shields.io/badge/FortyGuard-Hackathon'26-blue)](https://fortyguard.com)

**Live App → [https://frontend-ten-pied-ucmtf13d1v.vercel.app](https://frontend-ten-pied-ucmtf13d1v.vercel.app)** · No login required · Works in any modern browser

---

## What is Shade?

Shade doesn't just say "it's hot." It tells a company **exactly what heat cost them today, in dollars**, with the paperwork to back it up.

Built for companies running multiple outdoor/industrial worksites — warehouses, construction yards, logistics hubs, and delivery routes — Shade transforms FortyGuard's hyperlocal 2m/20m temperature data into actionable safety intelligence and financial evidence.

| Problem | Shade's Answer |
|---|---|
| "Is site 3 safe right now?" | Ranked risk table: LOW → CRITICAL, with sourced thresholds |
| "Which site is riskiest?" | Fleet dashboard with heat-colored map — one glance tells you |
| "What did heat cost us today?" | Heat P&L: $15,500 daily portfolio cost, every dollar traceable |
| "What's the coolest route from A to B?" | Blue-to-red gradient polyline on real streets |
| "Generate my OSHA report" | Formal "Shade Heat Exposure Record — Form SG-1" PDF/CSV |

---

## 🎯 Case Study: San Francisco Bay Area

Deliberate choice — the Bay Area has one of the most dramatic hyperlocal heat contrasts in the US:

| Site | Location | Temperature | Risk |
|---|---|---|---|
| SF Waterfront Warehouse | Coastal (fog-cooled) | 19.0°C | 🟢 LOW |
| Oakland Port Construction | Coastal | 22.5°C | 🟢 LOW |
| Berkeley Transit Depot | Coastal | 21.8°C | 🟢 LOW |
| Fairfield Route Hub | Inland | 33.1°C | 🟠 HIGH |
| Concord Distribution Center | Inland | 34.9°C | 🟠 HIGH |
| San Jose Data Center | Inland | 39.1°C | 🔴 CRITICAL |
| Livermore Solar Farm | Inland | 39.4°C | 🔴 CRITICAL |
| Tracy Logistics Hub | Inland | 43.9°C | 🔴 CRITICAL |

**25°C (45°F) difference on the same day, same portfolio.** A city-average weather API would completely miss this contrast — that's FortyGuard's 20m resolution differentiator.

Bonus: the real $182K Cal/OSHA Safeway fine happened in **Tracy, CA** — part of this exact corridor.

---

## ✨ Features

### 🏭 Fleet Risk Dashboard
Ranked table of all worksites classified as LOW / MEDIUM / HIGH / CRITICAL using sourced NIOSH/OSHA thresholds. Interactive map with risk-colored markers and heat circles.

### 🗺️ Heat-Colored Route Planner
Compare **fastest vs. coolest** routes between any two sites. Blue-to-red gradient polyline on real streets (OSMnx + NetworkX). Travel mode selector (walk/drive). Pegman street view inspector for point-level heat data.

### 💰 Heat P&L (Standout Feature)
Reframes heat as a financial ledger — the feature that engages CFOs/COOs:

| Line Item | How It's Computed |
|---|---|
| **Hazard pay owed** | Company rate ($/hr) × real hours in HIGH/CRITICAL |
| **Productivity $ preserved** | SF Fed/Duke research × hours avoided × wage rate |
| **Delay claim value** | Exceedance days × contract day-rate (evidence value) |
| **Compliance readiness** | Status only — never priced as avoided fine |

Every number is expandable to show its exact formula and inputs.

### 🤖 Kelvin — Voice/Text Safety Assistant
Ask questions naturally:
- *"Is SF Waterfront safe right now?"*
- *"Which site is riskiest?"*
- *"I want to go from Oakland to Tracy"* → opens Route Planner with route drawn
- *"What did heat cost us today?"*

Kelvin uses **Web Speech API** for voice input/output with a male/female voice toggle. **100% deterministic** — regex intent matcher, never an LLM making up numbers.

### 📋 Compliance Reports
Generate formal **"Shade Heat Exposure Record — Form SG-1"** as PDF (ReportLab) and CSV. Site-level or company-wide rollup. Includes sourced thresholds, risk distribution, and impact metrics.

### 📊 Audit Log
Every risk assessment logged as structured data. Single source of truth for Kelvin and compliance reports.

### 📤 CSV Upload
Ingest worksite portfolios via CSV. Validates US coordinates, no duplicates, clear inline errors.

### 🔍 Pegman Street View Inspector
Google Maps-style draggable person icon. Drop anywhere on the map to see temperature (2m height), heat index, humidity, solar irradiance, and AQI at that exact point.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS 4, Leaflet.js + OpenStreetMap |
| **Backend** | Python FastAPI, httpx, Uvicorn |
| **Database** | Supabase (Postgres) with in-memory fallback |
| **Routing** | OSMnx (street graph) + NetworkX (Dijkstra/A*) |
| **PDF Generation** | ReportLab |
| **Voice** | Browser Web Speech API (STT + TTS) |
| **Data Source** | FortyGuard Temperature API (2m/20m resolution) |
| **Frontend Deploy** | Vercel (free tier) |
| **Backend Deploy** | Render (Docker, Python 3.11) |
| **Logo** | Shade — sun blocked by protection |

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

## 🔌 FortyGuard API — Real Request/Response Example

**Request — Environmental parameters for Tracy Logistics Hub:**

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

---

## 📊 What's Real vs. Estimated

| Data Point | Source | Label |
|---|---|---|
| Site temperatures | FortyGuard 20m grid (live) or deterministic estimation (demo) | Real |
| Risk thresholds | NIOSH WBGT REL (28°C), OSHA triggers (80°F/90°F), CA Indoor (82°F) | Sourced |
| Hazard pay owed | Company-entered rate × real hours in HIGH/CRITICAL | Real |
| Productivity $ preserved | SF Fed/Duke relationship × hours avoided × wage rate | **Estimate** |
| Delay claim value | Exceedance days × company day-rate | **Evidence value** |
| Compliance readiness | Status only | Real |
| Heat index | Simplified Rothfusz regression from temp + humidity | Computed |
| Route temperatures | FortyGuard grid interpolated onto route segments | Real |

**Never fabricated:** market-size figures, health-outcome claims, death-prevention claims, or regulatory compliance guarantees.

---

## 📁 Project Structure

```
FortyGuard_Databaes/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Environment variables (no secrets in code)
│   │   ├── database.py          # Supabase REST client (httpx)
│   │   ├── routers/
│   │   │   ├── sites.py         # Site CRUD + CSV upload + seed data
│   │   │   ├── assessment.py    # Fleet risk assessment engine
│   │   │   ├── heat_pl.py       # Heat P&L + company policy
│   │   │   ├── kelvin.py        # Kelvin API endpoint
│   │   │   ├── route.py         # Route planner (OSMnx + heat-weighted)
│   │   │   ├── reports.py       # PDF/CSV compliance reports
│   │   │   └── streetview.py    # Pegman heat data endpoint
│   │   └── services/
│   │       ├── fortyguard.py    # FortyGuard API client + caching
│   │       ├── risk_scoring.py  # NIOSH/OSHA risk classifier
│   │       ├── heat_pl.py       # Financial impact engine
│   │       └── kelvin.py        # Intent matcher + response phraser
│   ├── migrations/              # Supabase schema migrations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Main app with sidebar navigation
│   │   ├── lib/api.ts           # API client (all endpoints typed)
│   │   └── components/
│   │       ├── FleetDashboard.tsx   # Ranked risk table + chart
│   │       ├── FleetMap.tsx         # Leaflet map + risk markers
│   │       ├── SiteDetail.tsx       # Site detail + 12h trend
│   │       ├── RoutePlanner.tsx     # Route planning + heat polyline
│   │       ├── HeatPLScreen.tsx     # Financial impact dashboard
│   │       ├── ReportsScreen.tsx    # PDF/CSV report generation
│   │       ├── KelvinPanel.tsx      # Voice/text safety assistant
│   │       ├── SettingsScreen.tsx   # Company policy + avatar setup
│   │       ├── UploadScreen.tsx     # CSV upload + validation
│   │       ├── PegmanControl.tsx    # Draggable street view inspector
│   │       └── helpers.ts           # Risk colors, CSV export utils
│   └── vercel.json
├── docs/                      # Full project documentation
├── Dockerfile                 # Render deployment (Python 3.11.9)
├── .env.example               # Environment variable template
└── README.md
```

---

## 🛡️ Safety-Critical Design

Shade is a system advising on **worker heat exposure**. Every design decision reflects that responsibility:

1. **Kelvin is deterministic, never an LLM agent.** Regex-based intent matcher. Never calls FortyGuard. Never computes numbers. Only phrases pre-computed results from the same backend functions the dashboard uses.

2. **All thresholds are sourced.** Every risk classification cites NIOSH or OSHA. Threshold tooltips visible in the UI. No invented thresholds.

3. **Every dollar figure is traceable.** Heat P&L numbers come from: (a) real FortyGuard data, (b) user-entered company rates, or (c) cited external research. Every figure expandable to show its formula.

4. **No fabricated statistics.** README and UI clearly state what's real vs. estimated. No "deaths prevented" or unfounded health-outcome claims.

5. **Graceful failure.** API failures fall back to demo data. Missing Supabase falls back to in-memory. Sites outside US coverage get clear inline messages, never silent failure.

---

## 📚 Documentation

| Document | Contents |
|---|---|
| [API_REFERENCE.md](docs/API_REFERENCE.md) | All 16 API endpoints with request/response examples |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow diagrams, Supabase schema |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Step-by-step Vercel + Render + Supabase deployment |
| [TESTING.md](docs/TESTING.md) | Test results, risk classification verification, deployment status |
| [SESSION_LOG.md](docs/SESSION_LOG.md) | Full build history across 3 sessions |

---

## 🏆 Hackathon Submission

**Track:** Primary — Track 3 (Industrial & Enterprise) · Secondary — Track 4 (Government & Environment)

**Deliverables:**
- ✅ Live demo: [https://frontend-ten-pied-ucmtf13d1v.vercel.app](https://frontend-ten-pied-ucmtf13d1v.vercel.app) (no login)
- ✅ Public GitHub repo with README, run instructions, and API example
- 🎬 Demo video (3 min max, with voiceover) — *to be recorded*
- 📝 500-word summary → see [SUBMISSION_SUMMARY.md](SUBMISSION_SUMMARY.md)

---

## 📄 License

Built for the FortyGuard Hackathon 2026. Add project license terms before distributing outside the intended team.
