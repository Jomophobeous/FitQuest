-- ============================================================
-- TRUST ALERTS: FINAL + MIGRATION-SAFE (IDEMPOTENT)
-- ============================================================

-- 1. Create base table if it doesn't exist (minimal safe shape)
CREATE TABLE IF NOT EXISTS trust_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT,
  alert_type TEXT NOT NULL,
  anomaly_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- 2. Add missing columns (safe for existing tables)
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS trust_score_at_alert NUMERIC;
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS anomaly_summary JSONB DEFAULT '{}';
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN';
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- 3. Backfill nulls (prevents constraint failure)
UPDATE trust_alerts SET
  severity = COALESCE(severity, 'LOW'),
  trust_score_at_alert = COALESCE(trust_score_at_alert, 1.0),
  status = COALESCE(status, 'OPEN');

-- 4. Enforce constraints
ALTER TABLE trust_alerts ALTER COLUMN severity SET NOT NULL;
ALTER TABLE trust_alerts ALTER COLUMN trust_score_at_alert SET NOT NULL;
ALTER TABLE trust_alerts ALTER COLUMN status SET NOT NULL;

ALTER TABLE trust_alerts DROP CONSTRAINT IF EXISTS trust_alerts_severity_check;
ALTER TABLE trust_alerts ADD CONSTRAINT trust_alerts_severity_check
  CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL'));

ALTER TABLE trust_alerts DROP CONSTRAINT IF EXISTS trust_alerts_status_check;
ALTER TABLE trust_alerts ADD CONSTRAINT trust_alerts_status_check
  CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED','ESCALATED'));

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_trust_alerts_status
  ON trust_alerts (status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trust_alerts_user
  ON trust_alerts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trust_alerts_dedup
  ON trust_alerts (user_id, alert_type, status, created_at DESC);

-- 6. RLS
ALTER TABLE trust_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trust_alerts_service_only ON trust_alerts;

CREATE POLICY trust_alerts_service_only ON trust_alerts
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
