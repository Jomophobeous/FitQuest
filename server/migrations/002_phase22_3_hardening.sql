-- ============================================================
-- Phase 22.3 Migration — Anti-Abuse + Hardening
--
-- Run in Supabase SQL Editor AFTER Phase 22.2 is live.
-- All statements are idempotent.
--
-- Changes:
--   1. RLS policies: service_role only on all 6 tables
--   2. New indexes: ai_usage(device), ai_usage(user+device),
--      anomalies(dedup), anomalies(device)
--   3. JSONB conversion safety for anomalies.metadata
-- ============================================================

-- ── 1. RLS Policies — service_role only ──

DROP POLICY IF EXISTS users_service_only ON users;
CREATE POLICY users_service_only ON users
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS subscriptions_service_only ON subscriptions;
CREATE POLICY subscriptions_service_only ON subscriptions
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS devices_service_only ON devices;
CREATE POLICY devices_service_only ON devices
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS events_service_only ON events;
CREATE POLICY events_service_only ON events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS ai_usage_service_only ON ai_usage;
CREATE POLICY ai_usage_service_only ON ai_usage
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS anomalies_service_only ON anomalies;
CREATE POLICY anomalies_service_only ON anomalies
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ── 2. New Indexes ──

-- AI usage: device-level tracking
CREATE INDEX IF NOT EXISTS idx_ai_usage_device_ts
  ON ai_usage (device_id, timestamp DESC);

-- AI usage: user + device composite for per-session abuse
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_device_ts
  ON ai_usage (user_id, device_id, timestamp DESC);

-- Anomalies: dedup queries (type + device + user + time)
CREATE INDEX IF NOT EXISTS idx_anomalies_dedup
  ON anomalies (user_id, device_id, anomaly_type, created_at DESC);

-- Anomalies: device-level tracking
CREATE INDEX IF NOT EXISTS idx_anomalies_device_ts
  ON anomalies (device_id, created_at DESC);


-- ── 3. JSONB Safety ──

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'anomalies'
      AND column_name = 'metadata'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE anomalies
      ALTER COLUMN metadata TYPE JSONB
      USING COALESCE(metadata::jsonb, '{}'::jsonb);
  END IF;
END $$;


-- ── Verification ──
SELECT 'Phase 22.3 migration complete' AS status;
