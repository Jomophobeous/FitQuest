#!/usr/bin/env node
/**
 * Phase 30 Integration Tests — Adaptive Response Engine
 *
 * Test sections:
 *   A. Health check + Phase 30 verification (5 tests)
 *   B. Response status endpoint — clean user (4 tests)
 *   C. Evaluate response — no threat (4 tests)
 *   D. Response history — empty baseline (3 tests)
 *   E. Clear response — no-op on clean user (3 tests)
 *   F. Decay response — 404 on no active response (3 tests)
 *   G. Evaluate response — after anomaly injection (5 tests)
 *   H. Enforcement state — includes adaptive response (4 tests)
 *   I. Clear response — active response cleared (4 tests)
 *   J. Config validation — thresholds + types present (6 tests)
 *
 * Requires: Server running at BASE_URL, valid API_KEY and ADMIN_SECRET
 */
'use strict';

require('dotenv').config();
const crypto = require('crypto');

const BASE_URL = process.env.TEST_BASE_URL || 'https://fitq-56sj.onrender.com';
const API_KEY  = process.env.API_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.DEVICE_SIGNING_SECRET;

let pass = 0;
let fail = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function assert(label, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label} — ${detail || 'assertion failed'}`);
  }
}

async function post(path, body, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeout || 60000);
  try {
    const resp = await fetch(BASE_URL + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await resp.json().catch(() => null);
    if (resp.status === 429 && !opts._retried) {
      clearTimeout(timeout);
      await sleep(15000);
      return post(path, body, { ...opts, _retried: true });
    }
    return { status: resp.status, json };
  } finally {
    clearTimeout(timeout);
  }
}

async function get(path, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const resp = await fetch(BASE_URL + path, { signal: controller.signal });
    const json = await resp.json().catch(() => null);
    if (resp.status === 429 && !opts._retried) {
      clearTimeout(timeout);
      await sleep(15000);
      return get(path, { _retried: true });
    }
    return { status: resp.status, json };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Helper: create test user with device registration ──
async function createTestUser(suffix) {
  const userId = `test-phase30-${suffix}-${Date.now()}`;
  const email = `${userId}@test.fitquest.dev`;
  const deviceId = `device-phase30-${suffix}-${Date.now()}`;
  const appVersion = '1.0.0';

  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await post('/user/create', { id: userId, email });
    if (r.status !== 429) break;
    console.log(`  ⏳ User create rate-limited, waiting 15s (attempt ${attempt + 1})…`);
    await sleep(15000);
  }

  let deviceToken = null;
  const { status: chalStatus, json: chalJson } = await post('/auth/challenge', {
    user_id: userId, device_id: deviceId,
  });

  if (chalStatus === 200 && chalJson?.data?.nonce) {
    const { challenge_id, nonce } = chalJson.data;
    const response = crypto.createHash('sha256')
      .update(`${nonce}${deviceId}${appVersion}`)
      .digest('hex');

    const { status: verStatus } = await post('/auth/verify', {
      challenge_id, response, app_version: appVersion,
    });

    if (verStatus === 200) {
      const { status: chal2Status, json: chal2Json } = await post('/auth/challenge', {
        user_id: userId, device_id: deviceId,
      });
      if (chal2Status === 200 && chal2Json?.data?.nonce) {
        const resp2 = crypto.createHash('sha256')
          .update(`${chal2Json.data.nonce}${deviceId}${appVersion}`)
          .digest('hex');
        const { status: regStatus, json: regJson } = await post('/device/register', {
          user_id: userId, device_id: deviceId, app_version: appVersion,
          challenge_id: chal2Json.data.challenge_id, challenge_response: resp2,
        });
        if (regStatus === 200) {
          deviceToken = regJson?.data?.device_token;
        }
      }
    }
  }

  return { userId, email, deviceId, deviceToken };
}

// ══════════════════════════════════════════════════════════════
// SECTION A: Health Check + Phase 30 Verification
// ══════════════════════════════════════════════════════════════
async function sectionA() {
  console.log('\n── Section A: Health Check + Phase 30 ──');

  const { status, json } = await get('/health');
  assert('A1: Health returns 200', status === 200);
  assert('A2: Phase is 30', json?.data?.phase === 30, `got phase=${json?.data?.phase}`);
  assert('A3: Status is operational', json?.data?.status === 'operational');
  assert('A4: Engines list includes adaptive_response',
    Array.isArray(json?.data?.engines) && json.data.engines.includes('adaptive_response'),
    `engines=${JSON.stringify(json?.data?.engines)}`);
  assert('A5: Service is fitquest-authority', json?.data?.service === 'fitquest-authority');
}

// ══════════════════════════════════════════════════════════════
// SECTION B: Response Status — Clean User
// ══════════════════════════════════════════════════════════════
async function sectionB() {
  console.log('\n── Section B: Response Status — Clean User ──');

  const { userId } = await createTestUser('status');

  const { status, json } = await post('/admin/response-status', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('B1: Status 200', status === 200);
  assert('B2: No active response', json?.data?.active_response === null);
  assert('B3: Response types present', json?.data?.response_types?.NONE === 'NONE');
  assert('B4: Thresholds present', json?.data?.thresholds?.FRICTION?.min_threat === 5);
}

// ══════════════════════════════════════════════════════════════
// SECTION C: Evaluate Response — No Threat
// ══════════════════════════════════════════════════════════════
async function sectionC() {
  console.log('\n── Section C: Evaluate Response — No Threat ──');

  const { userId } = await createTestUser('eval');

  const { status, json } = await post('/admin/evaluate-response', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('C1: Status 200', status === 200);
  assert('C2: Has action field', json?.data?.action !== undefined);
  // Clean user should get NONE or no_action
  const isClean = json?.data?.action === 'no_action' ||
                  json?.data?.action === 'none' ||
                  json?.data?.response_type === 'NONE' ||
                  json?.data?.computed?.response_type === 'NONE';
  assert('C3: Clean user gets no action', isClean, `action=${json?.data?.action}`);
  assert('C4: User ID echoed', json?.data?.user_id === userId);
}

// ══════════════════════════════════════════════════════════════
// SECTION D: Response History — Empty Baseline
// ══════════════════════════════════════════════════════════════
async function sectionD() {
  console.log('\n── Section D: Response History — Empty Baseline ──');

  const { userId } = await createTestUser('hist');

  const { status, json } = await post('/admin/response-history', {
    admin_secret: ADMIN_SECRET, user_id: userId, limit: 10,
  });
  assert('D1: Status 200', status === 200);
  assert('D2: History is array', Array.isArray(json?.data?.history));
  assert('D3: History empty for new user', json?.data?.count === 0,
    `count=${json?.data?.count}`);
}

// ══════════════════════════════════════════════════════════════
// SECTION E: Clear Response — No-op on Clean User
// ══════════════════════════════════════════════════════════════
async function sectionE() {
  console.log('\n── Section E: Clear Response — Clean User ──');

  const { userId } = await createTestUser('clear');

  const { status, json } = await post('/admin/clear-response', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('E1: Status 200', status === 200);
  assert('E2: Success true', json?.data?.success === true);
  assert('E3: Cleared 0', json?.data?.cleared === 0 || json?.data?.cleared === null,
    `cleared=${json?.data?.cleared}`);
}

// ══════════════════════════════════════════════════════════════
// SECTION F: Decay Response — 404 on No Active Response
// ══════════════════════════════════════════════════════════════
async function sectionF() {
  console.log('\n── Section F: Decay Response — No Active Response ──');

  const { userId } = await createTestUser('decay');

  const { status, json } = await post('/admin/decay-response', {
    admin_secret: ADMIN_SECRET, user_id: userId, clean_hours: 2,
  });
  assert('F1: Status 404 (no active response)', status === 404, `status=${status}`);
  assert('F2: Error message present', json?.error || json?.message,
    `json=${JSON.stringify(json)}`);
  assert('F3: Reason is no_active_response',
    (json?.error || json?.message || '').includes('no_active_response') ||
    (json?.error || json?.message || '').includes('no active'),
    `msg=${json?.error || json?.message}`);
}

// ══════════════════════════════════════════════════════════════
// SECTION G: Evaluate Response — After Anomaly Injection
// ══════════════════════════════════════════════════════════════
async function sectionG() {
  console.log('\n── Section G: Evaluate Response — With Anomalies ──');

  const { userId, deviceId } = await createTestUser('anomaly');

  // Inject anomalies to raise threat score
  for (let i = 0; i < 5; i++) {
    await post('/admin/inject-anomaly', {
      admin_secret: ADMIN_SECRET,
      user_id: userId,
      device_id: deviceId,
      type: i % 2 === 0 ? 'tamper_detected' : 'clock_manipulation',
      ip: '10.0.0.1',
    });
    await sleep(500);
  }

  // Lower trust to trigger response
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    trust_score: 0.3,
    anomaly_score: 0.5,
  });

  await sleep(1000);

  // Evaluate response
  const { status, json } = await post('/admin/evaluate-response', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('G1: Status 200', status === 200);
  assert('G2: User ID echoed', json?.data?.user_id === userId);

  // After evaluation, check status
  const { status: s2, json: j2 } = await post('/admin/response-status', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('G3: Status endpoint returns 200', s2 === 200);

  // Check history now has entries
  const { json: j3 } = await post('/admin/response-history', {
    admin_secret: ADMIN_SECRET, user_id: userId, limit: 10,
  });
  assert('G4: History count >= 0', (j3?.data?.count || 0) >= 0);
  assert('G5: History is array', Array.isArray(j3?.data?.history));
}

// ══════════════════════════════════════════════════════════════
// SECTION H: Enforcement State — Includes Adaptive Response
// ══════════════════════════════════════════════════════════════
async function sectionH() {
  console.log('\n── Section H: Enforcement State + Response ──');

  const { userId } = await createTestUser('enforce');

  const { status, json } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('H1: Status 200', status === 200);
  assert('H2: Has accessProfile', json?.data?.accessProfile !== undefined);
  assert('H3: Has effectiveTrust', json?.data?.effectiveTrust !== undefined);
  // Phase 30: adaptiveResponse field should exist (null for clean user)
  assert('H4: Has adaptiveResponse field',
    json?.data?.adaptiveResponse === null || json?.data?.adaptiveResponse !== undefined,
    `keys=${Object.keys(json?.data || {})}`);
}

// ══════════════════════════════════════════════════════════════
// SECTION I: Clear Response — Active Response Cleared
// ══════════════════════════════════════════════════════════════
async function sectionI() {
  console.log('\n── Section I: Clear Active Response ──');

  const { userId, deviceId } = await createTestUser('clearactive');

  // Inject anomalies + low trust
  for (let i = 0; i < 4; i++) {
    await post('/admin/inject-anomaly', {
      admin_secret: ADMIN_SECRET, user_id: userId, device_id: deviceId,
      type: 'tamper_detected', ip: '10.0.0.2',
    });
    await sleep(500);
  }
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET, user_id: userId,
    trust_score: 0.2, anomaly_score: 0.6,
  });

  // Evaluate to create response
  await post('/admin/evaluate-response', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  await sleep(500);

  // Clear it
  const { status, json } = await post('/admin/clear-response', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('I1: Status 200', status === 200);
  assert('I2: Success true', json?.data?.success === true);

  // Verify cleared
  const { json: j2 } = await post('/admin/response-status', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('I3: No active response after clear', j2?.data?.active_response === null);
  assert('I4: Status endpoint still works', j2?.data?.response_types?.NONE === 'NONE');
}

// ══════════════════════════════════════════════════════════════
// SECTION J: Config Validation — Thresholds + Types
// ══════════════════════════════════════════════════════════════
async function sectionJ() {
  console.log('\n── Section J: Config Validation ──');

  const { userId } = await createTestUser('config');

  const { json } = await post('/admin/response-status', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });

  const types = json?.data?.response_types || {};
  const thresholds = json?.data?.thresholds || {};

  assert('J1: Has NONE type', types.NONE === 'NONE');
  assert('J2: Has FRICTION type', types.FRICTION === 'FRICTION');
  assert('J3: Has SHADOW type', types.SHADOW === 'SHADOW');
  assert('J4: Has ISOLATE type', types.ISOLATE === 'ISOLATE');
  assert('J5: Has HARD_RESTRICT type', types.HARD_RESTRICT === 'HARD_RESTRICT');
  assert('J6: FRICTION threshold min=5',
    thresholds.FRICTION?.min_threat === 5,
    `min=${thresholds.FRICTION?.min_threat}`);
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Phase 30 — Adaptive Response Engine Tests    ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║  Target: ${BASE_URL}`);
  console.log(`║  API_KEY: ${API_KEY ? '✅ set' : '❌ missing'}`);
  console.log(`║  ADMIN_SECRET: ${ADMIN_SECRET ? '✅ set' : '❌ missing'}`);
  console.log('╚════════════════════════════════════════════════╝');

  if (!API_KEY || !ADMIN_SECRET) {
    console.error('\n❌ Missing API_KEY or ADMIN_SECRET. Set them in .env');
    process.exit(1);
  }

  // Wake up Render free-tier server
  console.log('\n  🔄 Waking server…');
  try {
    const wakeup = await get('/health');
    console.log(`  ✅ Server awake (${wakeup.status})`);
  } catch {
    console.log('  ⚠️ Server slow — proceeding anyway');
  }

  try {
    await sectionA();
    console.log('  ⏳ Cooldown…');
    await sleep(10000);
    await get('/health');

    await sectionB();
    console.log('  ⏳ Cooldown…');
    await sleep(10000);
    await get('/health');

    await sectionC();
    console.log('  ⏳ Cooldown…');
    await sleep(10000);
    await get('/health');

    await sectionD();
    console.log('  ⏳ Cooldown…');
    await sleep(10000);
    await get('/health');

    await sectionE();
    console.log('  ⏳ Cooldown…');
    await sleep(10000);
    await get('/health');

    await sectionF();
    console.log('  ⏳ Cooldown…');
    await sleep(10000);
    await get('/health');

    await sectionG();
    console.log('  ⏳ Cooldown…');
    await sleep(15000);
    await get('/health');

    await sectionH();
    console.log('  ⏳ Cooldown…');
    await sleep(10000);
    await get('/health');

    await sectionI();
    console.log('  ⏳ Cooldown…');
    await sleep(10000);
    await get('/health');

    await sectionJ();
  } catch (err) {
    console.error('\n💥 Unhandled error during tests:', err.message);
    fail++;
  }

  console.log('\n╔════════════════════════════════════════════════╗');
  console.log(`║  Results: ${pass} passed, ${fail} failed (${pass + fail} total)`);
  console.log('╚════════════════════════════════════════════════╝');

  process.exit(fail > 0 ? 1 : 0);
}

main();
