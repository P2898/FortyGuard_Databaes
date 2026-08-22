-- Shade Database Schema for Supabase (Postgres)
-- Run this in: Supabase Dashboard → SQL Editor → New Query

-- 1. Sites table
CREATE TABLE IF NOT EXISTS sites (
  site_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  site_type TEXT DEFAULT 'other',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Risk assessments
CREATE TABLE IF NOT EXISTS risk_assessments (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT REFERENCES sites(site_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  temperature_c DOUBLE PRECISION,
  heat_index DOUBLE PRECISION,
  exceedance_hours DOUBLE PRECISION DEFAULT 0,
  persistence_hours DOUBLE PRECISION DEFAULT 0,
  threshold_value DOUBLE PRECISION,
  threshold_source TEXT,
  risk_bucket TEXT,
  risk_color TEXT,
  recommendation TEXT,
  response_time_ms INTEGER DEFAULT 0
);

-- 3. Route queries
CREATE TABLE IF NOT EXISTS route_queries (
  id BIGSERIAL PRIMARY KEY,
  origin TEXT,
  destination TEXT,
  fastest_route_geojson JSONB,
  coolest_route_geojson JSONB,
  temp_delta DOUBLE PRECISION,
  time_delta DOUBLE PRECISION,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  site_id TEXT REFERENCES sites(site_id) ON DELETE CASCADE,
  risk_bucket TEXT,
  threshold_source TEXT,
  recommendation TEXT,
  recommendation_followed BOOLEAN DEFAULT FALSE
);

-- 5. Compliance reports
CREATE TABLE IF NOT EXISTS compliance_reports (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  site_id TEXT REFERENCES sites(site_id) ON DELETE SET NULL,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  pdf_url TEXT,
  csv_url TEXT
);

-- 6. Company policy
CREATE TABLE IF NOT EXISTS company_policy (
  id BIGSERIAL PRIMARY KEY,
  hazard_pay_rate_per_hr DOUBLE PRECISION DEFAULT 25.0,
  wage_rate_per_hr DOUBLE PRECISION DEFAULT 35.0,
  contract_day_rate DOUBLE PRECISION DEFAULT 5000.0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Heat P&L ledger
CREATE TABLE IF NOT EXISTS heat_pl_ledger (
  id BIGSERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  site_id TEXT REFERENCES sites(site_id) ON DELETE CASCADE,
  hazard_pay_owed DOUBLE PRECISION DEFAULT 0,
  productivity_dollars DOUBLE PRECISION DEFAULT 0,
  delay_claim_value DOUBLE PRECISION DEFAULT 0,
  compliance_status TEXT DEFAULT 'active',
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. User preferences (voice toggle, theme)
CREATE TABLE IF NOT EXISTS user_preferences (
  id BIGSERIAL PRIMARY KEY,
  voice_selection TEXT DEFAULT 'default',
  theme TEXT DEFAULT 'dark'
);

-- Insert default company policy
INSERT INTO company_policy (hazard_pay_rate_per_hr, wage_rate_per_hr, contract_day_rate)
VALUES (25.0, 35.0, 5000.0)
ON CONFLICT DO NOTHING;

-- Insert default user preferences
INSERT INTO user_preferences (voice_selection, theme)
VALUES ('default', 'dark')
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_assessments_site ON risk_assessments(site_id);
CREATE INDEX IF NOT EXISTS idx_assessments_timestamp ON risk_assessments(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_site ON audit_log(site_id);
CREATE INDEX IF NOT EXISTS idx_heat_pl_date ON heat_pl_ledger(date);
