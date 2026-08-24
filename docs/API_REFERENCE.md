# Shade API Reference

**Base URL:** `https://shade-api-gbyb.onrender.com` (production) or `http://localhost:8000` (local)

All endpoints return JSON unless noted otherwise. Content-Type: `application/json`.

---

## Health & Config

### GET /api/health
Returns service health status.
```json
{"status": "ok", "service": "shade"}
```

### GET /api/config
Returns public config (no secrets exposed).
```json
{
  "name": "Shade",
  "version": "1.0.0",
  "fortyguard_configured": true,
  "supabase_configured": true
}
```

---

## Sites

### GET /api/sites
List all sites in the portfolio.
```json
[
  {
    "site_id": "WH-SF-01",
    "name": "SF Waterfront Warehouse",
    "latitude": 37.7955,
    "longitude": -122.3937,
    "site_type": "warehouse",
    "created_at": "2026-08-24T00:00:00"
  }
]
```

### POST /api/sites
Create a new site.
```json
// Request
{
  "site_id": "WH-SF-02",
  "name": "New Warehouse",
  "latitude": 37.8,
  "longitude": -122.4,
  "site_type": "warehouse"
}
// Response: same object with created_at
```

### POST /api/sites/upload
Upload a CSV file with sites. Content-Type: `multipart/form-data`.
- **File field:** `file`
- **Required columns:** `site_id, name, latitude, longitude`
- **Optional column:** `site_type` (warehouse|construction|route_hub|other)
- **Validation:** US coordinates, no duplicate site_ids
- Returns array of added sites.

### DELETE /api/sites/{site_id}
Delete a site by ID.

---

## Risk Assessment

### POST /api/assessment/fleet
Run fleet-wide risk assessment. Returns ranked results (CRITICAL first).

```json
// Request
{
  "site_ids": [],          // empty = all sites
  "threshold_key": "OSHA_ACTION"  // optional
}

// Response
{
  "sites": [
    {
      "site_id": "WH-TR-01",
      "name": "Tracy Logistics Hub",
      "latitude": 37.7397,
      "longitude": -121.4252,
      "site_type": "warehouse",
      "temperature_c": 43.9,
      "heat_index": 45.2,
      "risk_bucket": "CRITICAL",
      "risk_color": "#ef4444",
      "threshold_label": "Critical Risk",
      "threshold_source": "Above NIOSH REL (WBGT 28°C) for sustained exposure",
      "exceedance_hours": 12.0,
      "persistence_hours": 6.0,
      "recommendation": "Halt outdoor work during peak hours...",
      "response_time_ms": 2
    }
  ],
  "stats": {"min": 19.0, "max": 43.9, "mean": 31.5},
  "assessed_at": "2026-08-24T12:00:00",
  "response_time_ms": 2,
  "cached": false
}
```

**Risk buckets (sourced thresholds):**
| Bucket | Heat Index | Source |
|---|---|---|
| LOW | < 26.7°C (80°F) | Below OSHA precaution trigger |
| MEDIUM | 26.7–32.2°C | Between OSHA 80°F and 90°F triggers |
| HIGH | 32.2–37.8°C | Above OSHA 90°F action trigger |
| CRITICAL | > 37.8°C | Above NIOSH REL |

### GET /api/assessment/site/{site_id}
Get detailed assessment for a single site. Returns 12-hour trend, env params, and risk classification.

---

## Heat P&L

### GET /api/heat-pl
Compute the Heat P&L for today using real assessment data + company policy rates.

```json
{
  "total_cost": 15500.00,
  "lines": [
    {
      "label": "Hazard pay owed",
      "amount": 3750.00,
      "formula": "($25/hr) × (8.5 HIGH hrs + 3.2 CRITICAL hrs)",
      "inputs": {"rate": 25.0, "high_hours": 8.5, "critical_hours": 3.2},
      "disclaimer": "Company-entered rate × actual risk hours."
    },
    {
      "label": "Productivity $ preserved",
      "amount": 875.00,
      "formula": "(5.0 hrs avoided) × 0.5 (SF Fed/Duke factor) × $35/hr",
      "inputs": {"hours_avoided": 5.0, "factor": 0.5, "wage_rate": 35.0},
      "disclaimer": "Based on SF Fed/Duke finding. Labeled as estimate."
    },
    {
      "label": "Schedule-delay claim value",
      "amount": 15000.00,
      "formula": "(3 exceedance days) × $5000/day",
      "inputs": {"exceedance_days": 3, "day_rate": 5000.0},
      "disclaimer": "Evidence value for potential delay claims. Not guaranteed."
    },
    {
      "label": "Compliance readiness",
      "amount": 0,
      "formula": "Status only — cannot honestly price fine/litigation-risk avoided",
      "inputs": {},
      "disclaimer": "OSHA fines range from $16,131 to $161,323..."
    }
  ],
  "date": "2026-08-24",
  "site_count": 8
}
```

### GET /api/heat-pl/policy
Get company policy rates.

### PUT /api/heat-pl/policy
Update company policy rates.
```json
{
  "hazard_pay_rate_per_hr": 25.0,
  "wage_rate_per_hr": 35.0,
  "contract_day_rate": 5000.0
}
```

---

## Kelvin — Safety Assistant

### POST /api/kelvin
Process a query through Kelvin's deterministic intent router.

```json
// Request
{"message": "I want to go from SF Waterfront to Tracy Logistics"}

// Response
{
  "intent": "coolest_route",
  "response": "Got it! Routing from SF Waterfront Warehouse to Tracy Logistics Hub...",
  "data": {
    "origin": "sf waterfront",
    "destination": "tracy logistics",
    "origin_site_id": "WH-SF-01",
    "origin_lat": 37.7955,
    "origin_lon": -122.3937,
    "dest_site_id": "WH-TR-01",
    "dest_lat": 37.7397,
    "dest_lon": -121.4252,
    "action": {
      "type": "navigate_route",
      "origin_id": "WH-SF-01",
      "dest_id": "WH-TR-01"
    }
  },
  "confidence": 0.8
}
```

**Supported intents:**
| Intent | Example Phrases |
|---|---|
| `site_safety` | "Is WH-SF-01 safe?", "Is SF Waterfront safe right now?" |
| `riskiest_site` | "Which site is riskiest?", "Most dangerous site" |
| `coolest_route` | "coolest route from A to B", "route from Oakland to Tracy", "I want to go from A to B" |
| `heat_cost` | "What did heat cost us today?", "How much money did heat cost?" |
| `site_temperature` | "What's the temperature at SF?", "Temp at Tracy" |
| `risk_count` | "How many sites are critical?", "How many high risk sites?" |
| `help` | "help", "what can you do" |

**Kelvin design rationale (safety-critical):**
- Kelvin NEVER calls FortyGuard directly
- Kelvin NEVER computes its own numbers
- Kelvin only phrases pre-computed results from backend functions
- All answers shown as on-screen text (required fallback if voice fails)
- Auto-triggers fleet assessment if cache is empty

---

## Route Planner

### POST /api/routes/plan
Plan fastest vs coolest route using OSMnx street graph.

```json
// Request
{
  "origin_lat": 37.7955,
  "origin_lon": -122.2789,
  "dest_lat": 37.978,
  "dest_lon": -122.0311,
  "origin_name": "Oakland Port",
  "dest_name": "Concord Distribution",
  "travel_mode": "drive"  // "drive" or "walk"
}

// Response
{
  "origin": {"name": "Oakland Port", "lat": 37.7955, "lon": -122.2789},
  "destination": {"name": "Concord Distribution", "lat": 37.978, "lon": -122.0311},
  "fastest_route": {
    "type": "LineString",
    "coordinates": [[-122.2789, 37.7955], ...],
    "avg_temp_c": 28.6
  },
  "coolest_route": {
    "type": "LineString",
    "coordinates": [[-122.2789, 37.7955], ...],
    "avg_temp_c": 26.9
  },
  "temp_delta_f": 3.1,
  "temp_delta_c": 1.7,
  "time_delta_min": 4,
  "distance_km": 42.3,
  "travel_mode": "drive"
}
```

**Routing algorithm:**
1. **Fastest route:** OSMnx shortest path by distance on street network
2. **Coolest route:** Follows fastest route but deviates at hot points (>30°C) with Gaussian-smoothed perpendicular offsets
3. **Walk vs Drive:** Different `network_type` in OSMnx (`'walk'` vs `'drive'`)
4. **Long routes (>15km):** Segmented into ~12km chunks, each with its own OSMnx graph

### POST /api/routes/helpful
Mark a route as helpful (feeds compliance reports).

### GET /api/routes/sites
List all sites for the route planner dropdown.

---

## Street View / Pegman

### GET /api/streetview/heat-data
Get FortyGuard environmental parameters for a specific map point.

```
GET /api/streetview/heat-data?lat=37.7955&lon=-122.3937

Response:
{
  "lat": 37.7955,
  "lon": -122.3937,
  "temperature_c": 19.0,
  "heat_index_c": 20.5,
  "humidity": 75.0,
  "solar_irradiance": 350.0,
  "aqi": 35
}
```

---

## Reports

### POST /api/reports/generate
Generate a PDF compliance report. Returns PDF binary.

```json
// Request
{
  "scope": "site",     // "site" or "company"
  "site_id": "WH-SF-01"  // required if scope="site"
}
// Response: PDF binary (application/pdf)
```

**Report name:** `Shade_Heat_Exposure_Record_SG-1_{site_id}_{date}.pdf`

### POST /api/reports/csv
Generate a CSV compliance report. Same request format, returns CSV binary.

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `FORTYGUARD_API_KEY` | FortyGuard API key | Yes (falls back to demo data) |
| `FORTYGUARD_BASE_URL` | FortyGuard API base URL | No (default: https://api.fortyguard.com) |
| `SUPABASE_URL` | Supabase project URL | Yes (falls back to in-memory) |
| `SUPABASE_KEY` | Supabase anon key | Yes (for REST API) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes (bypasses RLS) |
| `FORTYGUARD_LIVE` | Set to "true" to force live API calls | No (default: false, uses demo data) |
