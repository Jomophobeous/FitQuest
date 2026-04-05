-- ============================================================
-- FitQuest — Token Lifecycle Migration (Step 3)
-- Adds: refresh_tokens table, password_hash + name + last_login to users
-- Run in Supabase SQL Editor. All statements are idempotent.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- USERS TABLE — add auth columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- ────────────────────────────────────────────────────────────
-- REFRESH TOKENS — family-based rotation with reuse detection
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed BOOLEAN DEFAULT false,
  consumed_at TIMESTAMP,
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  revoke_reason TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
  ON refresh_tokens (token_hash) WHERE revoked = false;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family
  ON refresh_tokens (family_id) WHERE revoked = false;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON refresh_tokens (user_id) WHERE revoked = false;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_cleanup
  ON refresh_tokens (expires_at) WHERE revoked = false AND consumed = false;

-- RLS: service_role only
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refresh_tokens_service_only ON refresh_tokens;
CREATE POLICY refresh_tokens_service_only ON refresh_tokens
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Cleanup function: remove expired/revoked tokens older than 7 days
-- Can be called via pg_cron or manually
CREATE OR REPLACE FUNCTION cleanup_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM refresh_tokens
  WHERE (revoked = true AND revoked_at < now() - interval '7 days')
     OR (expires_at < now() - interval '7 days');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
