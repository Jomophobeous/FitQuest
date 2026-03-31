/**
 * Phase 26 — Device Binding & Persistent Trust — Integration Test
 *
 * Tests the full device token lifecycle:
 *   A. Device Registration (valid, idempotent, multi-device)
 *   B. Token Validation (valid, missing, wrong, revoked, mismatch)
 *   C. Token Rotation (valid rotation, invalid challenge)
 *   D. Device Revocation (self, target)
 *   E. Backward Compatibility (tokenless sync → rejected)
 *   F. Multi-Device Limit (6th device auto-revokes oldest)
 *   G. Cross-Device Token Reuse (token from device A used on device B → rejected)
 *
 * Run: node server/test-phase26-device-binding.js
 * Requires: AUTHORITY_SERVER running with device_tokens table created
 */

'use strict';

const crypto = require('crypto');
const path = require('path');

// Load root .env for API key
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BASE = process.env.TEST_BASE_URL || 'https://fitq-56sj.onrender.com';
const API_KEY = process.env.API_KEY || process.env.EXPO_PUBLIC_AUTHORITY_API_KEY || '';
const USER_ID = 'user_local_001';
const APP_VERSION = '2.0.0';

let pass = 0;
let fail = 0;

function assert(label, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}: ${detail || 'FAILED'}`);
  }
}

async function post(urlPath, body) {
  const headers = { 'Content-Type': 'application/json', 'X-App-Version': APP_VERSION };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;
  const res = await fetch(`${BASE}${urlPath}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function computeResponse(nonce, deviceId, appVersion) {
  return crypto.createHash('sha256').update(`${nonce}${deviceId}${appVersion}`).digest('hex');
}

/**
 * Acquire a challenge from the server.
 */
async function getChallenge(deviceId) {
  const { status, json } = await post('/auth/challenge', {
    user_id: USER_ID,
    device_id: deviceId,
  });
  if (status !== 200 || !json.data?.challenge_id) {
    throw new Error(`Challenge failed: status=${status}`);
  }
  return { challenge_id: json.data.challenge_id, nonce: json.data.nonce };
}

/**
 * Register a device and return the device_token.
 */
async function registerDevice(deviceId) {
  const { challenge_id, nonce } = await getChallenge(deviceId);
  const challenge_response = computeResponse(nonce, deviceId, APP_VERSION);

  const { status, json } = await post('/device/register', {
    user_id: USER_ID,
    device_id: deviceId,
    app_version: APP_VERSION,
    challenge_id,
    challenge_response,
  });

  if (status !== 200 || !json.data?.device_token) {
    throw new Error(`Register failed: status=${status}, error=${json.error}`);
  }

  return json.data.device_token;
}

/**
 * Submit a sync batch with a device token.
 */
async function syncWithToken(deviceId, deviceToken) {
  const { challenge_id, nonce } = await getChallenge(deviceId);
  const challenge_response = computeResponse(nonce, deviceId, APP_VERSION);

  return post('/sync/batch', {
    user_id: USER_ID,
    device_id: deviceId,
    device_token: deviceToken,
    app_version: APP_VERSION,
    challenge_id,
    challenge_response,
    actions: [
      {
        action_id: `test-wk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'workout_complete',
        payload: { completed_exercises: 3, total_exercises: 4, duration_minutes: 20, streak_days: 1 },
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════
//  TESTS
// ════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n🔐 Phase 26 — Device Binding & Persistent Trust`);
  console.log(`   Target: ${BASE}\n`);

  // ── 0. Health Check ──
  console.log('0. Preflight');
  try {
    const res = await fetch(`${BASE}/health`);
    const json = await res.json();
    assert('Server reachable', res.status === 200);
    assert('Version 4.0.0+', json.data?.version >= '4.0.0', `got ${json.data?.version}`);
    assert('Phase 26', json.data?.phase >= 26, `got phase=${json.data?.phase}`);
  } catch (e) {
    assert('Server reachable', false, e.message);
    console.log('\n⛔ Server unreachable. Aborting.\n');
    process.exit(1);
  }

  // Ensure user exists
  await post('/user/create', { id: USER_ID, device_id: 'test-dev-p26', app_version: APP_VERSION });

  // ════════════════════════════════════════════════════
  // A. Device Registration
  // ════════════════════════════════════════════════════
  console.log('\nA. Device Registration');

  const DEV_A = `test-p26-devA-${Date.now()}`;

  // A1. Valid registration
  let tokenA;
  try {
    tokenA = await registerDevice(DEV_A);
    assert('A1. Valid registration returns token', typeof tokenA === 'string' && tokenA.length === 64);
  } catch (e) {
    assert('A1. Valid registration returns token', false, e.message);
    console.log('\n⛔ Device registration failed. Cannot continue.\n');
    process.exit(1);
  }

  // A2. Idempotent — same device returns existing token
  let tokenA2;
  try {
    tokenA2 = await registerDevice(DEV_A);
    assert('A2. Idempotent — returns same token', tokenA2 === tokenA);
  } catch (e) {
    assert('A2. Idempotent — returns same token', false, e.message);
  }

  // A3. Missing fields → 400
  {
    const { status: s1 } = await post('/device/register', { user_id: USER_ID });
    assert('A3. Missing device_id → 400', s1 === 400, `status=${s1}`);

    const { status: s2 } = await post('/device/register', { device_id: 'x' });
    assert('A4. Missing user_id → 400', s2 === 400, `status=${s2}`);
  }

  // A5. Bad challenge → 403
  {
    const { status } = await post('/device/register', {
      user_id: USER_ID,
      device_id: DEV_A,
      app_version: APP_VERSION,
      challenge_id: 'fake-challenge-id',
      challenge_response: 'deadbeef',
    });
    assert('A5. Bad challenge → 403', status === 403, `status=${status}`);
  }

  // A6. Wrong challenge_response → 403
  {
    const { challenge_id } = await getChallenge(DEV_A);
    const { status } = await post('/device/register', {
      user_id: USER_ID,
      device_id: DEV_A,
      app_version: APP_VERSION,
      challenge_id,
      challenge_response: crypto.randomBytes(32).toString('hex'),
    });
    assert('A6. Wrong response hash → 403', status === 403, `status=${status}`);
  }

  // ════════════════════════════════════════════════════
  // B. Token Validation (Sync Endpoint)
  // ════════════════════════════════════════════════════
  console.log('\nB. Token Validation on /sync/batch');

  // B1. Valid token → sync succeeds
  {
    const { status, json } = await syncWithToken(DEV_A, tokenA);
    assert('B1. Valid token → 200', status === 200, `status=${status}`);
    assert('B2. Results returned', Array.isArray(json.data?.results), JSON.stringify(json.data));
  }

  // B3. Missing token → 401
  {
    const { challenge_id, nonce } = await getChallenge(DEV_A);
    const cr = computeResponse(nonce, DEV_A, APP_VERSION);
    const { status } = await post('/sync/batch', {
      user_id: USER_ID,
      device_id: DEV_A,
      app_version: APP_VERSION,
      challenge_id,
      challenge_response: cr,
      actions: [{ action_id: 'test-no-token', type: 'workout_complete', payload: { completed_exercises: 1, total_exercises: 1, duration_minutes: 5, streak_days: 0 } }],
    });
    assert('B3. Missing device_token → 401', status === 401, `status=${status}`);
  }

  // B4. Wrong token → 401 (unknown)
  {
    const { challenge_id, nonce } = await getChallenge(DEV_A);
    const cr = computeResponse(nonce, DEV_A, APP_VERSION);
    const { status } = await post('/sync/batch', {
      user_id: USER_ID,
      device_id: DEV_A,
      device_token: crypto.randomBytes(32).toString('hex'),
      app_version: APP_VERSION,
      challenge_id,
      challenge_response: cr,
      actions: [{ action_id: 'test-bad-token', type: 'step_log', payload: { steps: 100, date: '2025-01-01' } }],
    });
    assert('B4. Random token → 401', status === 401, `status=${status}`);
  }

  // ════════════════════════════════════════════════════
  // C. Token Rotation
  // ════════════════════════════════════════════════════
  console.log('\nC. Token Rotation');

  const DEV_C = `test-p26-devC-${Date.now()}`;
  let tokenC;
  try {
    tokenC = await registerDevice(DEV_C);
    assert('C0. Device C registered', !!tokenC);
  } catch (e) {
    assert('C0. Device C registered', false, e.message);
  }

  // C1. Valid rotation
  let newTokenC;
  if (tokenC) {
    const { challenge_id, nonce } = await getChallenge(DEV_C);
    const cr = computeResponse(nonce, DEV_C, APP_VERSION);
    const { status, json } = await post('/device/rotate', {
      user_id: USER_ID,
      device_id: DEV_C,
      device_token: tokenC,
      app_version: APP_VERSION,
      challenge_id,
      challenge_response: cr,
    });
    newTokenC = json.data?.device_token;
    assert('C1. Rotation returns 200', status === 200, `status=${status}`);
    assert('C2. New token issued', typeof newTokenC === 'string' && newTokenC.length === 64, `got ${newTokenC}`);
    assert('C3. New token differs from old', newTokenC !== tokenC);
  }

  // C4. Old token → rejected (should be revoked)
  if (tokenC && newTokenC) {
    const { status } = await syncWithToken(DEV_C, tokenC);
    assert('C4. Old token rejected after rotation', status === 401 || status === 403, `status=${status}`);
  }

  // C5. New token → works
  if (newTokenC) {
    const { status } = await syncWithToken(DEV_C, newTokenC);
    assert('C5. New token works after rotation', status === 200, `status=${status}`);
  }

  // C6. Rotation with bad challenge → 403
  if (newTokenC) {
    const { status } = await post('/device/rotate', {
      user_id: USER_ID,
      device_id: DEV_C,
      device_token: newTokenC,
      app_version: APP_VERSION,
      challenge_id: 'fake',
      challenge_response: 'fake',
    });
    assert('C6. Rotation with bad challenge → 403', status === 403, `status=${status}`);
  }

  // ════════════════════════════════════════════════════
  // D. Device Revocation
  // ════════════════════════════════════════════════════
  console.log('\nD. Device Revocation');

  const DEV_D1 = `test-p26-devD1-${Date.now()}`;
  const DEV_D2 = `test-p26-devD2-${Date.now()}`;
  let tokenD1, tokenD2;

  try {
    tokenD1 = await registerDevice(DEV_D1);
    tokenD2 = await registerDevice(DEV_D2);
    assert('D0. Two devices registered', !!tokenD1 && !!tokenD2);
  } catch (e) {
    assert('D0. Two devices registered', false, e.message);
  }

  // D1. Self-revoke
  if (tokenD1) {
    const { status, json } = await post('/device/revoke', {
      user_id: USER_ID,
      device_id: DEV_D1,
      device_token: tokenD1,
      reason: 'test_self_revoke',
    });
    assert('D1. Self-revoke → 200', status === 200, `status=${status}`);
    assert('D2. Revoked count = 1', json.data?.revoked_count === 1, `count=${json.data?.revoked_count}`);
  }

  // D3. Revoked token can't sync
  if (tokenD1) {
    const { status } = await syncWithToken(DEV_D1, tokenD1);
    assert('D3. Revoked token → 401/403', status === 401 || status === 403, `status=${status}`);
  }

  // D4. Remote revoke (D2 revoking itself — caller must have valid token)
  if (tokenD2) {
    const { status, json } = await post('/device/revoke', {
      user_id: USER_ID,
      device_id: DEV_D2,
      device_token: tokenD2,
      reason: 'test_remote_revoke',
    });
    assert('D4. Remote revoke → 200', status === 200, `status=${status}`);
    assert('D5. Revoked count = 1', json.data?.revoked_count === 1, `count=${json.data?.revoked_count}`);
  }

  // D6. Revoke without valid token → 401
  {
    const { status } = await post('/device/revoke', {
      user_id: USER_ID,
      device_id: 'fake-device',
      device_token: crypto.randomBytes(32).toString('hex'),
      reason: 'attempted_spoof',
    });
    assert('D6. Revoke with unknown token → 401', status === 401, `status=${status}`);
  }

  // ════════════════════════════════════════════════════
  // E. Backward Compatibility (tokenless → rejected)
  // ════════════════════════════════════════════════════
  console.log('\nE. Backward Compatibility — Tokenless Rejection');

  // E1. Sync without device_token → 401
  {
    const { challenge_id, nonce } = await getChallenge('test-dev-legacy');
    const cr = computeResponse(nonce, 'test-dev-legacy', APP_VERSION);
    const { status } = await post('/sync/batch', {
      user_id: USER_ID,
      device_id: 'test-dev-legacy',
      app_version: APP_VERSION,
      challenge_id,
      challenge_response: cr,
      actions: [{ action_id: 'legacy-001', type: 'step_log', payload: { steps: 100, date: '2025-01-01' } }],
    });
    assert('E1. Tokenless sync → 401', status === 401, `status=${status}`);
  }

  // ════════════════════════════════════════════════════
  // F. Multi-Device Limit
  // ════════════════════════════════════════════════════
  console.log('\nF. Multi-Device Limit (max 5)');

  const multiUser = USER_ID; // Same user
  const multiTokens = [];
  const multiDevices = [];

  // Register 6 unique devices
  for (let i = 1; i <= 6; i++) {
    const devId = `test-p26-multi-${Date.now()}-${i}`;
    multiDevices.push(devId);
    try {
      const token = await registerDevice(devId);
      multiTokens.push(token);
    } catch (e) {
      multiTokens.push(null);
    }
  }

  assert('F1. All 6 registrations succeeded', multiTokens.every(t => t !== null));

  // F2. 6th device active → oldest (1st) should be auto-revoked
  // Test: try syncing with 1st device's token
  if (multiTokens[0]) {
    const { status } = await syncWithToken(multiDevices[0], multiTokens[0]);
    assert('F2. 1st device token auto-revoked', status === 401 || status === 403, `status=${status}`);
  }

  // F3. 6th device's token should work
  if (multiTokens[5]) {
    const { status } = await syncWithToken(multiDevices[5], multiTokens[5]);
    assert('F3. 6th device token works', status === 200, `status=${status}`);
  }

  // ════════════════════════════════════════════════════
  // G. Cross-Device Token Reuse
  // ════════════════════════════════════════════════════
  console.log('\nG. Cross-Device Token Reuse Prevention');

  // Use tokenA (bound to DEV_A) but claim to be a different device
  const DEV_G = `test-p26-devG-${Date.now()}`;
  {
    const { challenge_id, nonce } = await getChallenge(DEV_G);
    const cr = computeResponse(nonce, DEV_G, APP_VERSION);
    const { status } = await post('/sync/batch', {
      user_id: USER_ID,
      device_id: DEV_G,
      device_token: tokenA, // Token bound to DEV_A, not DEV_G
      app_version: APP_VERSION,
      challenge_id,
      challenge_response: cr,
      actions: [{ action_id: 'cross-dev-001', type: 'step_log', payload: { steps: 50, date: '2025-01-01' } }],
    });
    assert('G1. Cross-device token reuse → 403', status === 403, `status=${status}`);
  }

  // ════════════════════════════════════════════════════
  //  SUMMARY
  // ════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  RESULTS: ${pass} passed, ${fail} failed, ${pass + fail} total`);
  console.log(`${'═'.repeat(50)}\n`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
