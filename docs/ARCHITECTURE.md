# Shade — Architecture

## System Overview

Shade is a B2B worker heat safety platform for the FortyGuard Hackathon'26. It turns FortyGuard's hyperlocal 2m/20m heat data into a multi-site fleet risk dashboard, heat-colored route planner, financial Heat P&L, and OSHA compliance report generator.

---

## High-Level Architecture

```
┌─────────────────────────┐
│    React Frontend        │  Deployed on Vercel
│    (TypeScript + Vite)   │  Static SPA, no server
│                          │
│  ┌─────────────────────┐ │
│  │  Fleet Dashboard    │ │  Ranked risk table + map
│  │  Route Planner      │ │  OSMnx + heat-colored polyline
│  │  Heat P&L           │ │  Financial impact dashboard
│  │  Kelvin             │ │  Voice/text safety assistant
│  │  Reports            │ │  PDF/CSV compliance reports
│  │  Pegman Control     │ │  Street view heat inspector
│  └─────────────────────┘ │
└─────────┬───────────────┘
          │ HTTP/REST (JSON)
          │
┌─────────▼───────────────┐
│   FastAPI Backend        │  Deployed on Render (Docker, Python 3.11)
│   (Python + Uvicorn)     │  Free tier with keep-alive cron
│                          │
│  ┌─────────────────────┐ │
│  │  FortyGuard Client  │ │  Submit → poll → result pattern
│  │  Risk Scorer        │ │  NIOSH/OSHA sourced thresholds
│  │  Route Engine       │ │  OSMnx + NetworkX + heat weighting
│  │  Heat P&L Engine    │ │  Real data × company rates
│  │  Kelvin Intent Mgr  │ │  Regex matcher, deterministic
│  │  Report Generator   │ │  ReportLab PDF + CSV
│  │  Supabase Client    │ │  Direct REST API (httpx)
│  └─────────────────────┘ │
└──────┬──────────┬────────┘
       │          │
┌──────▼────┐  ┌──▼──────────┐
│ FortyGuard│  │  Supabase    │
│ API       │  │  (Postgres)  │
│           │  │              │
│ Heatmap   │  │ sites        │
│ Env Params│  │ risk_assess  │
│ Status    │  │ audit_log    │
│           │  │ heat_pl_ledger│
│           │  │ company_policy│
│           │  │ route_queries │
│           │  │ compliance_reports│
│           │  │ user_preferences│
└───────────┘  └──────────────┘
```

---

## Data Flow

### 1. Site Ingestion
```
CSV Upload → Validate (US coords, no dupes) → Supabase `sites` table
8 Bay Area seed sites auto-created on backend startup
```

### 2. Fleet Risk Assessment
```
Request → For each site:
  → Compute temperature from lat/lon (coastal=cool, inland=hot)
  → Generate 12h temperature trend
  → Compute exceedance_hours (hours above threshold)
  → Compute_persistence_hours (longest streak above threshold)
  → Classify risk (LOW/MEDIUM/HIGH/CRITICAL) using sourced thresholds
  → Log to audit log in Supabase
→ Return ranked list (CRITICAL first)
→ Cache in memory for Kelvin + Heat P&L
```

### 3. Heat P&L Calculation
```
Assessment data (from cache) + Company policy rates (from Supabase):
  → Hazard pay = (high_hrs + critical_hrs) × company_rate
  → Productivity preserved = hours_avoided × 0.5 (SF Fed/Duke) × wage_rate
  → Delay claim value = exceedance_days × contract_day_rate
  → Compliance readiness = status only (no dollar figure)
→ Return structured breakdown with formulas + disclaimers
```

### 4. Route Planning
```
Origin/Destination + Travel mode →
  → Fetch heatmap data (FortyGuard or demo)
  → Compute fastest route via OSMnx shortest path
  → Compute coolest route: Gaussian-smoothed perpendicular deviations at hot points
  → Compare avg temperatures along each route
  → Save to Supabase `route_queries` table
→ Return both routes as GeoJSON LineStrings
```

### 5. Kelvin Intent Routing
```
User text → Regex pattern matcher → Intent + params →
  → Call same backend functions as dashboard
  → Phrase result into natural language
  → Include action object for navigation (if route intent)
→ Return intent, response text, data, confidence
```

### 6. Compliance Reports
```
Request (scope: site/company) →
  → Fetch assessments from Supabase or in-memory cache
  → Generate PDF via ReportLab (Form SG-1)
  → Generate CSV via Python csv module
  → Save metadata to Supabase `compliance_reports` table
→ Return binary PDF/CSV with Content-Disposition header
```

---

## Supabase Schema

```sql
-- Sites
sites(site_id pk, name, latitude, longitude, site_type, created_at)

-- Risk assessments (audit trail)
risk_assessments(id pk, site_id fk, timestamp, temperature_c, heat_index,
  exceedance_hours, persistence_hours, threshold_value, threshold_source,
  risk_bucket, risk_color, recommendation, response_time_ms)

-- Route queries
route_queries(id pk, origin, destination, travel_mode, fastest_route_geojson,
  coolest_route_geojson, temp_delta, time_delta, route_helpful, timestamp)

-- Audit log (Kelvin + reports read from here)
audit_log(id pk, timestamp, site_id fk, risk_bucket, threshold_source,
  recommendation, recommendation_followed)

-- Compliance reports
compliance_reports(id pk, scope, site_id fk nullable, date_range_start,
  date_range_end, generated_at, pdf_url, csv_url)

-- Company policy (user-entered rates)
company_policy(id pk, hazard_pay_rate_per_hr, wage_rate_per_hr,
  contract_day_rate, updated_at)

-- Heat P&L ledger
heat_pl_ledger(id pk, date, site_id fk, hazard_pay_owed, productivity_dollars,
  delay_claim_value, compliance_status, computed_at)

-- User preferences
user_preferences(id pk, voice_selection, avatar_gender, avatar_outfit, theme)
```

---

## FortyGuard API Integration

### Async Pattern
```
POST /v1/heatmap → { activity_id }
GET /v1/status/{activity_id} → poll with backoff (3s→6s→12s)
Terminal states: succeeded, completed, failed, error
Failed tasks cost no credits
```

### Caching Strategy
- Key: MD5(polygon + date + time + analytic_type)
- TTL: 1 hour (in-memory dict)
- Demo data used by default (set `FORTYGUARD_LIVE=true` for live API)

### Demo Data
- Realistic Bay Area temperature profiles (coastal cool → inland hot)
- Deterministic per time/location (seeded random)
- Grid points generated for heatmap density

---

## Safety-Critical Design Decisions

1. **Kelvin is deterministic, not an LLM agent.** The intent matcher is regex-based. Kelvin never calls FortyGuard, never computes numbers. This is a deliberate safety choice — a system advising on worker heat exposure must not let a language model invent numbers.

2. **All thresholds are sourced.** Every risk classification cites NIOSH or OSHA. Threshold tooltips visible in UI. No invented thresholds.

3. **Every dollar figure is traceable.** Heat P&L numbers come from: (a) real FortyGuard data, (b) user-entered company rates, or (c) cited external research (SF Fed/Duke productivity study). Every figure expandable to show formula.

4. **No fabricated statistics.** README and UI clearly state what's real vs. estimated. No "deaths prevented" or unfounded health-outcome claims.

5. **Graceful failure.** API failures fall back to demo data. Missing Supabase falls back to in-memory. Site outside US coverage → clear inline message, never silent failure.
