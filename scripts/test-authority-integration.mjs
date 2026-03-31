#!/usr/bin/env node
/**
 * Phase 24A — Integration Test Harness
 *
 * Validates all critical authority server flows from a simulated client.
 * Runs against the LIVE production server (https://fitq-oxp9.onrender.com).
 *
 * Usage:
 *   node scripts/test-authority-integration.mjs
 *
 * Requires:
 *   AUTHORITY_API_KEY, DEVICE_SIGNING_SECRET in server/.env
 *   (reads from server/.env automatically)
 *
 * Tests:
 *   1. Health check (GET /health)
 *   2. User creation (POST /user/create)
 *   3. First-time device verification (valid HMAC)
 *   4. Repeat device verification (same device)
 *   5. Invalid signature → 403
 *   6. Missing API key → 403
 *   7. Missing required fields → 400
 *   8. Expired timestamp → 403
 */

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Load env from server/.env ──
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', 'server', '.env');
let env = {};
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
} catch (e) {
  console.error('Failed to read server/.env:', e.message);
  process.exit(1);
}

// ── Config ──
const BASE_URL = process.env.TEST_BASE_URL || 'https://fitq-56sj.onrender.com';
const API_KEY = env.API_KEY;
const SIGNING_SECRET = env.DEVICE_SIGNING_SECRET;

if (!API_KEY) { console.error('Missing API_KEY in server/.env'); process.exit(1); }
if (!SIGNING_SECRET) { console.error('Missing DEVICE_SIGNING_SECRET in server/.env'); process.exit(1); }

const TEST_USER_ID = 'test_phase24a_' + Date.now().toString(36);
const TEST_DEVICE_ID = 'device_test_' + Date.now().toString(36);
const TEST_APP_VERSION = '1.0.0';
const TEST_EMAIL = `${TEST_USER_ID}@test.fitquest.local`;

// ── Helpers ──

function generateHMAC(userId, deviceId, appVersion, timestamp) {
  const payload = timestamp
    ? `${userId}|${deviceId}|${appVersion}|${timestamp}`
    : `${userId}|${deviceId}|${appVersion}`;
  return createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
}

async function request(method, path, body, { apiKey = API_KEY, headers: extraHeaders = {} } = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-App-Version': TEST_APP_VERSION,
    ...extraHeaders,
  };

  if (body && apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const latency = Date.now() - start;
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON */ }

    return { status: res.status, json, latency, ok: res.ok };
  } catch (e) {
    return { status: 0, json: null, latency: Date.now() - start, ok: false, error: e.message };
  }
}

// ── Test framework ──

const results = [];
let testNum = 0;

async function test(name, fn) {
  testNum++;
  const label = `[${testNum}] ${name}`;
  try {
    const result = await fn();
    if (result.pass) {
      results.push({ num: testNum, name, status: 'PASS', latency: result.latency, details: result.details });
      console.log(`  ✅ ${label} (${result.latency}ms)`);
      if (result.details) console.log(`     ${result.details}`);
    } else {
      results.push({ num: testNum, name, status: 'FAIL', latency: result.latency, details: result.details });
      console.log(`  ❌ ${label} (${result.latency}ms)`);
      console.log(`     ${result.details}`);
    }
  } catch (e) {
    results.push({ num: testNum, name, status: 'ERROR', latency: 0, details: e.message });
    console.log(`  💥 ${label}: ${e.message}`);
  }
}

// ── Tests ──

console.log('\n═══════════════════════════════════════════════');
console.log(' Phase 24A — Authority Server Integration Tests');
console.log(`  Target: ${BASE_URL}`);
console.log(`  Test User: ${TEST_USER_ID}`);
console.log(`  Test Device: ${TEST_DEVICE_ID}`);
console.log('═══════════════════════════════════════════════\n');

// 1. Health check
await test('GET /health — server reachable', async () => {
  const r = await request('GET', '/health');
  const status = r.json?.data?.status;
  return {
    pass: r.status === 200 && (status === 'ok' || status === 'operational'),
    latency: r.latency,
    details: r.json ? `version=${r.json.data?.version}, status=${status}` : `HTTP ${r.status}`,
  };
});

// 2. User creation
let userCreated = false;
await test('POST /user/create — register test user', async () => {
  const r = await request('POST', '/user/create', { id: TEST_USER_ID, email: TEST_EMAIL });
  userCreated = (r.status === 200 || r.status === 201) && r.json?.success;
  return {
    pass: userCreated,
    latency: r.latency,
    details: `status=${r.status}, body=${JSON.stringify(r.json)}` +
      (r.status === 500 ? ' [SERVER-SIDE BLOCKER: Supabase users table may be missing or RLS blocks insert]' : ''),
  };
});

if (!userCreated) {
  console.log('\n  ⚠️  USER CREATION FAILED — skipping device/subscription tests that require a valid user.');
  console.log('     This is a SERVER-SIDE issue (Supabase table/RLS). Client contract is correct.\n');
}

// 3. First-time device verification (valid HMAC + timestamp)
if (userCreated) {
await test('POST /verify/device — first-time registration (valid HMAC)', async () => {
  const ts = Date.now();
  const sig = generateHMAC(TEST_USER_ID, TEST_DEVICE_ID, TEST_APP_VERSION, ts);
  const r = await request('POST', '/verify/device', {
    user_id: TEST_USER_ID,
    device_id: TEST_DEVICE_ID,
    app_version: TEST_APP_VERSION,
    signature: sig,
    timestamp: ts,
  });
  return {
    pass: r.status === 200 && r.json?.success && r.json?.data?.untrusted === false,
    latency: r.latency,
    details: `status=${r.status}, untrusted=${r.json?.data?.untrusted}, body=${JSON.stringify(r.json)}`,
  };
});

// 4. Repeat verification (same device) — should succeed, trust maintained
await test('POST /verify/device — repeat verification (same device)', async () => {
  const ts = Date.now();
  const sig = generateHMAC(TEST_USER_ID, TEST_DEVICE_ID, TEST_APP_VERSION, ts);
  const r = await request('POST', '/verify/device', {
    user_id: TEST_USER_ID,
    device_id: TEST_DEVICE_ID,
    app_version: TEST_APP_VERSION,
    signature: sig,
    timestamp: ts,
  });
  return {
    pass: r.status === 200 && r.json?.success && r.json?.data?.untrusted === false,
    latency: r.latency,
    details: `status=${r.status}, untrusted=${r.json?.data?.untrusted}`,
  };
});

// 5. New device for same user — may trigger anomaly (test observation)
const SECOND_DEVICE_ID = 'device_test_anomaly_' + Date.now().toString(36);
await test('POST /verify/device — new device for same user (anomaly observation)', async () => {
  const ts = Date.now();
  const sig = generateHMAC(TEST_USER_ID, SECOND_DEVICE_ID, TEST_APP_VERSION, ts);
  const r = await request('POST', '/verify/device', {
    user_id: TEST_USER_ID,
    device_id: SECOND_DEVICE_ID,
    app_version: TEST_APP_VERSION,
    signature: sig,
    timestamp: ts,
  });
  // This should still succeed (200) but may have untrusted=true if anomaly triggers
  return {
    pass: r.status === 200 && r.json?.success,
    latency: r.latency,
    details: `status=${r.status}, untrusted=${r.json?.data?.untrusted} (anomaly observation — untrusted may be true)`,
  };
});
} // end if (userCreated) — tests 3-5 require a valid user

// 6. Invalid signature → should get 403
await test('POST /verify/device — invalid signature → 403', async () => {
  const ts = Date.now();
  const r = await request('POST', '/verify/device', {
    user_id: TEST_USER_ID,
    device_id: TEST_DEVICE_ID,
    app_version: TEST_APP_VERSION,
    signature: 'deadbeef0000000000000000000000000000000000000000000000000000000f',
    timestamp: ts,
  });
  return {
    pass: r.status === 403,
    latency: r.latency,
    details: `status=${r.status}, error=${r.json?.error}`,
  };
});

// 7. Missing API key → should get 401 (server returns 401 for missing auth, not 403)
await test('POST /verify/device — missing API key → 401', async () => {
  const ts = Date.now();
  const sig = generateHMAC(TEST_USER_ID, TEST_DEVICE_ID, TEST_APP_VERSION, ts);
  const r = await request('POST', '/verify/device', {
    user_id: TEST_USER_ID,
    device_id: TEST_DEVICE_ID,
    app_version: TEST_APP_VERSION,
    signature: sig,
    timestamp: ts,
  }, { apiKey: null });
  return {
    pass: r.status === 401,
    latency: r.latency,
    details: `status=${r.status}, error=${r.json?.error}`,
  };
});

// 8. Missing required fields → should get 400
await test('POST /verify/device — missing user_id → 400', async () => {
  const ts = Date.now();
  const r = await request('POST', '/verify/device', {
    device_id: TEST_DEVICE_ID,
    app_version: TEST_APP_VERSION,
    signature: 'anything',
    timestamp: ts,
  });
  return {
    pass: r.status === 400,
    latency: r.latency,
    details: `status=${r.status}, error=${r.json?.error}`,
  };
});

// 9. Expired timestamp → should get 403
await test('POST /verify/device — expired timestamp (10 min old) → 403', async () => {
  const ts = Date.now() - (10 * 60 * 1000); // 10 minutes ago
  const sig = generateHMAC(TEST_USER_ID, TEST_DEVICE_ID, TEST_APP_VERSION, ts);
  const r = await request('POST', '/verify/device', {
    user_id: TEST_USER_ID,
    device_id: TEST_DEVICE_ID,
    app_version: TEST_APP_VERSION,
    signature: sig,
    timestamp: ts,
  });
  return {
    pass: r.status === 403,
    latency: r.latency,
    details: `status=${r.status}, error=${r.json?.error}`,
  };
});

// 10. Subscription verify (user exists but has no subscription record)
if (userCreated) {
await test('POST /verify/subscription — no subscription record', async () => {
  const r = await request('POST', '/verify/subscription', {
    user_id: TEST_USER_ID,
    device_id: TEST_DEVICE_ID,
  });
  // Should return 200 with inactive status (no subscription record)
  return {
    pass: r.status === 200,
    latency: r.latency,
    details: `status=${r.status}, data=${JSON.stringify(r.json?.data)}`,
  };
});

// 11. Legacy mode — no timestamp (backward compat, will be removed Phase 25)
await test('POST /verify/device — legacy mode (no timestamp)', async () => {
  const sig = generateHMAC(TEST_USER_ID, TEST_DEVICE_ID, TEST_APP_VERSION, null);
  const r = await request('POST', '/verify/device', {
    user_id: TEST_USER_ID,
    device_id: TEST_DEVICE_ID,
    app_version: TEST_APP_VERSION,
    signature: sig,
  });
  return {
    pass: r.status === 200 && r.json?.success,
    latency: r.latency,
    details: `status=${r.status}, untrusted=${r.json?.data?.untrusted}`,
  };
});
} // end if (userCreated) — tests 10-11 require a valid user

// ── Report ──

console.log('\n═══════════════════════════════════════════════');
console.log(' VALIDATION REPORT');
console.log('═══════════════════════════════════════════════\n');

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const errors = results.filter(r => r.status === 'ERROR').length;
const total = results.length;

console.log(`  Total: ${total}  |  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}  |  💥 Errors: ${errors}`);

const latencies = results.filter(r => r.latency > 0).map(r => r.latency);
if (latencies.length > 0) {
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const max = Math.max(...latencies);
  const min = Math.min(...latencies);
  console.log(`  Latency: min=${min}ms  avg=${avg}ms  max=${max}ms`);
  if (max > 5000) console.log('  ⚠️  WARNING: Max latency exceeds 5s — may indicate cold start');
}

if (failed > 0 || errors > 0) {
  console.log('\n  FAILURES:');
  for (const r of results.filter(r => r.status !== 'PASS')) {
    console.log(`    [${r.num}] ${r.name}: ${r.details}`);
  }
}

// Check for false-positive anomaly triggers
const anomalyTest = results.find(r => r.name.includes('anomaly'));
if (anomalyTest?.details?.includes('untrusted=true')) {
  console.log('\n  ⚠️  ANOMALY OBSERVATION: New device triggered untrusted=true.');
  console.log('     This is expected behavior for multi-device detection.');
  console.log('     Review thresholds in Phase 24B if this is a false positive.');
}

console.log('\n═══════════════════════════════════════════════\n');

process.exit(failed + errors > 0 ? 1 : 0);
