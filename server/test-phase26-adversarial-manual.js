/**
 * Phase 26 — Manual Adversarial Checks A–D
 *
 * A. Token theft simulation (steal token, use from different device)
 * B. Post-revocation access (revoke, then hammer the server with revoked token)
 * C. Rotation race condition (two concurrent rotations on same device)
 * D. Concurrent registration spam (10 rapid /device/register calls)
 */
'use strict';

const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BASE = process.env.TEST_BASE_URL || 'https://fitq-56sj.onrender.com';
const API_KEY = process.env.API_KEY || process.env.EXPO_PUBLIC_AUTHORITY_API_KEY || '';
const USER_ID = 'user_local_001';
const APP_VERSION = '2.0.0';

let pass = 0;
let fail = 0;

function assert(label, condition, detail) {
  if (condition) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}: ${detail || 'FAILED'}`); }
}

async function post(urlPath, body) {
  const headers = { 'Content-Type': 'application/json', 'X-App-Version': APP_VERSION };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${BASE}${urlPath}`, {
      method: 'POST', headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally { clearTimeout(timeout); }
}

function computeResponse(nonce, deviceId, appVersion) {
  return crypto.createHash('sha256').update(`${nonce}${deviceId}${appVersion}`).digest('hex');
}

async function getChallenge(deviceId) {
  const { status, json } = await post('/auth/challenge', { user_id: USER_ID, device_id: deviceId });
  if (status !== 200 || !json.data?.challenge_id) throw new Error(`Challenge failed: status=${status}`);
  return { challenge_id: json.data.challenge_id, nonce: json.data.nonce };
}

async function registerDevice(deviceId) {
  const { challenge_id, nonce } = await getChallenge(deviceId);
  const cr = computeResponse(nonce, deviceId, APP_VERSION);
  const { status, json } = await post('/device/register', {
    user_id: USER_ID, device_id: deviceId, app_version: APP_VERSION,
    challenge_id, challenge_response: cr,
  });
  if (status !== 200 || !json.data?.device_token) throw new Error(`Register failed: ${status}`);
  return json.data.device_token;
}

async function syncWithToken(deviceId, deviceToken) {
  const { challenge_id, nonce } = await getChallenge(deviceId);
  const cr = computeResponse(nonce, deviceId, APP_VERSION);
  return post('/sync/batch', {
    user_id: USER_ID, device_id: deviceId, device_token: deviceToken,
    app_version: APP_VERSION, challenge_id, challenge_response: cr,
    actions: [{ action_id: `adv-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      type: 'workout_complete',
      payload: { completed_exercises: 1, total_exercises: 1, duration_minutes: 5, streak_days: 0 } }],
  });
}

async function main() {
  console.log('\n🔬 Phase 26 — Manual Adversarial Checks');
  console.log(`   Target: ${BASE}\n`);

  // Ensure user
  await post('/user/create', { id: USER_ID, device_id: 'adv-check', app_version: APP_VERSION });

  // ══════════════════════════════════════════════
  // A. Token Theft Simulation
  // ══════════════════════════════════════════════
  console.log('A. Token Theft Simulation');
  {
    const victimDev = `adv-victim-${Date.now()}`;
    const attackerDev = `adv-attacker-${Date.now()}`;
    const victimToken = await registerDevice(victimDev);

    // Attacker steals victim's token, uses it claiming to be attacker's device
    const { challenge_id, nonce } = await getChallenge(attackerDev);
    const cr = computeResponse(nonce, attackerDev, APP_VERSION);
    const { status } = await post('/sync/batch', {
      user_id: USER_ID, device_id: attackerDev,
      device_token: victimToken, // stolen
      app_version: APP_VERSION, challenge_id, challenge_response: cr,
      actions: [{ action_id: 'theft-001', type: 'step_log', payload: { steps: 999, date: '2025-01-01' } }],
    });
    assert('A1. Stolen token on wrong device → 403', status === 403, `status=${status}`);

    // Verify victim's token still works on victim's device
    const { status: victimStatus } = await syncWithToken(victimDev, victimToken);
    assert('A2. Victim token still works on correct device', victimStatus === 200, `status=${victimStatus}`);
  }

  // ══════════════════════════════════════════════
  // B. Post-Revocation Hammering
  // ══════════════════════════════════════════════
  console.log('\nB. Post-Revocation Access Hammering');
  {
    const dev = `adv-revoke-${Date.now()}`;
    const token = await registerDevice(dev);

    // Revoke
    const { status: revStatus } = await post('/device/revoke', {
      user_id: USER_ID, device_id: dev, device_token: token, reason: 'adversarial_test',
    });
    assert('B0. Revoke succeeded', revStatus === 200, `status=${revStatus}`);

    // Hammer 5 rapid requests with revoked token
    const results = [];
    for (let i = 0; i < 5; i++) {
      try {
        const { status } = await syncWithToken(dev, token);
        results.push(status);
      } catch (e) {
        results.push(`error:${e.message}`);
      }
    }
    const allBlocked = results.every(s => s === 401 || s === 403);
    assert(`B1. All 5 post-revoke requests blocked`, allBlocked, `statuses=[${results.join(',')}]`);

    // No 500s
    const no500 = results.every(s => s !== 500);
    assert('B2. No server 500s during hammering', no500, `statuses=[${results.join(',')}]`);
  }

  // ══════════════════════════════════════════════
  // C. Rotation Race Condition
  // ══════════════════════════════════════════════
  console.log('\nC. Rotation Race Condition');
  {
    const dev = `adv-race-${Date.now()}`;
    const token = await registerDevice(dev);

    // Prepare two rotation requests using separate challenges
    const ch1 = await getChallenge(dev);
    const ch2 = await getChallenge(dev);
    const cr1 = computeResponse(ch1.nonce, dev, APP_VERSION);
    const cr2 = computeResponse(ch2.nonce, dev, APP_VERSION);

    // Fire both concurrently
    const [r1, r2] = await Promise.all([
      post('/device/rotate', {
        user_id: USER_ID, device_id: dev, device_token: token,
        app_version: APP_VERSION, challenge_id: ch1.challenge_id, challenge_response: cr1,
      }),
      post('/device/rotate', {
        user_id: USER_ID, device_id: dev, device_token: token,
        app_version: APP_VERSION, challenge_id: ch2.challenge_id, challenge_response: cr2,
      }),
    ]);

    // Exactly one should succeed, one should fail (token already rotated)
    const statuses = [r1.status, r2.status].sort();
    const oneSuccess = statuses.includes(200);
    const noDouble200 = !(r1.status === 200 && r2.status === 200);
    assert('C1. At least one rotation succeeded', oneSuccess, `[${r1.status}, ${r2.status}]`);
    assert('C2. No double-rotation (not both 200)', noDouble200, `[${r1.status}, ${r2.status}]`);

    // No 500s
    assert('C3. No server 500s', r1.status !== 500 && r2.status !== 500, `[${r1.status}, ${r2.status}]`);

    // The winning token should work
    const winner = r1.status === 200 ? r1.json.data?.device_token : r2.json.data?.device_token;
    if (winner) {
      const { status } = await syncWithToken(dev, winner);
      assert('C4. Winner token works', status === 200, `status=${status}`);
    }
  }

  // ══════════════════════════════════════════════
  // D. Concurrent Registration Spam
  // ══════════════════════════════════════════════
  console.log('\nD. Concurrent Registration Spam (10 rapid)');
  {
    const dev = `adv-spam-${Date.now()}`;

    // Get 10 challenges first (sequentially — challenges are one-time-use)
    const challenges = [];
    for (let i = 0; i < 10; i++) {
      challenges.push(await getChallenge(dev));
    }

    // Fire all 10 registrations concurrently
    const requests = challenges.map(({ challenge_id, nonce }) => {
      const cr = computeResponse(nonce, dev, APP_VERSION);
      return post('/device/register', {
        user_id: USER_ID, device_id: dev, app_version: APP_VERSION,
        challenge_id, challenge_response: cr,
      });
    });

    const results = await Promise.all(requests);
    const statuses = results.map(r => r.status);
    const tokens = results.filter(r => r.status === 200).map(r => r.json.data?.device_token);

    // All should either succeed or get 403 (challenge consumed)
    const noErrors = statuses.every(s => s === 200 || s === 403);
    assert('D1. No server errors (all 200 or 403)', noErrors, `statuses=[${statuses.join(',')}]`);

    // No 500s
    const no500 = statuses.every(s => s !== 500);
    assert('D2. No server 500s', no500, `statuses=[${statuses.join(',')}]`);

    // All successful registrations should return the same token (idempotent)
    const uniqueTokens = [...new Set(tokens)];
    assert('D3. All successful regs return same token', uniqueTokens.length <= 1, `unique=${uniqueTokens.length}`);

    // The token should work
    if (tokens[0]) {
      const { status } = await syncWithToken(dev, tokens[0]);
      assert('D4. Token from spam works', status === 200, `status=${status}`);
    }
  }

  // ══════════════════════════════════════════════
  //  SUMMARY
  // ══════════════════════════════════════════════
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ADVERSARIAL: ${pass} passed, ${fail} failed, ${pass + fail} total`);
  console.log(`${'═'.repeat(50)}\n`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
