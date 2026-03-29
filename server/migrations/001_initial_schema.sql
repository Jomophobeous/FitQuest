-- FitQuest Backend Authority — Schema v1
-- Matches actual Supabase tables created by user.
-- Tables use TEXT for user_id to match FitQuest's string-based IDs (e.g. 'user_local_001')

-- DROP OLD TABLES
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ── Users ──
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  trust_score NUMERIC DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT now()
);

-- ── Subscriptions ──
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) NOT NULL,
  status TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- ── Devices ──
CREATE TABLE devices (
  device_id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) NOT NULL,
  app_version TEXT,
  last_seen TIMESTAMP DEFAULT now(),
  trust_score NUMERIC DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT now()
);

-- ── Row Level Security (service_role bypasses RLS) ──
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
