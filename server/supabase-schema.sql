-- ============================================================
-- FitQuest Backend — Complete Supabase Database Layer
-- Phases 20–22.2: Users, Subscriptions, Devices, Events,
--                 AI Usage, Anomalies, Trust + Intelligence
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

-- Anomaly engine: IP anomaly detection
CREATE INDEX IF NOT EXISTS idx_events_user_ip_ts
  ON events (user_id, ip, timestamp DESC);

-- Anomaly engine: device switching detection
CREATE INDEX IF NOT EXISTS idx_events_user_device_ts
  ON events (user_id, device_id, timestamp DESC);

-- Anomaly engine: countFailedVerifications, countVersionDowngrades
CREATE INDEX IF NOT EXISTS idx_events_user_type_ts
  ON events (user_id, event_type, timestamp DESC);

-- Anomaly engine: countDistinctDevices, countDistinctIPs
CREATE INDEX IF NOT EXISTS idx_events_user_ts
  ON events (user_id, timestamp DESC);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;


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

-- Anomaly engine: analyzeAIUsage
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_ts
  ON ai_usage (user_id, timestamp DESC);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────
-- 6. ANOMALIES (Phase 22.2 intelligence layer)
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

CREATE INDEX IF NOT EXISTS idx_anomalies_user_ts
  ON anomalies (user_id, created_at DESC);

ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────
-- 7. BACKFILL: add columns if tables already existed
-- ────────────────────────────────────────────────────────────

-- anomaly_score on users/devices
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
