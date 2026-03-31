-- ============================================================
-- FitQuest Backend — Complete Supabase Database Layer
-- Phases 20–22.3: Users, Subscriptions, Devices, Events,
--                 AI Usage, Anomalies, Trust + Intelligence
--                 Anti-Abuse Hardening, RLS Policies, Audit
--
-- Run this ONCE in Supabase SQL Editor.
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ────────────────────────────────────────────────────────────
-- 1. USERS (core identity + trust)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  trust_score NUMERIC DEFAULT 1.0,
  anomaly_score NUMERIC DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Phase 22.3: RLS policy — service_role only (no client access)
DROP POLICY IF EXISTS users_service_only ON users;
CREATE POLICY users_service_only ON users
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ────────────────────────────────────────────────────────────
-- 2. SUBSCRIPTIONS (authority-controlled)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_created
  ON subscriptions (user_id, created_at DESC);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_service_only ON subscriptions;
CREATE POLICY subscriptions_service_only ON subscriptions
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ────────────────────────────────────────────────────────────
-- 3. DEVICES (device-level trust)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_version TEXT,
  last_seen TIMESTAMP DEFAULT now(),
  trust_score NUMERIC DEFAULT 1.0,
  anomaly_score NUMERIC DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id
  ON devices (user_id);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS devices_service_only ON devices;
CREATE POLICY devices_service_only ON devices
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ────────────────────────────────────────────────────────────
-- 4. EVENTS (core telemetry + anomaly signals)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES devices(device_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT now()
);

-- Phase 22.3: Composite indexes for anomaly detection performance
-- IP anomaly detection: user + ip + time
CREATE INDEX IF NOT EXISTS idx_events_user_ip_ts
  ON events (user_id, ip, timestamp DESC);

-- Device switching detection: user + device + time
CREATE INDEX IF NOT EXISTS idx_events_user_device_ts
  ON events (user_id, device_id, timestamp DESC);

-- Event type queries: countFailedVerifications, countVersionDowngrades
CREATE INDEX IF NOT EXISTS idx_events_user_type_ts
  ON events (user_id, event_type, timestamp DESC);

-- General user timeline
CREATE INDEX IF NOT EXISTS idx_events_user_ts
  ON events (user_id, timestamp DESC);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_service_only ON events;
CREATE POLICY events_service_only ON events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ────────────────────────────────────────────────────────────
-- 5. AI_USAGE (governance + abuse detection)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES devices(device_id) ON DELETE CASCADE,
  prompt_length INT,
  timestamp TIMESTAMP DEFAULT now()
);

-- Anomaly engine: analyzeAIUsage (user timeline)
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_ts
  ON ai_usage (user_id, timestamp DESC);

-- Phase 22.3: device-level AI usage tracking
CREATE INDEX IF NOT EXISTS idx_ai_usage_device_ts
  ON ai_usage (device_id, timestamp DESC);

-- Phase 22.3: user + device composite for per-session abuse detection
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_device_ts
  ON ai_usage (user_id, device_id, timestamp DESC);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_service_only ON ai_usage;
CREATE POLICY ai_usage_service_only ON ai_usage
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ────────────────────────────────────────────────────────────
-- 6. ANOMALIES (Phase 22.3 intelligence layer)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES devices(device_id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  severity NUMERIC DEFAULT 0.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);

-- Anomaly scoring: user timeline
CREATE INDEX IF NOT EXISTS idx_anomalies_user_ts
  ON anomalies (user_id, created_at DESC);

-- Phase 22.3: dedup queries — type + device + user + time
CREATE INDEX IF NOT EXISTS idx_anomalies_dedup
  ON anomalies (user_id, device_id, anomaly_type, created_at DESC);

-- Phase 22.3: device-level anomaly tracking
CREATE INDEX IF NOT EXISTS idx_anomalies_device_ts
  ON anomalies (device_id, created_at DESC);

ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anomalies_service_only ON anomalies;
CREATE POLICY anomalies_service_only ON anomalies
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ────────────────────────────────────────────────────────────
-- 7. BACKFILL: add columns if tables already existed
-- ────────────────────────────────────────────────────────────

-- anomaly_score on users/devices (safe backfill)
ALTER TABLE users ADD COLUMN IF NOT EXISTS anomaly_score NUMERIC DEFAULT 0.0;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS anomaly_score NUMERIC DEFAULT 0.0;

-- Convert old TEXT metadata → JSONB (safe conditional)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events'
      AND column_name = 'metadata'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE events
      ALTER COLUMN metadata TYPE JSONB
      USING COALESCE(metadata::jsonb, '{}'::jsonb);
  END IF;
END $$;

-- Phase 22.3: ensure anomalies.metadata is JSONB (not TEXT)
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


-- ============================================================
-- VERIFICATION — run to confirm all 6 tables + columns exist
-- ============================================================
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'subscriptions', 'devices',
    'events', 'ai_usage', 'anomalies'
  )
ORDER BY table_name, ordinal_position;


-- ============================================================
-- Phase 23: DATA RETENTION POLICIES (D1-D3)
--
-- events     → 90 days (high-volume telemetry)
-- anomalies  → 180 days (audit trail)
-- ai_usage   → 90 days (usage analytics)
--
-- Manual deletion functions — call via pg_cron or scheduled job.
-- ============================================================

-- D1: Events retention (90 days)
CREATE OR REPLACE FUNCTION purge_old_events()
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM events WHERE timestamp < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D2: Anomalies retention (180 days)
CREATE OR REPLACE FUNCTION purge_old_anomalies()
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM anomalies WHERE created_at < NOW() - INTERVAL '180 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D3: AI usage retention (90 days)
CREATE OR REPLACE FUNCTION purge_old_ai_usage()
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM ai_usage WHERE timestamp < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: If pg_cron is available, schedule nightly purges
-- SELECT cron.schedule('purge-events', '0 3 * * *', 'SELECT purge_old_events()');
-- SELECT cron.schedule('purge-anomalies', '0 3 * * *', 'SELECT purge_old_anomalies()');
-- SELECT cron.schedule('purge-ai-usage', '0 3 * * *', 'SELECT purge_old_ai_usage()');


-- ────────────────────────────────────────────────────────────
-- 8. DEVICE TOKENS — Phase 26 (server-issued identity proof)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  device_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT now(),
  last_seen TIMESTAMP DEFAULT now(),
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  revoke_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_token
  ON device_tokens (device_token) WHERE revoked = false;

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_device
  ON device_tokens (user_id, device_id) WHERE revoked = false;

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active
  ON device_tokens (user_id) WHERE revoked = false;

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_tokens_service_only ON device_tokens;
CREATE POLICY device_tokens_service_only ON device_tokens
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ────────────────────────────────────────────────────────────
-- 9. TRUST ALERTS — Phase 27 (admin-reviewable trust alerts)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trust_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT,
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  trust_score_at_alert NUMERIC NOT NULL,
  anomaly_count INTEGER NOT NULL DEFAULT 0,
  anomaly_summary JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ESCALATED')),
  resolved BOOLEAN DEFAULT false,
  resolved_by TEXT,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trust_alerts_status
  ON trust_alerts (status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trust_alerts_user
  ON trust_alerts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trust_alerts_dedup
  ON trust_alerts (user_id, alert_type, status, created_at DESC);

ALTER TABLE trust_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trust_alerts_service_only ON trust_alerts;
CREATE POLICY trust_alerts_service_only ON trust_alerts
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Phase 27 backfill: add columns to existing trust_alerts table
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'MEDIUM';
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS anomaly_summary JSONB DEFAULT '{}';
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN';
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false;
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
