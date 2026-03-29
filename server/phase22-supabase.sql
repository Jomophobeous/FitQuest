-- ============================================================
-- FitQuest Backend — Phase 22 Supabase SQL
-- Run this in Supabase SQL Editor
-- 
-- Prerequisite: users, subscriptions, devices tables from Phase 20
--               ai_usage table from Phase 21
-- ============================================================

-- 1. ADD metadata COLUMN TO events TABLE
-- logEvent now stores anomaly context (signals, scores) as JSON
ALTER TABLE events ADD COLUMN IF NOT EXISTS metadata TEXT;

-- 2. COMPOSITE INDEX: anomalyEngine queries events by (user_id, event_type, timestamp)
-- Used by: countFailedVerifications, countVersionDowngrades
CREATE INDEX IF NOT EXISTS idx_events_user_type_ts
  ON events (user_id, event_type, timestamp DESC);

-- 3. COMPOSITE INDEX: anomalyEngine queries events by (user_id, timestamp)
-- Used by: countDistinctDevices, countDistinctIPs
CREATE INDEX IF NOT EXISTS idx_events_user_ts
  ON events (user_id, timestamp DESC);

-- 4. COMPOSITE INDEX: anomalyEngine queries ai_usage by (user_id, timestamp)
-- Used by: analyzeAIUsage
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_ts
  ON ai_usage (user_id, timestamp DESC);

-- ============================================================
-- VERIFICATION: Run this SELECT to confirm schema is correct
-- Should return rows for all 5 tables with expected columns
-- ============================================================
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'subscriptions', 'devices', 'events', 'ai_usage')
ORDER BY table_name, ordinal_position;
