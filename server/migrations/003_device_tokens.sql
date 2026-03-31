-- ============================================================
-- Phase 26 — Device Binding & Persistent Trust
-- Migration 003: device_tokens table
--
-- Binds user_id + device_id to a server-issued CSPRNG token.
-- No token → no access to protected endpoints.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- DEVICE TOKENS (server-issued identity proof)
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

-- Fast lookup by token (primary auth path)
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_token
  ON device_tokens (device_token) WHERE revoked = false;

-- Lookup by user + device (registration check, multi-device queries)
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_device
  ON device_tokens (user_id, device_id) WHERE revoked = false;

-- Count active devices per user (multi-device limit enforcement)
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active
  ON device_tokens (user_id) WHERE revoked = false;

-- RLS: service_role only
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_tokens_service_only ON device_tokens;
CREATE POLICY device_tokens_service_only ON device_tokens
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
