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
