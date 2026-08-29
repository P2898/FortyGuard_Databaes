# SHADE — Enterprise Heat Safety Intelligence Platform

## Track: Industry & Enterprise (and Government & Environment)

---

## 🎯 Project Overview

**Shade** is a real-time heat safety intelligence platform powered by FortyGuard's hyperlocal temperature data. It protects outdoor workers from heat illness by providing predictive forecasts, automated risk assessment, financial impact analysis, and AI-powered safety guidance — all grounded in OSHA/NIOSH regulatory standards.

**The Problem:** Heat illness kills 38+ US workers每年 (likely underreported). Employers face $161K+ OSHA fines. Construction, logistics, and utility companies lose $100B annually to heat-related productivity loss.

**The Solution:** Shade combines FortyGuard's 20m-resolution temperature data with OSHA compliance rules, predictive analytics, and financial modeling to give enterprises a single platform for heat safety management.

---

## 🏗️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite 8** | Build tool (392ms builds) |
| **Tailwind CSS** | Utility-first styling |
| **Leaflet + OpenStreetMap** | Interactive maps with heat overlays |
| **Web Speech API** | Voice input (SpeechRecognition) + Text-to-Speech output |
| **localStorage** | Avatar settings persistence |
| **Custom CSS variables** | Light/dark theme system |

### Backend
| Technology | Purpose |
|---|---|
| **Python 3.11** | Runtime |
| **FastAPI** | REST API framework (async) |
| **Uvicorn** | ASGI server |
| **Pydantic** | Request/response validation |
| **Supabase** | PostgreSQL database (sites, assessments, route queries) |

### External APIs
| API | Purpose |
|---|---|
| **FortyGuard** | 20m-resolution temperature, heat index, humidity, solar irradiance, AQI data |
| **OSMnx / Overpass API** | Street network graphs for route planning |
| **NWS Heat Index Chart** | Source of truth for risk thresholds |

### Deployment
| Platform | Role |
|---|---|
| **Vercel** | Frontend hosting (https://frontend-ten-pied-ucmtf13d1v.vercel.app) |
| **Render** | Backend API hosting (https://shade-api-gbyb.onrender.com) |
| **GitHub** | Source control + auto-deploy trigger |

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │Dashboard │ │  Kelvin  │ │ Forecast │ │  Routes  │   │
│  │  Map     │ │  (AI)    │ │ (Predict)│ │ (OSMnx)  │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       │             │             │             │         │
│       └─────────────┴──────┬──────┴─────────────┘         │
│                            │ fetch()                      │
└────────────────────────────┼──────────────────────────────┘
                             │
                     ┌───────▼────────┐
                     │  FastAPI (REST) │
                     └───────┬────────┘
                             │
         ┌───────────┬───────┼───────┬──────────┐
         │           │       │       │          │
    ┌────▼───┐  ┌────▼──┐ ┌──▼───┐ ┌─▼────┐ ┌──▼──────┐
    │FortyGrd│  │  RAG  │ │Heat  │ │Route │ │ Forecast│
    │  API   │  │Engine │ │Pred. │ │Engine│ │ Service │
    └────────┘  └───────┘ └──────┘ └──────┘ └─────────┘
         │           │       │       │          │
         └───────────┴───────┴───────┴──────────┘
                             │
                     ┌───────▼────────┐
                     │   Supabase DB   │
                     │  (PostgreSQL)   │
                     └────────────────┘
```

---

## 📊 Core Features (11 Total)

### 1. 🗺️ Interactive Fleet Dashboard
**Component:** `FleetDashboard.tsx` + `FleetMap.tsx`

- Real-time risk assessment for all 8 Bay Area sites
- Color-coded risk levels (LOW/MEDIUM/HIGH/CRITICAL) with NWS thresholds
- Heat-colored map markers showing site temperatures
- Sortable table with risk, temperature, heat index, exceedance hours
- CSV export for compliance reporting
- Risk distribution pie chart
- Auto-refresh (configurable 15s/30s/60s intervals)

### 2. 🌡️ Heat Index Risk Scoring Engine
**Service:** `risk_scoring.py`

Uses exact NWS Heat Index Chart thresholds:

| Bucket | Range (°F) | Range (°C) | NWS Band | Source |
|---|---|---|---|---|
| LOW | < 80°F | < 26.7°C | Below Caution | NWS |
| MEDIUM | 80–90°F | 26.7–32.2°C | Caution | NWS |
| HIGH | 90–103°F | 32.2–39.4°C | Extreme Caution | NWS |
| CRITICAL | 103–124°F | 39.4–51.1°C | Danger | NWS |
| EXTREME | > 125°F | > 51.1°C | Extreme Danger | NWS |

### 3. 🛡️ Heat Illness Prediction Model
**Service:** `heat_illness.py`

A probabilistic model predicting heat illness probability (0–99%) based on:

**Environmental Factors:**
- Temperature, Heat Index, Humidity, Solar Radiation
- WBGT (Wet Bulb Globe Temperature) estimation via simplified Liljegren model

**Worker Profile Factors (9 multipliers):**
| Factor | Risk Range | Source |
|---|---|---|
| Age | 0.9x (youth) → 1.5x (65+) | OSHA high-risk category |
| Acclimatization | 0.7x (acclimated) → 1.4x (new worker) | OSHA: most deaths in first 3 days |
| Fitness | 0.8x (athletic) → 1.3x (sedentary) | NIOSH REL adjustments |
| Hydration | 0.85x (well-hydrated) → 1.5x (dehydrated) | ACGIH TLV |
| Clothing | 0.85x (light) → 1.4x (protective) | WBGT corrections |
| Medical conditions | up to 2.5x (cardiovascular + diabetes) | OSHA risk factors |
| Workload | 0.8x (light) → 1.6x (very heavy) | NIOSH metabolic categories |
| Duration | 0.9x (2h) → 1.3x (8h+) | Cumulative exposure |
| Time of day | 0.7x (night) → 1.2x (12–4 PM peak) | Diurnal heat pattern |

**Output:** Probability, risk level, work-rest recommendations, human-friendly advice with specific actions.

### 4. 🔮 Predictive Heat Forecast (12-Hour)
**Service:** `forecast.py` + **Component:** `ForecastDashboard.tsx`

- Multi-checkpoint timeline: 0h, 3h, 6h, 9h, 12h forecasts per site
- Diurnal temperature model (sinusoidal, coastal-aware for Bay Area)
- Confidence labels by lead time (High ≥85%, Moderate ≥70%, Lower <70%)
- **Cost of Inaction** calculator: projects financial loss if no action taken
- **Reschedule & Save** recommendations: shows exact dollar savings from shifting work hours
- **Dollars Flagged** quarterly counter: "Shade has flagged $X in avoidable heat cost"
- NWS-sourced risk bands at each checkpoint
- Clickable hub cards with expand/collapse animation

### 5. 💰 Heat P&L (Profit & Loss) Financial Impact
**Service:** `heat_pl.py` + **Component:** `HeatPLScreen.tsx`

4-line financial model with source citations:

| Line Item | Formula | Source |
|---|---|---|
| Hazard Pay Owed | Rate × (HIGH hrs + CRITICAL hrs) | Company-entered rate |
| Productivity $ Preserved | Hours avoided × SF Fed/Duke factor × wage | SF Federal Reserve / Duke study |
| Schedule Delay Claim Value | Exceedance days × $5,000/day | Industry average |
| Compliance Readiness | Status tracking (no dollar value) | OSHA fine ranges $16K–$161K |

Total cost: ~$20,000/day across 8 sites during heat events.

### 6. 🗺️ Heat-Safe Route Planner
**Router:** `route.py` + **Component:** `RoutePlanner.tsx`

- Compares **fastest route** vs **coolest route** (heat-weighted)
- Uses OSMnx street graphs with `drive_service` network (excludes ferries)
- Coolest route algorithm: follows fastest route but deviates at hot waypoints using Gaussian-smoothed perpendicular offsets
- Temperature comparison along each route using FortyGuard heatmap tiles
- Shows time delta and temperature delta
- Route playback animation with avatar
- GPS mode for mobile

### 7. 🤖 Kelvin AI Assistant (RAG Chatbot)
**Service:** `rag.py` + **Router:** `ai_chat.py` + **Component:** `KelvinPanel.tsx`

**Knowledge Base:** 10 domain-specific documents covering:
- OSHA Heat Illness Prevention Campaign
- OSHA Temperature Thresholds
- Cal/OSHA Heat Regulations (California)
- NIOSH Heat Stress Guidelines
- Heat-Related Financial Impact
- OSHA Penalty Structure
- Heat-Safe Route Planning
- Heat-Related Health Effects
- Heat Illness Prevention Plan Requirements
- FortyGuard Temperature Data Platform

**Intent Classification** (8 intents):
| Intent | Keywords | Response |
|---|---|---|
| `route_plan` | "plan a route from X to Y" | Detects origin/destination → navigates to Routes page |
| `heat_illness_prevention` | "is it safe to work outdoors" | Runs prediction model → human-friendly yes/no + actions |
| `risk_assessment` | "is X safe", "risk", "danger" | Site-specific or fleet-wide risk with recommendations |
| `financial` | "cost", "money", "fine" | Heat P&L breakdown + financial insights |
| `route_advice` | "route", "drive", "navigate" | Route planning advice from knowledge base |
| `compliance` | "OSHA", "regulation", "plan" | Compliance requirements + report generation |
| `health` | "symptom", "illness", "stroke" | Health effects + emergency guidance |
| `threshold` | "temperature", "how hot" | NIOSH/OSHA threshold information |

**TF-IDF Vectorizer:** Custom implementation for document retrieval without external ML libraries.

**Human-Friendly Responses:**
- LOW: "✅ Safe to work outdoors" + hydration tips
- MODERATE: "⚠️ Work with caution" + rest break schedule
- HIGH: "🟠 Limit outdoor exposure" + stop heavy work 12–3 PM
- VERY_HIGH: "🔴 Dangerous — minimize work" + safety monitor
- EXTREME: "🚨 STOP ALL WORK" + emergency actions

**Voice Input:** Browser SpeechRecognition API (Chrome/Edge) with MediaRecorder fallback.

**Voice Output:** Text-to-Speech with all emojis stripped before speaking.

### 8. 🎯 Multi-Agent Coordination System
**Service:** `agents.py` + **Router:** `ai_chat.py`

5 specialized agents collaborating on complex queries:

| Agent | Role | Input | Output |
|---|---|---|---|
| **RiskAgent** | Analyzes site risks | Assessments | Risk distribution, critical count, recommendations |
| **RouteAgent** | Plans optimal routes | Origin/dest + weather | Fastest vs coolest routes |
| **ComplianceAgent** | OSHA compliance check | Sites + policy | Active requirements, gap analysis |
| **FinancialAgent** | Cost analysis | Heat P&L + policy | Cost breakdown, savings opportunities |
| **Orchestrator** | Coordinates agents | All inputs | Aggregated recommendations |

### 9. 🏠 Street View Inspector (PegmanControl)
**Component:** `PegmanControl.tsx` + **Router:** `streetview.py`

- Drag-and-drop pegman onto map for hyperlocal heat data
- Shows: Temperature, Heat Index, Humidity, Solar Irradiance, AQI
- Uses exact user's avatar from saved settings
- Location pin color matches saved outfit (construction=yellow, delivery=blue)
- NIOSH source attribution on heat index
- 20m resolution, 2m human-height data from FortyGuard

### 10. 📋 OSHA Compliance Reports
**Router:** `reports.py` + **Component:** `ReportsScreen.tsx`

- Automated compliance report generation
- Risk assessment documentation
- Heat exposure logs
- OSHA citation-ready formatting

### 11. 👷 Customizable Worker Avatar
**Component:** `RouteAvatar.tsx` + `SettingsScreen.tsx`

- 3 gender presentations (Default, Female, Male)
- 3 outfit options (Default, Construction, Delivery)
- Avatar reflected in:
  - PegmanControl drag-and-drop character
  - Map location pin color
  - Route planner map marker
  - Street View Inspector popup
  - Route playback animation
- Persisted via localStorage

---

## 📡 API Endpoints (13 Routers, 40+ Endpoints)

| Router | Prefix | Key Endpoints |
|---|---|---|
| `sites` | `/api/sites` | CRUD operations, seed demo sites |
| `assessment` | `/api/assessment` | Fleet risk assessment, site detail |
| `heat_pl` | `/api/heat-pl` | Financial impact, company policy |
| `forecast` | `/api/forecast` | Portfolio forecast, site forecast, NWS bands, dollars flagged, accuracy |
| `heat_prediction` | `/api/heat-prediction` | Heat illness probability prediction |
| `route` | `/api/routes` | Route planning, helpful feedback, site listing |
| `ai_chat` | `/api/ai` | Chat with RAG, multi-agent portfolio analysis |
| `kelvin` | `/api/kelvin` | Quick query endpoint |
| `streetview` | `/api/streetview` | Heat data for map coordinates |
| `reports` | `/api/reports` | OSHA compliance reports |
| `monitoring` | `/api/monitoring` | System health metrics, uptime |
| `transcribe` | `/api/transcribe` | Voice transcription (fallback) |
| `health` | `/api/health` | Health check |

---

## 🎨 Design System

### Theme
- **Light mode:** Warm cream background (#faf7f2), brown accents (#c07a28)
- **Dark mode:** Deep navy (#1c2035), orange accents (#c07a28)
- Toggle via sun/moon icon in header

### Color Coding (Risk Levels)
| Level | Color | Hex |
|---|---|---|
| LOW | Green | #22c55e |
| MEDIUM | Yellow | #eab308 |
| HIGH | Orange | #f97316 |
| CRITICAL | Red | #ef4444 |
| EXTREME | Dark Red | #7f1d1d |

### Typography
- Font: System UI (-apple-system, system-ui, sans-serif)
- Tabular numbers for financial data
- Markdown rendering for chatbot responses (bold, headers, lists)

---

## 📱 Mobile Responsive Design

- **Sidebar collapses** to bottom navigation bar at ≤768px
- **7 navigation items:** Dashboard, Map, Routes, Heat P&L, Forecast, Kelvin, Settings
- **Horizontal scroll** for bottom nav on small screens
- **Touch-friendly** targets (40px+ height)
- **Stats grid** adapts: 4 columns → 2 columns → 1 column

---

## 🔒 Security & Compliance

### Data Handling
- `.env` file with API keys is gitignored (never committed)
- Supabase anon key (read-only) exposed; service key kept server-side
- FortyGuard API key stored in environment variables
- All API calls use HTTPS

### OSHA Compliance
- Every risk threshold cited to official source (NWS, OSHA, NIOSH, Cal/OSHA)
- Heat P&L formulas documented with academic citations
- Compliance readiness tracked (not estimated)
- Audit trail for all assessments

---

## 📈 Key Metrics

| Metric | Value |
|---|---|
| Sites monitored | 8 (Bay Area) |
| Risk levels tracked | 5 (LOW → EXTREME) |
| NWS thresholds used | 4 official bands |
| RAG knowledge documents | 10 |
| Chatbot intents | 8 |
| API endpoints | 40+ |
| Frontend components | 20 |
| Backend services | 10 |
| Git commits | 15+ |
| Frontend bundle size | 460KB |
| Build time | ~400ms |
| Backend cold start | ~8s (warm), ~30s (cold) |

---

## 🗓️ Development Timeline

| Phase | Features | Status |
|---|---|---|
| **Phase 1** | Fleet Dashboard, Map, Heat P&L | ✅ Complete |
| **Phase 2** | Route Planner, Kelvin AI Chatbot | ✅ Complete |
| **Phase 3** | Predictive Forecast, Agent System | ✅ Complete |
| **Phase 4** | Heat Illness Prediction Model | ✅ Complete |
| **Phase 5** | Route Navigation from Chat, Human-Friendly Responses | ✅ Complete |
| **Phase 6** | Avatar Sync, Speech Recognition, Mobile Nav | ✅ Complete |

---

## 💡 Innovation Highlights

1. **WBGT Estimation without Equipment:** Estimates Wet Bulb Globe Temperature from standard weather data using simplified Liljegren model — no expensive WBGT monitors needed.

2. **Predictive Cost of Inaction:** Projects exact dollar loss if no action is taken on forecasted heat events — turns a safety warning into a financial decision.

3. **Reschedule & Save:** Shows "Move shift to 7AM instead of 2PM: save $2,100" — the single most sellable line for enterprise B2B.

4. **Self-Measured Forecast Accuracy:** Tracks prediction accuracy over time ("94% over last 30 days") — produces a real, self-measured reliability number.

5. **NWS-Sourced Everything:** Every threshold, every number, every recommendation cites its official source — "nothing invented" credibility.

6. **Multi-Agent Orchestration:** 5 specialized AI agents collaborate on complex queries — risk, routing, compliance, financial analysis working together.

7. **Human-Friendly AI:** Chatbot gives practical advice ("Yes, it's safe to work outdoors today") alongside technical data — bridges the gap between numbers and human decisions.

---

## 🚀 Deployment

### Frontend (Vercel)
```
URL: https://frontend-ten-pied-ucmtf13d1v.vercel.app
Build: tsc && vite build (39 modules, 460KB)
Deploy: vercel --yes --prod
```

### Backend (Render)
```
URL: https://shade-api-gbyb.onrender.com
Runtime: Python 3.11 + FastAPI + Uvicorn
Auto-deploy: GitHub push triggers Render build
```

### Database (Supabase)
```
Project: ursmvbxlkhvicakjrwtf
Tables: sites, assessments, route_queries
```

---

## 🔮 Future Roadmap

1. **4-Tier Alert Escalation System** — Automated notification chains (in-app → email → SMS → phone call) based on NWS thresholds
2. **OSHA Report Generator** — Automated compliance reports from assessment data
3. **Worker Check-In PWA** — Mobile-first tool for workers to log heat symptoms
4. **Historical Trends** — Year-over-year heat pattern analysis
5. **ROI Calculator** — Quantifiable ROI for Shade subscription vs. heat-related costs

---

## 👥 Team

- **Bhavya Usha** — Full Stack Development, AI/ML Integration
- FortyGuard API — Hyperlocal temperature data
- OpenStreetMap — Street network data
- NIOSH/OSHA — Regulatory standards and thresholds

---

*Documentation generated for hackathon presentation. All data, thresholds, and financial models are grounded in official OSHA, NIOSH, and NWS sources.*
