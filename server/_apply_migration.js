// Apply Phase 27 trust_alerts migration to REMOTE Supabase
// Uses direct PostgreSQL connection via session mode pooler
require('dotenv').config();
const { Pool } = require('pg');

// Supabase connection via session pooler (port 5432 for session mode)
// Format: postgresql://postgres.[project-ref]:[service-role-key]@db.[project-ref].supabase.co:5432/postgres
const PROJECT_REF = 'czfsoheldgxyzowymfay';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Try direct connection to Supabase DB host
const connectionString = `postgresql://postgres.${PROJECT_REF}:${SERVICE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const statements = [
  `ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'MEDIUM'`,
  `ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS anomaly_summary JSONB DEFAULT '{}'`,
  `ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`,
  `ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN'`,
  `ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolved_by TEXT`,
  `ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP`,
  `ALTER TABLE trust_alerts ADD COLUMN IF NOT EXISTS resolution_notes TEXT`,
  // Rename trust_score -> trust_score_at_alert
  `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trust_alerts' AND column_name='trust_score') THEN ALTER TABLE trust_alerts RENAME COLUMN trust_score TO trust_score_at_alert; END IF; END $$`,
  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_trust_alerts_status ON trust_alerts (status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_trust_alerts_user ON trust_alerts (user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_trust_alerts_dedup ON trust_alerts (user_id, alert_type, status, created_at DESC)`,
  // RLS
  `ALTER TABLE trust_alerts ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS trust_alerts_service_only ON trust_alerts`,
  `CREATE POLICY trust_alerts_service_only ON trust_alerts USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')`,
];

(async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to remote Supabase');
    
    for (const sql of statements) {
      try {
        await client.query(sql);
        console.log('OK:', sql.slice(0, 60) + '...');
      } catch (err) {
        console.log('SKIP:', err.message.slice(0, 80));
      }
    }
    
    // Verify final schema
    const { rows } = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='trust_alerts' ORDER BY ordinal_position`);
    console.log('\nFinal schema:');
    for (const r of rows) console.log(`  ${r.column_name}: ${r.data_type}`);
    
  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
})();
