-- Migration: Add v2 columns for route features and avatar setup
-- Run in: Supabase Dashboard → SQL Editor → New Query

-- 1. Add travel_mode and route_helpful to route_queries
ALTER TABLE route_queries ADD COLUMN IF NOT EXISTS travel_mode TEXT DEFAULT 'drive';
ALTER TABLE route_queries ADD COLUMN IF NOT EXISTS route_helpful BOOLEAN DEFAULT NULL;

-- 2. Add avatar_gender and avatar_outfit to user_preferences
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS avatar_gender TEXT DEFAULT 'default';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS avatar_outfit TEXT DEFAULT 'default';

-- 3. Add recommendation_followed to audit_log if not exists
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS recommendation_followed BOOLEAN DEFAULT FALSE;
