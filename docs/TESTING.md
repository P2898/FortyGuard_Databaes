# Shade — Testing & Verification

## Test Results (August 24, 2026)

### Backend API Tests

| # | Endpoint | Test | Result | Time |
|---|---|---|---|---|
| 1 | GET /api/health | Basic health check | ✅ | <1ms |
| 2 | GET /api/sites | List 8 seed sites | ✅ | <1ms |
| 3 | POST /api/assessment/fleet | Fleet risk assessment | ✅ | 2ms |
| 4 | GET /api/assessment/site/WH-SF-01 | Site detail | ✅ | <100ms |
| 5 | GET /api/heat-pl | Heat P&L computation | ✅ | <10ms |
| 6 | GET /api/heat-pl/policy | Company policy | ✅ | <1ms |
| 7 | PUT /api/heat-pl/policy | Update policy | ✅ | <1ms |
| 8 | POST /api/kelvin (site safety) | "Is SF Waterfront safe?" | ✅ | <10ms |
| 9 | POST /api/kelvin (riskiest) | "Which site is riskiest?" | ✅ | <10ms |
| 10 | POST /api/kelvin (route) | "I want to go from Oakland to Tracy" | ✅ | <10ms |
| 11 | POST /api/kelvin (heat cost) | "What did heat cost us today?" | ✅ | <10ms |
| 12 | POST /api/kelvin (count) | "How many sites are critical?" | ✅ | <10ms |
| 13 | POST /api/kelvin (help) | "help" | ✅ | <1ms |
| 14 | POST /api/routes/plan | Route planning (short) | ✅ | ~5s |

### Kelvin Intent Tests

| Input | Expected Intent | Matched? | Fuzzy Site Match? |
|---|---|---|---|
| "Is SF Waterfront safe right now?" | site_safety | ✅ | ✅ → WH-SF-01 |
| "Is WH-TR-01 safe?" | site_safety | ✅ | ✅ exact ID |
| "Which site is riskiest?" | riskiest_site | ✅ | — |
| "I want to go from Oakland to Concord" | coolest_route | ✅ | ✅ CN-OA-01 → WH-CC-01 |
| "coolest route from San Jose to Livermore" | coolest_route | ✅ | ✅ CN-SJ-01 → CN-LV-01 |
| "route from Oakland to Tracy" | coolest_route | ✅ | ✅ CN-OA-01 → WH-TR-01 |
| "What did heat cost us today?" | heat_cost | ✅ | — |
| "How many sites are critical?" | risk_count | ✅ | ✅ count: 3 |
| "help" | help | ✅ | — |
| "What's the temperature at SF?" | site_temperature | ✅ | — |

### Risk Classification Tests

| Site | Location | Temperature | Risk Bucket | Source Verified? |
|---|---|---|---|---|
| SF Waterfront (WH-SF-01) | Coastal SF (122.39°W) | 19.0°C | LOW | ✅ Below 26.7°C |
| Oakland Port (CN-OA-01) | Coastal (122.28°W) | 22.5°C | LOW | ✅ Below 26.7°C |
| Berkeley Depot (RH-BK-01) | Coastal (122.27°W) | 21.8°C | LOW | ✅ Below 26.7°C |
| Concord Dist (WH-CC-01) | Inland (122.03°W) | 34.9°C | HIGH | ✅ 32.2–37.8°C |
| Fairfield Hub (RH-FC-01) | Inland (122.04°W) | 33.1°C | HIGH | ✅ 32.2–37.8°C |
| San Jose Build (CN-SJ-01) | Inland (121.89°W) | 39.1°C | CRITICAL | ✅ >37.8°C |
| Livermore Solar (CN-LV-01) | Inland (121.91°W) | 39.4°C | CRITICAL | ✅ >37.8°C |
| Tracy Logistics (WH-TR-01) | Inland (121.43°W) | 43.9°C | CRITICAL | ✅ >37.8°C |

### Heat P&L Verification

| Line Item | Formula | Amount | Source Traceable? |
|---|---|---|---|
| Hazard pay owed | ($25/hr) × (HIGH hrs + CRITICAL hrs) | ✅ | Company rate × real data |
| Productivity preserved | (hours avoided) × 0.5 × wage rate | ✅ | SF Fed/Duke cited factor |
| Delay claim value | (exceedance days) × day rate | ✅ | Company rate × real data |
| Compliance readiness | Status only (not a dollar figure) | ✅ | Correctly not priced |

### Frontend Screens

| Screen | Loads? | Data Shows? | Interactive? |
|---|---|---|---|
| Fleet Dashboard | ✅ | ✅ 8 sites ranked by risk | ✅ Sort, CSV export, click to detail |
| Fleet Map | ✅ | ✅ Risk-colored markers + heatmap circles | ✅ Popup with details |
| Site Detail | ✅ | ✅ 12h trend, env params, recommendation | ✅ Back button |
| Route Planner | ✅ | ✅ Both routes drawn | ✅ Dropdowns, mode toggle, pegman |
| Heat P&L | ✅ | ✅ Animated total + expandable breakdown | ✅ "Why this number?" expands |
| Kelvin | ✅ | ✅ Avatar + chat + voice | ✅ Mic, text, quick questions |
| Reports | ✅ | ✅ PDF/CSV download works | ✅ Scope/site selector |
| Settings | ✅ | ✅ Policy rates + voice + avatar | ✅ Save persists |
| Upload/Setup | ✅ | ✅ CSV validation | ✅ File picker |

### Deployment Verification

| Service | URL | Status |
|---|---|---|
| Frontend (Vercel) | https://frontend-ten-pied-ucmtf13d1v.vercel.app | ✅ Live |
| Backend (Render) | https://shade-api-gbyb.onrender.com | ✅ Live |
| Database (Supabase) | (see .env for URL) | ✅ Connected |

---

## What's Real vs. Estimated

### Real (from FortyGuard API or this app's own data):
- Site temperatures and heat indices
- Risk bucket classifications
- Exceedance and persistence hours
- Heat P&L hazard pay amounts (company rate × real hours)
- Heat P&L delay claim values (company rate × real exceedance days)
- Route temperature comparisons (real heatmap data along route)

### User-entered (company policy):
- Hazard pay rate ($/hr)
- Wage rate ($/hr)
- Contract day rate ($/day)

### Cited external research (labeled as estimates):
- Productivity loss: SF Fed/Duke finding — workers lose ~1hr/day above 85°F vs 76-80°F
- Productivity multiplier: 0.5 (conservative application of the finding)
- Compliance readiness: status only, never priced as "fines avoided"

### Sourced thresholds (never invented):
- NIOSH WBGT REL: 28°C (82.4°F) — NIOSH Criteria Document
- OSHA Precaution Trigger: 80°F (26.7°C) — OSHA Proposed Heat Rule (2024)
- OSHA Action Trigger: 90°F (32.2°C) — OSHA Proposed Heat Rule (2024)
- CA Indoor Heat Standard: 82°F (27.8°C) — Cal/OSHA Title 8 §3395
