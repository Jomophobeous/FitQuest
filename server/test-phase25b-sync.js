/**
 * Phase 25B — Sync Batch Integration Test
 *
 * Tests the full offline→sync→authority flow:
 *   1. Health check
 *   2. Create user (if needed)
 *   3. Acquire challenge
 *   4. Submit batch sync with valid response
 *   5. Verify per-action results
 *   6. Replay protection (reuse challenge)
 *   7. Invalid action rejection
 *
 * Run: node server/test-phase25b-sync.js
 * Requires: AUTHORITY_SERVER running (local or Render)
 */

'use strict';

const crypto = require('crypto');
const path = require('path');

// Load root .env for EXPO_PUBLIC_AUTHORITY_API_KEY
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BASE = process.env.TEST_BASE_URL || 'https://fitq-56sj.onrender.com';
const API_KEY = process.env.API_KEY || process.env.EXPO_PUBLIC_AUTHORITY_API_KEY || '';
const USER_ID = 'user_local_001';
const DEVICE_ID = 'test-device-phase25b';
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

async function post(path, body) {
  const headers = { 'Content-Type': 'application/json', 'X-App-Version': APP_VERSION };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

function computeResponse(nonce, deviceId, appVersion) {
  return crypto.createHash('sha256').update(`${nonce}${deviceId}${appVersion}`).digest('hex');
}

/**
 * Register device and return device_token (Phase 26 requirement).
 */
async function registerDevice(deviceId) {
  const chRes = await post('/auth/challenge', { user_id: USER_ID, device_id: deviceId });
  if (chRes.status !== 200 || !chRes.json.data?.challenge_id) {
    throw new Error(`Device register challenge failed: ${chRes.status}`);
  }
  const response = computeResponse(chRes.json.data.nonce, deviceId, APP_VERSION);
  const regRes = await post('/device/register', {
    user_id: USER_ID, device_id: deviceId, app_version: APP_VERSION,
    challenge_id: chRes.json.data.challenge_id, challenge_response: response,
  });
  if (regRes.status !== 200 || !regRes.json.data?.device_token) {
    throw new Error(`Device register failed: ${regRes.status}, ${regRes.json.error}`);
  }
  return regRes.json.data.device_token;
}

async function main() {
  console.log(`\n🔄 Phase 25B Sync Integration Test`);
  console.log(`   Target: ${BASE}\n`);

  // ── 1. Health Check ──
  console.log('1. Health Check');
  try {
    const res = await fetch(`${BASE}/health`);
    const json = await res.json();
    assert('Health endpoint reachable', res.status === 200);
    assert('Version is 3.0.0+', json.data?.version >= '3.0.0', json.data?.version);
  } catch (e) {
    assert('Health endpoint reachable', false, e.message);
    console.log('\n⛔ Server unreachable. Aborting.\n');
    process.exit(1);
  }

  // ── 2. Ensure User Exists ──
  console.log('\n2. Ensure User Exists');
  const { status: userStatus } = await post('/user/create', {
    id: USER_ID,
    device_id: DEVICE_ID,
    app_version: APP_VERSION,
  });
  assert('User created or exists', userStatus === 201 || userStatus === 200 || userStatus === 409 || userStatus === 400,
    `status=${userStatus}`);

  // ── 2b. Register Device (Phase 26: device_token required) ──
  console.log('\n2b. Register Device Token');
  let deviceToken;
  try {
    deviceToken = await registerDevice(DEVICE_ID);
    assert('Device token acquired', typeof deviceToken === 'string' && deviceToken.length === 64);
  } catch (e) {
    assert('Device token acquired', false, e.message);
    console.log('\n⛔ Device registration failed. Cannot continue.\n');
    process.exit(1);
  }

  // ── 3. Acquire Challenge ──
  console.log('\n3. Acquire Challenge');
  const { status: chStatus, json: chJson } = await post('/auth/challenge', {
    user_id: USER_ID,
    device_id: DEVICE_ID,
  });
  assert('Challenge issued', chStatus === 200 && chJson.data?.challenge_id, `status=${chStatus}`);

  const challengeId = chJson.data?.challenge_id;
  const nonce = chJson.data?.nonce;

  if (!challengeId || !nonce) {
    console.log('\n⛔ Challenge acquisition failed. Cannot continue.\n');
    process.exit(1);
  }

  // ── 4. Submit Batch Sync ──
  console.log('\n4. Submit Batch Sync');
  const response = computeResponse(nonce, DEVICE_ID, APP_VERSION);

  const actions = [
    {
      action_id: 'test-workout-001',
      type: 'workout_complete',
      payload: {
        completed_exercises: 5,
        total_exercises: 6,
        duration_minutes: 35,
        streak_days: 3,
      },
    },
    {
      action_id: 'test-steps-001',
      type: 'step_log',
      payload: { steps: 8500, date: new Date().toISOString().split('T')[0] },
    },
    {
      action_id: 'test-jog-001',
      type: 'jog_log',
      payload: { distance_meters: 2500, duration_minutes: 15 },
    },
    {
      action_id: 'test-photo-001',
      type: 'progress_photo',
      payload: { timestamp: Date.now() },
    },
    {
      action_id: 'test-streak-001',
      type: 'streak_update',
      payload: { current_streak: 3, last_workout_date: new Date().toISOString().split('T')[0] },
    },
  ];

  const { status: syncStatus, json: syncJson } = await post('/sync/batch', {
    user_id: USER_ID,
    device_id: DEVICE_ID,
    device_token: deviceToken,
    app_version: APP_VERSION,
    challenge_id: challengeId,
    challenge_response: response,
    actions,
  });

  assert('Sync returns 200', syncStatus === 200, `status=${syncStatus}`);
  assert('Sync returns results array', Array.isArray(syncJson.data?.results), JSON.stringify(syncJson.data));
  assert('All 5 actions processed', syncJson.data?.results?.length === 5, `got ${syncJson.data?.results?.length}`);

  if (syncJson.data?.results) {
    const allAccepted = syncJson.data.results.every(r => r.status === 'accepted');
    assert('All valid actions accepted', allAccepted,
      syncJson.data.results.filter(r => r.status !== 'accepted').map(r => `${r.action_id}: ${r.reason}`).join(', '));

    // Verify XP calculations
    const workoutResult = syncJson.data.results.find(r => r.action_id === 'test-workout-001');
    // Expected: 100 base + 5*20 exercise + 0 completion (5<6) + 3*10 streak = 230
    assert('Workout XP correct (230)', workoutResult?.xp_awarded === 230, `got ${workoutResult?.xp_awarded}`);

    const stepResult = syncJson.data.results.find(r => r.action_id === 'test-steps-001');
    // Expected: floor(8500/1000) * 4 = 32
    assert('Step XP correct (32)', stepResult?.xp_awarded === 32, `got ${stepResult?.xp_awarded}`);

    const jogResult = syncJson.data.results.find(r => r.action_id === 'test-jog-001');
    // Expected: floor(2500/100) * 10 = 250
    assert('Jog XP correct (250)', jogResult?.xp_awarded === 250, `got ${jogResult?.xp_awarded}`);
  }

  assert('Server XP returned', typeof syncJson.data?.server_xp === 'number', JSON.stringify(syncJson.data));
  assert('Subscription status returned', typeof syncJson.data?.subscription_status === 'string',
    JSON.stringify(syncJson.data));

  // ── 5. Replay Protection ──
  console.log('\n5. Replay Protection (reuse consumed challenge)');
  const { status: replayStatus, json: replayJson } = await post('/sync/batch', {
    user_id: USER_ID,
    device_id: DEVICE_ID,
    device_token: deviceToken,
    app_version: APP_VERSION,
    challenge_id: challengeId,
    challenge_response: response,
    actions: [{ action_id: 'replay-001', type: 'step_log', payload: { steps: 100 } }],
  });
  assert('Replay blocked (403)', replayStatus === 403, `status=${replayStatus}, msg=${replayJson.error}`);

  // ── 6. Invalid Action Rejection ──
  console.log('\n6. Invalid Action Rejection');

  // Get fresh challenge
  const { json: ch2Json } = await post('/auth/challenge', {
    user_id: USER_ID,
    device_id: DEVICE_ID,
  });
  const response2 = computeResponse(ch2Json.data.nonce, DEVICE_ID, APP_VERSION);

  const invalidActions = [
    {
      action_id: 'bad-workout',
      type: 'workout_complete',
      payload: { completed_exercises: 999, total_exercises: 5, duration_minutes: 30 },
    },
    {
      action_id: 'bad-type',
      type: 'subscription_unlock', // Blocked action type
      payload: {},
    },
    {
      action_id: 'good-streak',
      type: 'streak_update',
      payload: { current_streak: 1 },
    },
  ];

  const { status: invStatus, json: invJson } = await post('/sync/batch', {
    user_id: USER_ID,
    device_id: DEVICE_ID,
    device_token: deviceToken,
    app_version: APP_VERSION,
    challenge_id: ch2Json.data.challenge_id,
    challenge_response: response2,
    actions: invalidActions,
  });

  assert('Partial batch returns 200', invStatus === 200, `status=${invStatus}`);
  if (invJson.data?.results) {
    const badWorkout = invJson.data.results.find(r => r.action_id === 'bad-workout');
    assert('Impossible workout rejected', badWorkout?.status === 'rejected', badWorkout?.reason);

    const badType = invJson.data.results.find(r => r.action_id === 'bad-type');
    assert('Blocked action type rejected', badType?.status === 'rejected', badType?.reason);

    const goodStreak = invJson.data.results.find(r => r.action_id === 'good-streak');
    assert('Valid action still accepted', goodStreak?.status === 'accepted', goodStreak?.reason);
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  PASS: ${pass}  |  FAIL: ${fail}  |  TOTAL: ${pass + fail}`);
  console.log(`${'═'.repeat(50)}\n`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
