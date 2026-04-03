// Apply Phase 27 trust_alerts migration
// Adds missing columns to existing table
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Use the Supabase SQL API (Management API) to ALTER the table
// Since we can't run DDL via supabase-js, we'll use the PostgREST RPC approach

(async () => {
  // The table has: id, user_id, device_id, trust_score, anomaly_count, alert_type, created_at, resolved
  // We need to add: severity, anomaly_summary, metadata, status, resolved_by, resolved_at, resolution_notes
  // And rename: trust_score -> trust_score_at_alert, resolved -> (keep but also add status)

  // Since we can't run ALTER TABLE via supabase-js, let's check if supabase CLI can do it against the remote
  // For now, output the SQL that needs to be run
  const sql = `
-- Phase 27: Upgrade trust_alerts table
-- Add missing columns
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS anomaly_summary JSONB DEFAULT '{}';
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ESCALATED'));
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- Rename trust_score to trust_score_at_alert if needed
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trust_alerts' AND column_name='trust_score') THEN
    ALTER TABLE trust_alerts RENAME COLUMN trust_score TO trust_score_at_alert;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_trust_alerts_status ON trust_alerts (status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_alerts_user ON trust_alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_alerts_dedup ON trust_alerts (user_id, alert_type, status, created_at DESC);
`;
  console.log('SQL to apply:');
  console.log(sql);
  process.exit(0);
})();
