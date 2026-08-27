# 🌡️ Shade — Worker Heat Safety Platform

> **Turning hyperlocal temperature data into actionable safety intelligence and financial evidence.**

[![Live Demo](https://img.shields.io/badge/LIVE_DEMO-Try_It-BrightGreen?style=for-the-badge)](https://frontend-ten-pied-ucmtf13d1v.vercel.app)
[![GitHub](https://img.shields.io/badge/Source_Code-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/P2898/FortyGuard_Databaes)
[![FortyGuard](https://img.shields.io/badge/FortyGuard-Hackathon_2026-0891B2?style=for-the-badge)](https://fortyguard.com)

**🌐 Live App → [https://frontend-ten-pied-ucmtf13d1v.vercel.app](https://frontend-ten-pied-ucmtf13d1v.vercel.app)**
No login required · Works in any modern browser · Demo data included

---

## The Problem

Heat kills US workers and costs the economy **~$100B/year** in lost productivity (Atlantic Council), projected to reach $200B by 2030. OSHA's federal heat rule is stalled, but its **Heat National Emphasis Program** is actively enforcing now (renewed April 2026, through 2031). In January 2025, **Cal/OSHA cited a Safeway warehouse in Tracy, CA $182,000 for 27 heat violations**.

Existing weather-safety tools use coarse weather-station data (~11km grid). They tell you "it's hot in Tracy" but **can't distinguish** a fog-cooled Oakland waterfront (19°C) from a Tracy warehouse (39°C) on the same day — a **36°F difference** that determines whether workers need halt-work protocols or just water stations.

## The Solution

**Shade** is a desktop-first web application that ingests a portfolio of worksites, queries **FortyGuard's 20m-resolution temperature grid** for each site, classifies risk using sourced NIOSH/OSHA thresholds, and presents everything through seven integrated screens:

| Question | Shade's Answer |
|---|---|
| *"Is site 3 safe right now?"* | Ranked risk table: LOW → CRITICAL, with sourced thresholds |
| *"Which site is riskiest?"* | Fleet dashboard with heat-colored map — one glance tells you |
| *"What did heat cost us today?"* | **Heat P&L**: every dollar traceable to real exposure data |
| *"What's the coolest route from A to B?"* | Blue-to-red gradient polyline on real streets |
| *"Generate my OSHA report"* | Formal "Shade Heat Exposure Record — Form SG-1" PDF/CSV |
| *"What should I do?"* | **Kelvin AI** answers instantly with voice or text |

---

## 🎯 Case Study: San Francisco Bay Area

The Bay Area has one of the most dramatic hyperlocal heat contrasts in the US — making it the perfect demonstration of FortyGuard's 20m resolution differentiator:

| Site | Location | Temperature | Risk | Heat Index |
|---|---|---|---|---|
| SF Waterfront Warehouse | Coastal (fog-cooled) | 19.0°C / 66°F | 🟢 LOW | 19.5°C |
| Oakland Port Construction | Coastal | 22.5°C / 73°F | 🟢 LOW | 23.1°C |
| Berkeley Transit Depot | Coastal | 21.8°C / 71°F | 🟢 LOW | 22.4°C |
| Fairfield Route Hub | Inland | 33.1°C / 92°F | 🟠 HIGH | 35.8°C |
| Concord Distribution Center | Inland | 34.9°C / 95°F | 🟠 HIGH | 37.2°C |
| San Jose Data Center | Inland | 39.1°C / 102°F | 🔴 CRITICAL | 42.1°C |
| Livermore Solar Farm | Inland | 39.4°C / 103°F | 🔴 CRITICAL | 42.8°C |
| Tracy Logistics Hub | Inland | 43.9°C / 111°F | 🔴 CRITICAL | 48.2°C |

**25°C (45°F) difference on the same day, same portfolio.** A city-average weather API would completely miss this contrast.

---

## ✨ Features

### 🏭 Fleet Risk Dashboard
Ranked table of all worksites classified as **LOW / MEDIUM / HIGH / CRITICAL** using sourced NIOSH/OSHA thresholds. Interactive Leaflet map with risk-colored markers, heat ripples on critical sites, and animated stat counters.

### 💰 Heat P&L — Financial Impact Engine
Reframes heat as a financial ledger — the feature that engages CFOs/COOs:

| Line Item | How It's Computed |
|---|---|
| **Hazard pay owed** | Company rate ($/hr) × real hours in HIGH/CRITICAL |
| **Productivity $ preserved** | SF Fed/Duke research × hours avoided × wage rate |
| **Schedule-delay claim value** | Exceedance days × contract day-rate (evidence value) |
| **Compliance readiness** | Status only — never priced as avoided fine |

Every number is expandable to show its **exact formula, inputs, and source citation**.

### 🗺️ Heat-Colored Route Planner
Compare **fastest vs. coolest** routes between any two sites. Heat-gradient polyline on real streets (OSMnx + NetworkX). Travel mode selector (drive/walk/cycle). GPS integration. Pegman street view inspector for point-level heat data.

### 🤖 Kelvin — Voice/Text Safety Assistant
Ask questions naturally — type or speak:
- *"Is SF Waterfront safe right now?"*
- *"Which site is riskiest?"*
- *"I want to go from Oakland to Tracy"* → opens Route Planner with route drawn
- *"What did heat cost us today?"*

Kelvin uses **Web Speech API** for voice input/output with male/female voice toggle and auto-speak. **100% deterministic** — regex intent matcher, never an LLM making up numbers.

### 📋 Compliance Reports (Form SG-1)
Generate formal **"Shade Heat Exposure Record"** as PDF (ReportLab) and CSV. Site-level or company-wide rollup. Includes sourced thresholds, risk distribution summary, and impact metrics.

### 🔍 Pegman Street View Inspector
Google Maps-style draggable person icon. Drop anywhere on the map to see temperature (2m height), heat index, humidity, solar irradiance, and AQI at that exact point.

### 🎨 Animated Pixel Splash Screen
Full-screen canvas animation — the "S" logo builds pixel-by-pixel in the brand's amber palette, holds, then dissolves with a scatter effect. Shows once per session.

### 🔔 Real-Time Risk Change Notifications
When a site's risk level escalates (e.g., HIGH → CRITICAL after refresh), a slide-in toast notification appears with the site name, old/new risk, and temperature.

### 🌡️ Live Temperature Ticker
Scrolling banner below the alert bar showing all site temperatures with risk-colored indicators and smooth fade edges.

### 📊 Scroll-Triggered Animations
Dashboard cards, stat counters, and tables animate into view as you scroll, creating a dynamic, alive feel.

### ⚙️ Company Policy Settings
Configure hazard pay rate, wage rate, and contract day rate. These values feed directly into the Heat P&L calculations. Voice and avatar preferences persist across sessions.

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS 4 | UI framework |
| **Maps** | Leaflet.js + OpenStreetMap | Interactive map with risk overlays |
| **Routing** | OSMnx + NetworkX | Street graph routing with heat-weighted edges |
| **Backend** | Python FastAPI, httpx, Uvicorn | API server |
| **Database** | Supabase (PostgreSQL) | Persistent storage with in-memory fallback |
| **PDF Generation** | ReportLab | OSHA-compliant compliance reports |
| **Voice** | Web Speech API (STT + TTS) | Kelvin voice input/output |
| **Data Source** | FortyGuard Temperature API | 20m hyperlocal temperature grid |
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

## 🔌 FortyGuard API Integration

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

**Endpoints used:**
1. `POST /v1/heatmap` — thermal grid over Bay Area polygon AOI
2. `POST /v1/env_params` — per-site environmental parameters
3. `POST /v1/system/fetch-api-key-usage` — plan tier verification

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

## 🛡️ Safety-Critical Design

Shade is a system advising on **worker heat exposure**. Every design decision reflects that responsibility:

1. **Kelvin is deterministic, never an LLM agent.** Regex-based intent matcher. Never calls FortyGuard. Never computes numbers. Only phrases pre-computed results from the same backend functions the dashboard uses.

2. **All thresholds are sourced.** Every risk classification cites NIOSH or OSHA. Threshold tooltips visible in the UI. No invented thresholds.

3. **Every dollar figure is traceable.** Heat P&L numbers come from: (a) real FortyGuard data, (b) user-entered company rates, or (c) cited external research. Every figure expandable to show its formula.

4. **No fabricated statistics.** README and UI clearly state what's real vs. estimated. No "deaths prevented" or unfounded health-outcome claims.

5. **Graceful failure.** API failures fall back to demo data. Missing Supabase falls back to in-memory. Sites outside US coverage get clear inline messages, never silent failure.

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
│   │   ├── main.tsx             # Entry point with splash screen
│   │   ├── lib/
│   │   │   ├── api.ts           # Typed API client (all endpoints)
│   │   │   └── theme.tsx        # Dark/light theme with brand palette
│   │   └── components/
│   │       ├── FleetDashboard.tsx    # Ranked risk table + animated stats
│   │       ├── FleetMap.tsx          # Leaflet map + heat ripple markers
│   │       ├── SiteDetail.tsx        # Site detail + 12h trend chart
│   │       ├── RoutePlanner.tsx      # Route planning + heat polyline
│   │       ├── HeatPLScreen.tsx      # Financial impact dashboard
│   │       ├── ReportsScreen.tsx     # PDF/CSV report generation
│   │       ├── KelvinPanel.tsx       # Voice/text safety assistant
│   │       ├── SettingsScreen.tsx    # Company policy + avatar setup
│   │       ├── UploadScreen.tsx      # CSV upload + validation
│   │       ├── SplashScreen.tsx      # Animated pixel splash screen
│   │       ├── AlertBanner.tsx       # Live risk alert bar
│   │       ├── TempTicker.tsx        # Scrolling temperature ticker
│   │       ├── RiskToast.tsx         # Risk change notifications
│   │       ├── AnimatedCounter.tsx   # Count-up number animation
│   │       ├── ScrollReveal.tsx      # Scroll-triggered animations
│   │       ├── TypingText.tsx        # Character-by-character typing
│   │       ├── PegmanControl.tsx     # Draggable street view inspector
│   │       └── helpers.ts            # Risk colors, CSV export utils
│   └── vercel.json
├── docs/                      # Full project documentation
├── Dockerfile                 # Render deployment (Python 3.11.9)
├── .env.example               # Environment variable template
└── README.md
```

---

## 📚 Documentation

| Document | Contents |
|---|---|
| [API_REFERENCE.md](docs/API_REFERENCE.md) | All API endpoints with request/response examples |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow diagrams, Supabase schema |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Step-by-step Vercel + Render + Supabase deployment |
| [TESTING.md](docs/TESTING.md) | Test results, risk classification verification |
| [SESSION_LOG.md](docs/SESSION_LOG.md) | Full build history |

---

## 🏆 Hackathon Submission

**Track:** Primary — Track 3 (Industrial & Enterprise) · Secondary — Track 4 (Government & Environment)

**Deliverables:**
- ✅ Live demo: [https://frontend-ten-pied-ucmtf13d1v.vercel.app](https://frontend-ten-pied-ucmtf13d1v.vercel.app) (no login)
- ✅ Public GitHub repo with README, run instructions, and API examples
- 🎬 Demo video (3 min max, with voiceover)
- 📝 500-word summary → see [SUBMISSION_SUMMARY.md](SUBMISSION_SUMMARY.md)

---

## 📄 License

Built for the FortyGuard Hackathon 2026. Add project license terms before distributing outside the intended team.
