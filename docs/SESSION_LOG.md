# Shade — Full Session Log

## Project: FortyGuard Hackathon'26 — "Building the World's Temperature AI"

**App Name:** Shade  
**Assistant:** Kelvin (voice/text safety assistant)  
**Repo:** https://github.com/P2898/FortyGuard_Databaes  
**Live Frontend:** https://frontend-ten-pied-ucmtf13d1v.vercel.app  
**Live Backend:** https://shade-api-gbyb.onrender.com  
**Database:** Supabase (https://ursmvbxlkhvicakjrwtf.supabase.co)

---

## Session 1: Initial Build (Baseline → Full App)

### What was built
Complete full-stack worker heat safety platform from the baseline repo.

**Backend (Python FastAPI):**
| Endpoint | Description | Status |
|---|---|---|
| `GET /api/health` | Health check | ✅ |
| `GET /api/config` | Public config (no secrets) | ✅ |
| `GET /api/sites` | List all 8 Bay Area seed sites | ✅ |
| `POST /api/sites` | Create a new site | ✅ |
| `POST /api/sites/upload` | CSV upload with validation | ✅ |
| `DELETE /api/sites/{id}` | Delete a site | ✅ |
| `POST /api/assessment/fleet` | Fleet risk assessment (all sites) | ✅ |
| `GET /api/assessment/site/{id}` | Site detail with 12h trend | ✅ |
| `GET /api/heat-pl` | Heat P&L computation | ✅ |
| `GET /api/heat-pl/policy` | Get company policy | ✅ |
| `PUT /api/heat-pl/policy` | Update company policy | ✅ |
| `POST /api/kelvin` | Kelvin intent router | ✅ |
| `POST /api/routes/plan` | Route planner (OSMnx + heat-weighted) | ✅ |
| `POST /api/routes/helpful` | Mark route as helpful | ✅ |
| `GET /api/routes/sites` | Sites for route planner | ✅ |
| `POST /api/reports/generate` | PDF compliance report (ReportLab) | ✅ |
| `POST /api/reports/csv` | CSV compliance report | ✅ |
| `GET /api/streetview/heat-data` | Pegman drop heat data | ✅ |

**Frontend (React + TypeScript + Tailwind):**
- Fleet Dashboard — ranked risk table + distribution chart + CSV export
- Fleet Map — Leaflet + OSM with risk-colored markers + heatmap circles
- Site Detail — 12h trend chart + environmental parameters + sourced thresholds
- Route Planner — site dropdowns + fastest vs coolest heat-colored polyline
- Heat P&L — animated headline + expandable formula breakdowns + compliance status
- Kelvin — mic input (Web Speech API) + voice toggle + quick-question chips
- Reports — real PDF/CSV generation via backend
- Settings — company policy rates + voice preference + route avatar setup
- Upload — CSV validation + inline errors

### Deployment
- Frontend deployed to Vercel: `vercel --yes --prod`
- Backend deployed to Render via Dockerfile (Python 3.11.9)
- Supabase connected with 8 tables (REST API via httpx, no supabase-py)
- Runtime.txt moved to repo root for Render to detect
- Dockerfile used to force Python 3.11 (Render ignores runtime.txt when root dir is set)

### Key challenges solved
1. **Render Python 3.14 + pydantic-core:** Render defaults to Python 3.14, which can't compile pydantic-core. Solved with Dockerfile using `python:3.11.9-slim`.
2. **supabase-py Rust dependency:** Replaced with direct httpx REST calls to Supabase PostgREST API.
3. **CORS:** Backend allows all origins for demo simplicity.

---

## Session 2: V2 Features + Supabase + Deployment

### New features added
1. **Route avatar with construction/delivery outfits** — SVG-based avatars
2. **Animated route playback** — later removed (wasn't useful)
3. **"Was this route helpful?" prompt** — wired to audit log via `/api/routes/helpful`
4. **Travel mode selector** — walk vs drive using OSMnx `network_type`
5. **Live GPS as origin option** — browser geolocation API
6. **Avatar setup in Settings** — gender + outfit picker with localStorage persistence
7. **Supabase database** — persistent data across backend restarts
8. **Schema migration** — `travel_mode`, `route_helpful`, `avatar_gender`, `avatar_outfit` columns

### Deployment completed
- Render backend live at https://shade-api-gbyb.onrender.com
- Vercel frontend live at https://frontend-ten-pied-ucmtf13d1v.vercel.app
- All 14 endpoints tested and passing
- Supabase tables created and populated with 8 Bay Area seed sites

---

## Session 3: Kelvin → Route Flow + Pegman + Code Review

### Kelvin → Route Planner flow
Implemented the connected flow where Kelvin detects route intent, shows results, and offers a button to open the Route Planner with pre-filled origin/destination.

**Flow:**
```
User: "I want to go from SF Waterfront to Tracy Logistics"
→ Kelvin detects route intent via regex
→ Backend fuzzy-matches site names, returns real coordinates + action object
→ Kelvin responds with confirmation + "Open Route Planner" button
→ Click → switches to Route Planner view with origin/dest pre-selected
→ Route auto-plans: fastest (blue dashed) + coolest (heat-colored)
→ Pegman marker placed at starting point
```

**Kelvin intent patterns supported:**
| Pattern | Example |
|---|---|
| Site safety (ID) | "Is WH-SF-01 safe?" |
| Site safety (name) | "Is SF Waterfront safe right now?" |
| Riskiest site | "Which site is riskiest?" |
| Route (explicit) | "coolest route from A to B" |
| Route (action) | "I want to go from A to B" |
| Route (simple) | "route from Oakland to Tracy" |
| Heat cost | "What did heat cost us today?" |
| Risk count | "How many sites are critical?" |
| Temperature | "What's the temperature at SF?" |
| Help | "help" / "what can you do" |

### Pegman street view inspector
Built a Google Maps-style draggable pegman control for Leaflet maps:
- Orange person icon in bottom-right corner of every map
- Drag and drop onto any point → fetches FortyGuard heat data
- Shows temperature (2m height), heat index, humidity, solar irradiance, AQI
- "View Street Level" button opens Mapillary at those coordinates
- Shift+Click fallback for accessibility
- Map dims while dragging with "Drop here for street view + heat data" hint

### Code review findings and fixes

#### Critical bugs fixed:
1. **Kelvin site_safety returned "N/A°C"** when no fleet assessment had been run yet
   - **Fix:** Kelvin auto-triggers a fleet assessment when the cache is empty
2. **Kelvin riskiest_site returned "none at LOW"** with empty cache
   - **Fix:** Same auto-assessment trigger
3. **Kelvin heat_cost used hardcoded policy** ($25/$35/$5000) instead of actual company rates
   - **Fix:** Reads from `company_policy` table via `_get_policy()`
4. **Auto-plan loop** — route planner replanned every time origin/dest state changed
   - **Fix:** Added `lastAutoPlanKey` ref to only auto-plan once per Kelvin navigation
5. **Route zig-zag** — perpendicular push at hot points caused jagged lines
   - **Fix:** Gaussian-smoothed perpendicular offsets (window=5, σ=2)
6. **FleetMap destroyed pegman markers** — `eachLayer` cleanup removed ALL markers
   - **Fix:** Tag pegman markers with `__pegman = true`, skip them during cleanup
7. **PegmanControl memory leak** — click handler never removed on map destroy
   - **Fix:** `addPegmanToMap()` now returns a cleanup function
8. **Kelvin site_safety couldn't match multi-word names** — regex `\S+` only matched one word
   - **Fix:** Changed to `(.+?)\s+safe` with fuzzy name matching against assessments
9. **RoutePlanner `autoPlanDone` ref blocked replanning** — user couldn't change dropdown after Kelvin
   - **Fix:** Replaced with `lastAutoPlanKey` based on initialOriginId+initialDestId

#### UX improvements:
- Added "route from X to Y" simple pattern to Kelvin intent matcher
- Added "Is SF Waterfront safe right now?" and "Route from Oakland to Tracy" quick question chips
- Kelvin site_safety response now includes site name, temperature, exceedance hours
- Cleaned up committed cache files (added `backend/cache/` to .gitignore)

---

## Architecture Summary

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React Frontend  │────▶│  FastAPI Backend  │────▶│  FortyGuard API  │
│  (Vercel)        │◀────│  (Render/Docker)  │◀────│  (heatmap, env)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │                       │
        │                 ┌──────────────────┐
        │                 │    Supabase       │
        └─────────────────│  (Postgres REST)  │
                          └──────────────────┘
```

### Data flow:
1. **Sites** → seeded on startup from `SEED_SITES` list (8 Bay Area locations)
2. **Assessment** → deterministic location-based temperature estimation (coastal=cool, inland=hot)
3. **Heatmap** → FortyGuard API (live) or demo data (default), cached by area+date+hour
4. **Routing** → OSMnx street graph + heat-weighted perpendicular deviations
5. **Kelvin** → regex intent matcher → same backend functions as dashboard
6. **Reports** → ReportLab PDF + CSV, formal "Form SG-1" naming
7. **Heat P&L** → real assessment data × company-entered rates

### Safety-critical design:
- **Kelvin NEVER calls FortyGuard directly** — only phrases pre-computed results
- **Kelvin NEVER computes its own numbers** — deterministic backend is the sole source of truth
- **All thresholds sourced** — NIOSH heat index bands, OSHA proposed triggers, CA indoor standard
- **Every number traceable** — real API data, audit log, user-entered rate, or cited external source

---

## File Structure

```
FortyGuard_Databaes/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Env vars (FortyGuard, Supabase)
│   │   ├── database.py          # Supabase REST client (httpx)
│   │   ├── routers/
│   │   │   ├── sites.py         # Site CRUD + CSV upload
│   │   │   ├── assessment.py    # Fleet risk assessment
│   │   │   ├── heat_pl.py       # Heat P&L + company policy
│   │   │   ├── kelvin.py        # Kelvin API endpoint
│   │   │   ├── route.py         # Route planner (OSMnx)
│   │   │   ├── reports.py       # PDF/CSV report generation
│   │   │   └── streetview.py    # Pegman heat data
│   │   └── services/
│   │       ├── fortyguard.py    # FortyGuard API client + caching
│   │       ├── heat_pl.py       # Heat P&L computation engine
│   │       ├── kelvin.py        # Intent matcher + response phraser
│   │       └── risk_scoring.py  # NIOSH/OSHA risk classifier
│   ├── migrations/              # Supabase schema migrations
│   ├── requirements.txt
│   ├── runtime.txt              # Python 3.11.9
│   └── setup.cfg
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Main app with sidebar navigation
│   │   ├── lib/api.ts           # API client (all endpoints)
│   │   ├── index.css            # Tailwind + dark theme + pegman CSS
│   │   └── components/
│   │       ├── FleetDashboard.tsx   # Ranked risk table + chart
│   │       ├── FleetMap.tsx         # Leaflet map with risk markers
│   │       ├── SiteDetail.tsx       # Site detail + trend chart
│   │       ├── RoutePlanner.tsx     # Route planning + heat-colored polyline
│   │       ├── HeatPLScreen.tsx     # Heat P&L financial dashboard
│   │       ├── ReportsScreen.tsx    # PDF/CSV report generation
│   │       ├── KelvinPanel.tsx      # Voice/text safety assistant
│   │       ├── SettingsScreen.tsx   # Company policy + avatar setup
│   │       ├── UploadScreen.tsx     # CSV upload + validation
│   │       ├── PegmanControl.tsx    # Draggable street view inspector
│   │       ├── RouteAvatar.tsx      # Worker avatar SVGs
│   │       └── helpers.ts           # Risk colors, CSV export
│   ├── public/
│   │   └── shade-logo.jpeg
│   ├── vercel.json
│   └── package.json
├── Dockerfile                   # Render deployment (Python 3.11.9)
├── render.yaml                  # Render service config
├── .env                         # API keys (git-ignored)
├── .env.example
├── README.md
├── SUBMISSION_SUMMARY.md
└── docs/
    ├── SESSION_LOG.md           # This file
    ├── API_REFERENCE.md         # All API endpoints documented
    ├── ARCHITECTURE.md          # System design + data flow
    ├── DEPLOYMENT.md            # Deployment instructions
    └── TESTING.md               # Test results + verification
```
