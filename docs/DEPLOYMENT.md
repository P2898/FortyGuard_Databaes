# Shade — Deployment Guide

## Prerequisites

- **Node.js** (for frontend)
- **Python 3.11+** (for backend)
- **Git** (GitHub repo: P2898/FortyGuard_Databaes)
- **Supabase** project (see .env for URL)
- **FortyGuard** API key

---

## Environment Variables

Create `backend/.env` (git-ignored):
```
FORTYGUARD_API_KEY=your_fortyguard_api_key_here
FORTYGUARD_BASE_URL=https://api.fortyguard.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
FORTYGUARD_LIVE=false
```

---

## Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
# Proxy routes /api/* to http://localhost:8000
```

### Verify
```bash
curl http://localhost:8000/api/health
# → {"status":"ok","service":"shade"}
```

---

## Supabase Setup

### 1. Create Project
1. Go to https://supabase.com → New Project
2. Name: `shade-demo` (or any name)
3. Region: closest to you
4. **Skip RLS** — demo has no auth, only backend writes

### 2. Get Credentials
Go to Settings → API:
- Project URL: `https://your-project.supabase.co`
- anon/public key: `your_anon_key`
- service_role key: `your_service_role_key`

### 3. Run Schema
Open SQL Editor → New Query → paste and run:
```sql
-- From backend/schema.sql
-- Also run backend/migrations/add_v2_columns.sql for v2 features
ALTER TABLE route_queries ADD COLUMN IF NOT EXISTS travel_mode TEXT DEFAULT 'drive';
ALTER TABLE route_queries ADD COLUMN IF NOT EXISTS route_helpful BOOLEAN DEFAULT NULL;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS avatar_gender TEXT DEFAULT 'default';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS avatar_outfit TEXT DEFAULT 'default';
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS recommendation_followed BOOLEAN DEFAULT FALSE;
```

### 4. Verify
In SQL Editor:
```sql
SELECT * FROM sites;
-- Should show 8 Bay Area seed sites
```

---

## Deploy Frontend to Vercel

```bash
cd frontend
npm install -g vercel
vercel login
vercel --yes --prod
```

**Vercel config** (`frontend/vercel.json`):
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://shade-api-gbyb.onrender.com/api/:path*" }
  ]
}
```

The rewrite rule proxies API calls from the Vercel domain to the Render backend.

---

## Deploy Backend to Render

### Option A: Docker (recommended, used currently)
1. The `Dockerfile` at repo root forces Python 3.11.9-slim
2. Render auto-detects it

### Option B: Native Python
1. Go to https://dashboard.render.com/new/web
2. Connect GitHub repo: `P2898/FortyGuard_Databaes`
3. Configure:
   - **Name:** `shade-api`
   - **Language:** Python 3
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add env vars (same as `.env`)
5. Create Web Service

### Option C: Manual Docker on Render
1. Create Web Service → Source: "Use a Dockerfile"
2. Dockerfile path: `./Dockerfile`
3. Remove Build/Start commands
4. Root Directory: empty
5. Add env vars → Deploy

### Keep-Alive Cron (prevents cold-start)
Render free tier spins down after 15 min. Set up a keep-alive cron:
- Go to https://cron-job.org or UptimeRobot
- Create a job that GETs `https://shade-api-gbyb.onrender.com/api/health`
- Schedule: every 10 minutes
- This keeps the backend warm during judging window

---

## Post-Deployment Verification

### 1. Backend Health
```bash
curl https://shade-api-gbyb.onrender.com/api/health
# → {"status":"ok","service":"shade"}
```

### 2. API Endpoints
```bash
# Sites
curl https://shade-api-gbyb.onrender.com/api/sites

# Fleet assessment
curl -X POST https://shade-api-gbyb.onrender.com/api/assessment/fleet \
  -H "Content-Type: application/json" -d '{}'

# Kelvin
curl -X POST https://shade-api-gbyb.onrender.com/api/kelvin \
  -H "Content-Type: application/json" \
  -d '{"message":"Which site is riskiest?"}'
```

### 3. Frontend
Open https://frontend-ten-pied-ucmtf13d1v.vercel.app in incognito:
- No login required
- Dashboard loads with 8 sites
- Kelvin responds to questions
- Route planner shows both routes
- Reports generate PDF/CSV

### 4. Supabase
Check in Supabase dashboard → Table Editor:
- `sites` table has 8 rows
- `risk_assessments` has entries from fleet assessment
- `company_policy` has policy rates

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Render build fails with pydantic-core | Use Dockerfile (forces Python 3.11) |
| Render ignores runtime.txt | Put runtime.txt at repo root, not in backend/ |
| Frontend can't reach backend | Check vercel.json rewrites, ensure backend is live |
| Kelvin returns "N/A" | Run a fleet assessment first (auto-triggers on first Kelvin query) |
| Route planner shows zig-zag | Ensure latest code is deployed (Gaussian smoothing fix) |
| Supabase connection refused | Check env vars, ensure RLS is disabled |
| Cold start delay (50s+) | Set up keep-alive cron on cron-job.org |
