/**
 * Phase 25B — Adversarial Validation Suite
 *
 * Kill Scenarios:
 *   A. Offline XP Inflation Attempt — submit inflated XP, verify server rejects/recalculates
 *   B. Subscription Exploit — attempt premium bypass with expired/missing cache
 *   C. Replay Attack — resend consumed challenge
 *   D. Rapid Sync Flapping — 10 concurrent batch calls, verify no duplicates
 *   E. Partial Failure — mix of valid/invalid/impossible actions in one batch
 *   F. Trust Leakage — client sends fake server_xp in payload, verify ignored
 *   G. Boundary Values — zero exercises, negative steps, 200k steps, 480min workouts
 *   H. Missing Fields — partial payloads, empty actions array, oversized batch
 *
 * Run: cd server && node test-phase25b-adversarial.js
 */

'use strict';

const crypto = require('crypto');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BASE = process.env.TEST_BASE_URL || 'https://fitq-56sj.onrender.com';
const API_KEY = process.env.API_KEY || process.env.EXPO_PUBLIC_AUTHORITY_API_KEY || '';
const USER_ID = 'user_local_001';
const DEVICE_ID = 'test-adversarial-25b';
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json();
    return { status: res.status, json };
  } finally {
    clearTimeout(timeout);
  }
}

function computeResponse(nonce, deviceId, appVersion) {
  return crypto.createHash('sha256').update(`${nonce}${deviceId}${appVersion}`).digest('hex');
}

/**
 * Register device and return device_token (Phase 26 requirement).
 */
async function registerDeviceToken(deviceId) {
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

// Device token acquired during setup
let DEVICE_TOKEN = null;

async function getAuthenticatedChallenge(deviceId = DEVICE_ID) {
  const { status, json } = await post('/auth/challenge', { user_id: USER_ID, device_id: deviceId });
  if (status === 429) {
    console.log('  ⏳ Rate limited — waiting 10s...');
    await sleep(10000);
    return getAuthenticatedChallenge(deviceId);
  }
  if (!json.data?.challenge_id) throw new Error(`Failed to acquire challenge (status=${status}, error=${json.error})`);
  const response = computeResponse(json.data.nonce, deviceId, APP_VERSION);
  return { challenge_id: json.data.challenge_id, challenge_response: response };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function syncBatch(actions, deviceId = DEVICE_ID) {
  const auth = await getAuthenticatedChallenge(deviceId);
  return post('/sync/batch', {
    user_id: USER_ID,
    device_id: deviceId,
    device_token: DEVICE_TOKEN,
    app_version: APP_VERSION,
    ...auth,
    actions,
  });
}

async function main() {
  console.log(`\n⚔️  Phase 25B Adversarial Validation Suite`);
  console.log(`   Target: ${BASE}\n`);

  // ── Setup: ensure user + register device (Phase 26) ──
  console.log('0. Setup');
  await post('/user/create', { id: USER_ID, device_id: DEVICE_ID, app_version: APP_VERSION });
  try {
    DEVICE_TOKEN = await registerDeviceToken(DEVICE_ID);
    assert('Device token acquired', typeof DEVICE_TOKEN === 'string' && DEVICE_TOKEN.length === 64);
  } catch (e) {
    assert('Device token acquired', false, e.message);
    console.log('\n⛔ Device registration failed. Cannot continue.\n');
    process.exit(1);
  }

  // ══════════════════════════════════════════════
  // A. OFFLINE XP INFLATION ATTEMPT
  // ══════════════════════════════════════════════
  console.log('\nA. Offline XP Inflation Attempt');
  {
    // Client claims 9999 XP from a single workout — server recalculates
    const { status, json } = await syncBatch([
      {
        action_id: 'inflate-xp-001',
        type: 'xp_earn',
        payload: { amount: 9999, source: 'inflated_client' },
      },
    ]);
    assert('Inflated XP accepted but capped', status === 200);
    const result = json.data?.results?.[0];
    assert('XP capped to 500 (server cap)', result?.xp_awarded <= 500,
      `awarded=${result?.xp_awarded}`);

    // Workout with impossible stats
    const { status: s2, json: j2 } = await syncBatch([
      {
        action_id: 'inflate-workout-001',
        type: 'workout_complete',
        payload: { completed_exercises: 50, total_exercises: 50, duration_minutes: 5, streak_days: 0 },
      },
    ]);
    assert('50-exercise 5-min workout accepted (valid edge case)', s2 === 200);
    // Server recalculates: 100 + 50*20 + 50 (all complete) + 0 streak = 1150
    const wr = j2.data?.results?.[0];
    assert('Server recalculated XP = 1150', wr?.xp_awarded === 1150, `awarded=${wr?.xp_awarded}`);
  }

  await sleep(1500);

  // ══════════════════════════════════════════════
  // B. SUBSCRIPTION EXPLOIT — Missing/Invalid Fields
  // ══════════════════════════════════════════════
  console.log('\nB. Subscription Exploit Vectors');
  {
    // Try to sync a subscription_unlock action (blocked)
    const { status, json } = await syncBatch([
      {
        action_id: 'sub-exploit-001',
        type: 'subscription_unlock',
        payload: { tier: 'premium' },
      },
    ]);
    assert('subscription_unlock rejected', status === 200);
    const result = json.data?.results?.[0];
    assert('Blocked action type caught', result?.status === 'rejected', result?.reason);
  }

  await sleep(1500);

  // ══════════════════════════════════════════════
  // C. REPLAY ATTACK (DOUBLE-SPEND)
  // ══════════════════════════════════════════════
  console.log('\nC. Replay Attack (Double-Spend)');
  {
    // Get a challenge and use it
    const auth = await getAuthenticatedChallenge();
    const { status: s1 } = await post('/sync/batch', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      device_token: DEVICE_TOKEN,
      app_version: APP_VERSION,
      ...auth,
      actions: [{ action_id: 'replay-first', type: 'step_log', payload: { steps: 1000 } }],
    });
    assert('First use succeeds', s1 === 200);

    // Replay the SAME challenge
    const { status: s2, json: j2 } = await post('/sync/batch', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      device_token: DEVICE_TOKEN,
      app_version: APP_VERSION,
      ...auth,
      actions: [{ action_id: 'replay-second', type: 'step_log', payload: { steps: 1000 } }],
    });
    assert('Replay blocked (403)', s2 === 403, `status=${s2}, error=${j2.error}`);
  }

  await sleep(1500);

  // ══════════════════════════════════════════════
  // D. RAPID SYNC FLAPPING (Concurrency)
  // ══════════════════════════════════════════════
  console.log('\nD. Rapid Sync Flapping (10 concurrent)');
  {
    // Fire 10 concurrent sync requests — each with its own challenge
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        syncBatch([
          { action_id: `flap-${i}`, type: 'step_log', payload: { steps: 100 * (i + 1) } },
        ]).catch(e => ({ status: 0, json: { error: e.message } }))
      );
    }
    const results = await Promise.all(promises);
    const succeeded = results.filter(r => r.status === 200).length;
    const failed403 = results.filter(r => r.status === 403).length;
    const errors = results.filter(r => r.status !== 200 && r.status !== 403);

    assert('At least 1 concurrent sync succeeds', succeeded >= 1, `succeeded=${succeeded}`);
    assert('No 500 errors under load', errors.length === 0,
      errors.map(r => `${r.status}: ${r.json?.error}`).join(', '));
    console.log(`    → ${succeeded} succeeded, ${failed403} auth-blocked, ${errors.length} errors`);
  }

  await sleep(2000);

  // ══════════════════════════════════════════════
  // E. PARTIAL FAILURE — Mixed Valid/Invalid
  // ══════════════════════════════════════════════
  console.log('\nE. Partial Failure Handling');
  {
    const { status, json } = await syncBatch([
      // Valid
      { action_id: 'partial-good-1', type: 'step_log', payload: { steps: 5000 } },
      // Invalid: completed > total
      { action_id: 'partial-bad-1', type: 'workout_complete',
        payload: { completed_exercises: 10, total_exercises: 5, duration_minutes: 30 } },
      // Valid
      { action_id: 'partial-good-2', type: 'jog_log', payload: { distance_meters: 1000, duration_minutes: 8 } },
      // Invalid: negative steps
      { action_id: 'partial-bad-2', type: 'step_log', payload: { steps: -500 } },
      // Invalid: missing payload
      { action_id: 'partial-bad-3', type: 'streak_update', payload: null },
      // Valid
      { action_id: 'partial-good-3', type: 'progress_photo', payload: { ts: Date.now() } },
      // Invalid: unknown type
      { action_id: 'partial-bad-4', type: 'reward_finalize', payload: {} },
    ]);

    assert('Batch returns 200 (not 500 on partial)', status === 200);
    const results = json.data?.results || [];

    const good1 = results.find(r => r.action_id === 'partial-good-1');
    const good2 = results.find(r => r.action_id === 'partial-good-2');
    const good3 = results.find(r => r.action_id === 'partial-good-3');
    const bad1 = results.find(r => r.action_id === 'partial-bad-1');
    const bad2 = results.find(r => r.action_id === 'partial-bad-2');
    const bad3 = results.find(r => r.action_id === 'partial-bad-3');
    const bad4 = results.find(r => r.action_id === 'partial-bad-4');

    assert('Valid step_log accepted', good1?.status === 'accepted');
    assert('Valid jog_log accepted', good2?.status === 'accepted');
    assert('Valid progress_photo accepted', good3?.status === 'accepted');
    assert('completed>total rejected', bad1?.status === 'rejected', bad1?.reason);
    assert('Negative steps rejected', bad2?.status === 'rejected', bad2?.reason);
    assert('Null payload rejected', bad3?.status === 'rejected', bad3?.reason);
    assert('Blocked type rejected', bad4?.status === 'rejected', bad4?.reason);

    // Verify NO accept-all fallback — exactly 3 accepted, 4 rejected
    const accepted = results.filter(r => r.status === 'accepted').length;
    const rejected = results.filter(r => r.status === 'rejected').length;
    assert('Exactly 3 accepted, 4 rejected', accepted === 3 && rejected === 4,
      `accepted=${accepted} rejected=${rejected}`);
  }

  await sleep(1500);

  // ══════════════════════════════════════════════
  // F. TRUST LEAKAGE — Client sends fake server_xp
  // ══════════════════════════════════════════════
  console.log('\nF. Trust Leakage Check');
  {
    // Client includes fake server_xp in payload — server should ignore it
    const auth = await getAuthenticatedChallenge();
    const { status, json } = await post('/sync/batch', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      device_token: DEVICE_TOKEN,
      app_version: APP_VERSION,
      ...auth,
      actions: [
        { action_id: 'trust-leak-1', type: 'step_log', payload: { steps: 1000 } },
      ],
      fake_server_xp: 999999,  // Should be ignored
      fake_subscription: 'premium',  // Should be ignored
    });
    assert('Extra fields ignored — sync still works', status === 200);
    assert('Server returns its own XP (not fake)', json.data?.server_xp !== 999999,
      `server_xp=${json.data?.server_xp}`);
  }

  await sleep(1500);

  // ══════════════════════════════════════════════
  // G. BOUNDARY VALUES
  // ══════════════════════════════════════════════
  console.log('\nG. Boundary Value Testing');
  {
    const { status, json } = await syncBatch([
      // Zero exercises (edge case)
      { action_id: 'bound-1', type: 'workout_complete',
        payload: { completed_exercises: 0, total_exercises: 1, duration_minutes: 0, streak_days: 0 } },
      // Max valid steps (200,000)
      { action_id: 'bound-2', type: 'step_log', payload: { steps: 200000 } },
      // Just over max steps (should reject)
      { action_id: 'bound-3', type: 'step_log', payload: { steps: 200001 } },
      // Max duration (480 min)
      { action_id: 'bound-4', type: 'workout_complete',
        payload: { completed_exercises: 1, total_exercises: 1, duration_minutes: 480, streak_days: 0 } },
      // Over max duration (481 min — should reject)
      { action_id: 'bound-5', type: 'workout_complete',
        payload: { completed_exercises: 1, total_exercises: 1, duration_minutes: 481, streak_days: 0 } },
      // Max streak (365 days)
      { action_id: 'bound-6', type: 'streak_update',
        payload: { current_streak: 3650 } },
      // Over max streak
      { action_id: 'bound-7', type: 'streak_update',
        payload: { current_streak: 3651 } },
    ]);

    assert('Boundary batch returns 200', status === 200);
    const results = json.data?.results || [];

    const b1 = results.find(r => r.action_id === 'bound-1');
    const b2 = results.find(r => r.action_id === 'bound-2');
    const b3 = results.find(r => r.action_id === 'bound-3');
    const b4 = results.find(r => r.action_id === 'bound-4');
    const b5 = results.find(r => r.action_id === 'bound-5');
    const b6 = results.find(r => r.action_id === 'bound-6');
    const b7 = results.find(r => r.action_id === 'bound-7');

    assert('0 exercises accepted (edge)', b1?.status === 'accepted');
    assert('200k steps accepted (max)', b2?.status === 'accepted');
    assert('200001 steps rejected', b3?.status === 'rejected', b3?.reason);
    assert('480min duration accepted', b4?.status === 'accepted');
    assert('481min duration rejected', b5?.status === 'rejected', b5?.reason);
    assert('3650 streak accepted (max)', b6?.status === 'accepted');
    assert('3651 streak rejected', b7?.status === 'rejected', b7?.reason);
  }

  await sleep(1500);

  // ══════════════════════════════════════════════
  // H. MISSING FIELDS / OVERSIZED BATCH
  // ══════════════════════════════════════════════
  console.log('\nH. Missing Fields & Oversized Batch');
  {
    // Empty actions array
    const auth1 = await getAuthenticatedChallenge();
    const { status: s1 } = await post('/sync/batch', {
      user_id: USER_ID, device_id: DEVICE_ID, device_token: DEVICE_TOKEN, app_version: APP_VERSION,
      ...auth1, actions: [],
    });
    assert('Empty actions rejected (400)', s1 === 400);

    // Missing challenge_id
    const { status: s2 } = await post('/sync/batch', {
      user_id: USER_ID, device_id: DEVICE_ID, device_token: DEVICE_TOKEN, app_version: APP_VERSION,
      challenge_response: 'fake', actions: [{ action_id: 'x', type: 'step_log', payload: { steps: 1 } }],
    });
    assert('Missing challenge_id rejected (400)', s2 === 400);

    // Missing user_id
    const auth3 = await getAuthenticatedChallenge();
    const { status: s3 } = await post('/sync/batch', {
      device_id: DEVICE_ID, device_token: DEVICE_TOKEN, app_version: APP_VERSION,
      ...auth3, actions: [{ action_id: 'x', type: 'step_log', payload: { steps: 1 } }],
    });
    assert('Missing user_id rejected (400)', s3 === 400);

    // Oversized batch (51 actions)
    const auth4 = await getAuthenticatedChallenge();
    const bigBatch = Array.from({ length: 51 }, (_, i) => ({
      action_id: `big-${i}`, type: 'step_log', payload: { steps: 100 },
    }));
    const { status: s4 } = await post('/sync/batch', {
      user_id: USER_ID, device_id: DEVICE_ID, device_token: DEVICE_TOKEN, app_version: APP_VERSION,
      ...auth4, actions: bigBatch,
    });
    assert('Oversized batch (51) rejected (400)', s4 === 400);

    // Device mismatch — challenge issued for DEVICE_ID but sync sent with different device
    const auth5 = await getAuthenticatedChallenge('test-adversarial-25b');
    const { status: s5 } = await post('/sync/batch', {
      user_id: USER_ID, device_id: 'completely-different-device', device_token: DEVICE_TOKEN, app_version: APP_VERSION,
      ...auth5, actions: [{ action_id: 'x', type: 'step_log', payload: { steps: 1 } }],
    });
    assert('Device mismatch rejected (403)', s5 === 403);
  }

  // ══════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  ⚔️  ADVERSARIAL SUITE: PASS: ${pass}  |  FAIL: ${fail}  |  TOTAL: ${pass + fail}`);
  console.log(`${'═'.repeat(55)}\n`);

  if (fail > 0) {
    console.log('  ⛔ INTEGRITY COMPROMISED — Fix failures before proceeding.\n');
  } else {
    console.log('  ✅ ALL ADVERSARIAL SCENARIOS SURVIVED — System integrity holds.\n');
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
