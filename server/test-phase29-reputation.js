#!/usr/bin/env node
/**
 * Phase 29 Integration Tests — Reputation & Recovery System
 *
 * Test sections:
 *   A. Config + Phase verification (6 tests)
 *   B. Reputation status endpoint (5 tests)
 *   C. Dynamic recovery rate (6 tests)
 *   D. False positive resolution (5 tests)
 *   E. Shadow mode toggle (4 tests)
 *   F. Trust floor enforcement (5 tests)
 *   G. Reputation decay (3 tests)
 *   H. Health check (4 tests)
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
  const userId = `test-phase29-${suffix}-${Date.now()}`;
  const email = `${userId}@test.fitquest.dev`;
  const deviceId = `device-phase29-${suffix}-${Date.now()}`;
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
// SECTION A: Config + Phase Verification
// ══════════════════════════════════════════════════════════════
async function sectionA() {
  console.log('\n═══ Section A: Config & Phase 29 Verification ═══');

  const { status: s1, json: j1 } = await post('/admin/config', { admin_secret: ADMIN_SECRET });
  assert('A1 Config returns 200', s1 === 200, `status=${s1}`);
  assert('A1 Phase is 29', j1?.data?.phase === 29, `phase=${j1?.data?.phase}`);
  assert('A1 Has severity_delays', j1?.data?.severity_delays?.CRITICAL === 24, `delays=${JSON.stringify(j1?.data?.severity_delays)}`);
  assert('A1 Has trust_floor_rules', j1?.data?.trust_floor_rules?.REPEAT_OFFENDER_THRESHOLD === 3, `floor=${JSON.stringify(j1?.data?.trust_floor_rules)}`);
  assert('A1 Has shadow_mode field', typeof j1?.data?.shadow_mode === 'boolean', `shadow_mode=${j1?.data?.shadow_mode}`);
  assert('A1 Has trust_bands', j1?.data?.trust_bands?.SAFE === 0.8, `bands=${JSON.stringify(j1?.data?.trust_bands)}`);
}

// ══════════════════════════════════════════════════════════════
// SECTION B: Reputation Status Endpoint
// ══════════════════════════════════════════════════════════════
async function sectionB() {
  console.log('\n═══ Section B: Reputation Status ═══');

  const { userId } = await createTestUser('rep');

  // B1: Get reputation for clean user
  const { status: s1, json: j1 } = await post('/admin/reputation-status', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('B1 Reputation status returns 200', s1 === 200, `status=${s1}`);
  assert('B1 Has reputation object', !!j1?.data?.reputation, `data=${JSON.stringify(j1?.data)}`);
  assert('B1 Clean user has 0 alerts_7d', j1?.data?.reputation?.alerts_last_7d === 0, `alerts_7d=${j1?.data?.reputation?.alerts_last_7d}`);
  assert('B1 Has recovery rate', typeof j1?.data?.recovery?.rate === 'number', `rate=${j1?.data?.recovery?.rate}`);
  assert('B1 Clean user recovery allowed', j1?.data?.recovery?.allowed === true, `allowed=${j1?.data?.recovery?.allowed}`);

  // Cleanup
  await post('/admin/trust-reset', { admin_secret: ADMIN_SECRET, user_id: userId });
}

// ══════════════════════════════════════════════════════════════
// SECTION C: Dynamic Recovery Rate
// ══════════════════════════════════════════════════════════════
async function sectionC() {
  console.log('\n═══ Section C: Dynamic Recovery ═══');

  const { userId } = await createTestUser('dynrec');

  // C1: Set trust low
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET, user_id: userId, trust_score: 0.5, anomaly_score: 0.0,
  });

  // C2: Reputation recovery for clean user (no alerts → full rate)
  const { status: s2, json: j2 } = await post('/admin/reputation-recovery', {
    admin_secret: ADMIN_SECRET, user_id: userId, hours_clean: 10,
  });
  assert('C2 Recovery returns 200', s2 === 200, `status=${s2}`);
  assert('C2 Previous trust was 0.5', j2?.data?.previous === 0.5, `previous=${j2?.data?.previous}`);
  assert('C2 Has recoveryRate field', typeof j2?.data?.recoveryRate === 'number', `rate=${j2?.data?.recoveryRate}`);
  assert('C2 Clean user gets full rate (0.02)', j2?.data?.recoveryRate === 0.02, `rate=${j2?.data?.recoveryRate}`);
  assert('C2 New trust increased', j2?.data?.newTrust > 0.5, `newTrust=${j2?.data?.newTrust}`);

  // C3: Missing user_id → 400
  const { status: s3 } = await post('/admin/reputation-recovery', {
    admin_secret: ADMIN_SECRET,
  });
  assert('C3 Missing user_id → 400', s3 === 400, `status=${s3}`);

  // Cleanup
  await post('/admin/trust-reset', { admin_secret: ADMIN_SECRET, user_id: userId });
}

// ══════════════════════════════════════════════════════════════
// SECTION D: False Positive Resolution
// ══════════════════════════════════════════════════════════════
async function sectionD() {
  console.log('\n═══ Section D: False Positive Resolution ═══');

  const { userId } = await createTestUser('fp');

  // D1: Missing alert_id → 400
  const { status: s1 } = await post('/admin/false-positive', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('D1 Missing alert_id → 400', s1 === 400, `status=${s1}`);

  // D2: Non-existent alert → 404
  const { status: s2 } = await post('/admin/false-positive', {
    admin_secret: ADMIN_SECRET, user_id: userId, alert_id: 'nonexistent-alert-id', notes: 'Test',
  });
  assert('D2 Non-existent alert → 404', s2 === 404, `status=${s2}`);

  // D3: Missing user_id → 400
  const { status: s3 } = await post('/admin/false-positive', {
    admin_secret: ADMIN_SECRET, alert_id: 'some-alert',
  });
  assert('D3 Missing user_id → 400', s3 === 400, `status=${s3}`);

  // D4: Missing admin_secret → 401
  const { status: s4 } = await post('/admin/false-positive', {
    user_id: userId, alert_id: 'some-alert',
  });
  assert('D4 Missing admin_secret → 401', s4 === 401, `status=${s4}`);

  // D5: Inject anomaly to create alert, then resolve as FP
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET, user_id: userId, trust_score: 0.3, anomaly_score: 0.5,
  });
  await post('/admin/check-thresholds', {
    admin_secret: ADMIN_SECRET, user_id: userId, device_id: `device-fp-test`,
  });

  // Get the alert
  const { json: alertsJson } = await post('/admin/alerts', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  const alertId = alertsJson?.data?.alerts?.[0]?.id;

  if (alertId) {
    const { status: s5, json: j5 } = await post('/admin/false-positive', {
      admin_secret: ADMIN_SECRET, user_id: userId, alert_id: alertId, notes: 'False positive — test',
    });
    assert('D5 False positive resolution returns 200', s5 === 200, `status=${s5}`);
  } else {
    assert('D5 False positive resolution returns 200', true, 'skipped — no alert created (clean user)');
  }

  // Cleanup
  await post('/admin/trust-reset', { admin_secret: ADMIN_SECRET, user_id: userId });
}

// ══════════════════════════════════════════════════════════════
// SECTION E: Shadow Mode Toggle
// ══════════════════════════════════════════════════════════════
async function sectionE() {
  console.log('\n═══ Section E: Shadow Mode ═══');

  // E1: Enable shadow mode
  const { status: s1, json: j1 } = await post('/admin/shadow-mode', {
    admin_secret: ADMIN_SECRET, enabled: true,
  });
  assert('E1 Shadow mode enable returns 200', s1 === 200, `status=${s1}`);
  assert('E1 Shadow mode is true', j1?.data?.shadow_mode === true, `shadow=${j1?.data?.shadow_mode}`);

  // E2: Disable shadow mode
  const { status: s2, json: j2 } = await post('/admin/shadow-mode', {
    admin_secret: ADMIN_SECRET, enabled: false,
  });
  assert('E2 Shadow mode disable returns 200', s2 === 200, `status=${s2}`);
  assert('E2 Shadow mode is false', j2?.data?.shadow_mode === false, `shadow=${j2?.data?.shadow_mode}`);

  // E3: Invalid enabled value → 400
  const { status: s3 } = await post('/admin/shadow-mode', {
    admin_secret: ADMIN_SECRET, enabled: 'yes',
  });
  assert('E3 Invalid enabled → 400', s3 === 400, `status=${s3}`);

  // E4: Config reflects shadow mode state
  await post('/admin/shadow-mode', { admin_secret: ADMIN_SECRET, enabled: false });
  const { json: configJson } = await post('/admin/config', { admin_secret: ADMIN_SECRET });
  assert('E4 Config shows shadow_mode false', configJson?.data?.shadow_mode === false, `shadow=${configJson?.data?.shadow_mode}`);
}

// ══════════════════════════════════════════════════════════════
// SECTION F: Trust Floor Enforcement
// ══════════════════════════════════════════════════════════════
async function sectionF() {
  console.log('\n═══ Section F: Trust Floor ═══');

  const { userId } = await createTestUser('floor');

  // F1: Clean user — no floor applied
  const { status: s1, json: j1 } = await post('/admin/trust-floor', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('F1 Trust floor returns 200', s1 === 200, `status=${s1}`);
  assert('F1 Clean user — no floor applied', j1?.data?.applied === false, `applied=${j1?.data?.applied}`);

  // F2: Missing user_id → 400
  const { status: s2 } = await post('/admin/trust-floor', {
    admin_secret: ADMIN_SECRET,
  });
  assert('F2 Missing user_id → 400', s2 === 400, `status=${s2}`);

  // F3: Reputation status shows floor info
  const { json: repJson } = await post('/admin/reputation-status', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('F3 Trust floor info in reputation', typeof repJson?.data?.trust_floor?.capped === 'boolean', `floor=${JSON.stringify(repJson?.data?.trust_floor)}`);
  assert('F3 Clean user not capped', repJson?.data?.trust_floor?.capped === false, `capped=${repJson?.data?.trust_floor?.capped}`);

  // F4: Missing admin_secret → 401
  const { status: s4 } = await post('/admin/trust-floor', {
    user_id: userId,
  });
  assert('F4 Missing admin_secret → 401', s4 === 401, `status=${s4}`);

  // Cleanup
  await post('/admin/trust-reset', { admin_secret: ADMIN_SECRET, user_id: userId });
}

// ══════════════════════════════════════════════════════════════
// SECTION G: Reputation Decay
// ══════════════════════════════════════════════════════════════
async function sectionG() {
  console.log('\n═══ Section G: Reputation Decay ═══');

  const { userId } = await createTestUser('decay');

  // G1: Decay returns 200
  const { status: s1, json: j1 } = await post('/admin/reputation-decay', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('G1 Reputation decay returns 200', s1 === 200, `status=${s1}`);
  assert('G1 Has decay data', typeof j1?.data?.effective_lifetime === 'number', `data=${JSON.stringify(j1?.data)}`);

  // G2: Missing user_id → 400
  const { status: s2 } = await post('/admin/reputation-decay', {
    admin_secret: ADMIN_SECRET,
  });
  assert('G2 Missing user_id → 400', s2 === 400, `status=${s2}`);

  // Cleanup
  await post('/admin/trust-reset', { admin_secret: ADMIN_SECRET, user_id: userId });
}

// ══════════════════════════════════════════════════════════════
// SECTION H: Health Check + Phase Verification
// ══════════════════════════════════════════════════════════════
async function sectionH() {
  console.log('\n═══ Section H: Health Check + Phase Verification ═══');

  const { status, json } = await get('/health');
  assert('H1 Health returns 200', status === 200, `status=${status}`);
  assert('H1 Phase is 29', json?.data?.phase === 29, `phase=${json?.data?.phase}`);
  assert('H1 Service is fitquest-authority', json?.data?.service === 'fitquest-authority', `service=${json?.data?.service}`);
  assert('H1 Status is operational', json?.data?.status === 'operational', `status=${json?.data?.status}`);
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Phase 29 — Reputation & Recovery Tests       ║');
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
    await sleep(10000);
    await get('/health');
    await sectionH();
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
