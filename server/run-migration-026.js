/**
 * Run Phase 26 migration: create device_tokens table in Supabase.
 * Execute: cd server && node run-migration-026.js
 */
'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function run() {
  console.log('Running Phase 26 migration: device_tokens table...');

  // Create table via RPC (Supabase JS SDK doesn't support raw DDL directly)
  // We'll use the REST SQL endpoint or just verify the table works via insert/select

  // Approach: Try to select from device_tokens. If it doesn't exist, log instruction.
  const { data, error } = await supabase
    .from('device_tokens')
    .select('id')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    console.log('\n⚠️  Table device_tokens does not exist yet.');
    console.log('   Run the following SQL in Supabase SQL Editor:\n');
    console.log(`
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
`);
    process.exit(1);
  } else if (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  } else {
    console.log('✅ device_tokens table exists and is accessible.');
    console.log(`   Rows found: ${data.length}`);
    process.exit(0);
  }
}

run();
