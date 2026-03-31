-- Migration 004: Add unique partial index to prevent concurrent duplicate device token registration
-- This index ensures only ONE active (non-revoked) token exists per user+device pair.
-- It allows multiple revoked tokens for the same combination (no conflict on revoked rows).

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_active_unique
  ON device_tokens (user_id, device_id)
  WHERE revoked = false;
