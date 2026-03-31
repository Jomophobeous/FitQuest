#!/usr/bin/env node
/**
 * Phase 27 Integration Tests — Trust Decay + Alerting
 *
 * Test sections:
 *   A. Admin auth & configuration
 *   B. Trust alert generation (threshold-based)
 *   C. Soft enforcement (degraded + soft block)
 *   D. Admin alert management (acknowledge, resolve, escalate)
 *   E. Admin trust management (reset, override)
 *   F. Health check + phase verification
 *
 * Requires: Server running at BASE_URL, valid API_KEY and ADMIN_SECRET (DEVICE_SIGNING_SECRET)
 */
'use strict';

require('dotenv').config();
const crypto = require('crypto');

const BASE_URL = process.env.TEST_BASE_URL || 'https://fitq-56sj.onrender.com';
const API_KEY  = process.env.API_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.DEVICE_SIGNING_SECRET;

let pass = 0;
let fail = 0;
const results = [];

function assert(label, condition, detail) {
  if (condition) {
    pass++;
    results.push({ label, status: 'PASS' });
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    results.push({ label, status: 'FAIL', detail });
    console.log(`  ❌ ${label} — ${detail || 'assertion failed'}`);
  }
}

async function post(path, body, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeout || 30000);
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
    return { status: resp.status, json };
  } finally {
    clearTimeout(timeout);
  }
}

async function get(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(BASE_URL + path, { signal: controller.signal });
    const json = await resp.json().catch(() => null);
    return { status: resp.status, json };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Helper: create a test user with full challenge-response device registration ──
async function createTestUser(suffix) {
  const userId = `test-phase27-${suffix}-${Date.now()}`;
  const email = `${userId}@test.fitquest.dev`;
  const deviceId = `device-phase27-${suffix}-${Date.now()}`;
  const appVersion = '1.0.0';

  // Create user
  const { status: userStatus } = await post('/user/create', { id: userId, email });
  if (userStatus !== 200 && userStatus !== 201) {
    console.log(`  ⚠️  User create returned ${userStatus} for ${userId}`);
  }

  // Challenge-response device registration
  let deviceToken = null;
  const { status: chalStatus, json: chalJson } = await post('/auth/challenge', {
    user_id: userId,
    device_id: deviceId,
  });

  if (chalStatus === 200 && chalJson?.data?.nonce) {
    const { challenge_id, nonce } = chalJson.data;
    // Compute SHA-256(nonce + device_id + app_version)
    const response = crypto.createHash('sha256')
      .update(`${nonce}${deviceId}${appVersion}`)
      .digest('hex');

    // Verify challenge (this also registers the device in `devices` table)
    const { status: verStatus, json: verJson } = await post('/auth/verify', {
      challenge_id,
      response,
      app_version: appVersion,
    });

    if (verStatus === 200) {
      // Now register to get a device_token
      const { status: chal2Status, json: chal2Json } = await post('/auth/challenge', {
        user_id: userId,
        device_id: deviceId,
      });
      if (chal2Status === 200 && chal2Json?.data?.nonce) {
        const resp2 = crypto.createHash('sha256')
          .update(`${chal2Json.data.nonce}${deviceId}${appVersion}`)
          .digest('hex');
        const { status: regStatus, json: regJson } = await post('/device/register', {
          user_id: userId,
          device_id: deviceId,
          app_version: appVersion,
          challenge_id: chal2Json.data.challenge_id,
          challenge_response: resp2,
        });
        if (regStatus === 200) {
          deviceToken = regJson?.data?.device_token;
        }
      }
    }
  }

  return { userId, email, deviceId, deviceToken };
}

// ── SECTION A: Admin Auth & Config ──
async function sectionA() {
  console.log('\n═══ Section A: Admin Auth & Config ═══');

  // A1: Config endpoint works with valid admin_secret
  const { status: s1, json: j1 } = await post('/admin/config', { admin_secret: ADMIN_SECRET });
  assert('A1 Config returns 200', s1 === 200, `status=${s1}`);
  assert('A1 Config has trust_thresholds', j1?.data?.trust_thresholds?.degraded === 0.6, JSON.stringify(j1?.data?.trust_thresholds));
  assert('A1 Config has alert_thresholds', j1?.data?.alert_thresholds?.severe_count_24h === 1, JSON.stringify(j1?.data?.alert_thresholds));
  assert('A1 Phase is 27', j1?.data?.phase === 27, `phase=${j1?.data?.phase}`);

  // A2: Admin endpoint rejects missing admin_secret
  const { status: s2 } = await post('/admin/config', { dummy: true });
  assert('A2 Missing admin_secret → 401', s2 === 401, `status=${s2}`);

  // A3: Admin endpoint rejects wrong admin_secret
  const { status: s3 } = await post('/admin/config', { admin_secret: 'wrong-secret-value' });
  assert('A3 Wrong admin_secret → 401', s3 === 401, `status=${s3}`);
}

// ── SECTION B: Trust Alert Generation ──
async function sectionB() {
  console.log('\n═══ Section B: Trust Alert Generation ═══');

  const { userId, deviceId } = await createTestUser('alert');

  // B1: Inject severe anomalies via admin endpoint
  const ids = [];
  for (let i = 0; i < 2; i++) {
    const { status, json } = await post('/admin/inject-anomaly', {
      admin_secret: ADMIN_SECRET,
      user_id: userId,
      device_id: deviceId,
      anomaly_type: 'subscription_abuse',
      severity: 0.40,
      metadata: { test: true, iteration: i },
    });
    if (status === 200 && json?.data?.anomaly_id) ids.push(json.data.anomaly_id);
    else console.log(`  ⚠️  inject-anomaly returned ${status}: ${JSON.stringify(json)}`);
  }
  assert('B1 Injected 2 severe anomalies', ids.length === 2, `count=${ids.length}`);

  // Set anomaly_score via admin
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    anomaly_score: 0.5,
  });

  // B2: Trigger threshold check via admin
  const { status: s2, json: j2 } = await post('/admin/check-thresholds', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    device_id: deviceId,
  });
  assert('B2 Alert generated', j2?.data?.alerted === true, JSON.stringify(j2?.data));
  assert('B2 Alert type is severe_anomaly_threshold or trust_degraded',
    ['severe_anomaly_threshold', 'trust_degraded'].includes(j2?.data?.alertType),
    `type=${j2?.data?.alertType}`);

  // B3: Dedup — calling again within 1h should not create duplicate
  const { json: j3 } = await post('/admin/check-thresholds', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    device_id: deviceId,
  });
  assert('B3 Dedup prevents duplicate alert', j3?.data?.alerted === false, JSON.stringify(j3?.data));

  // B4: Verify alert exists via admin alerts endpoint
  const { json: j4 } = await post('/admin/alerts', {
    admin_secret: ADMIN_SECRET,
    status: 'open',
    user_id: userId,
  });
  assert('B4 Alert exists in DB', (j4?.data?.alerts?.length || 0) >= 1, `count=${j4?.data?.alerts?.length}`);

  // B5: Soft block alert — set effective trust to 0.2 (anomaly_score 0.8, trust 1.0)
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    anomaly_score: 0.8,
  });
  const { json: j5 } = await post('/admin/check-thresholds', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    device_id: deviceId,
  });
  assert('B5 Soft block alert generated', j5?.data?.alerted === true, JSON.stringify(j5?.data));
  assert('B5 Alert type is trust_soft_block', j5?.data?.alertType === 'trust_soft_block', `type=${j5?.data?.alertType}`);

  // Store alert IDs and userId for sections D, E
  const { json: allAlerts } = await post('/admin/alerts', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
  });
  global.__testAlertIds = (allAlerts?.data?.alerts || []).map(a => a.id);
  global.__testUserId = userId;
  global.__testDeviceId = deviceId;
}

// ── SECTION C: Soft Enforcement ──
async function sectionC() {
  console.log('\n═══ Section C: Soft Enforcement ═══');

  const { userId, deviceId, deviceToken } = await createTestUser('enforce');

  if (!deviceToken) {
    assert('C-SETUP Device registration', false, 'No device_token returned — challenge-response may have failed');
    return;
  }

  // C1: trustCheck middleware with degraded score (0.3 ≤ effective < 0.6)
  // Set anomaly_score to 0.5 → effective = 1.0 - 0.5 = 0.5 (degraded)
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    anomaly_score: 0.5,
  });

  const { status: subStatus, json: subJson } = await post('/verify/subscription', {
    user_id: userId,
    device_id: deviceId,
    device_token: deviceToken,
  });
  // Should NOT be 403 — that's the Phase 27 change
  assert('C1 Degraded user NOT blocked (no hard 403)',
    subStatus !== 403 || (subJson?.error && !subJson.error.includes('suspended')),
    `status=${subStatus} error=${subJson?.error}`);

  // C2: With very high anomaly score (effective < 0.3 = soft block)
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    anomaly_score: 0.8,
  });

  const { status: subStatus2, json: subJson2 } = await post('/verify/subscription', {
    user_id: userId,
    device_id: deviceId,
    device_token: deviceToken,
  });
  // Phase 27: soft block — should NOT return 403 (passes through)
  assert('C2 Soft-blocked user NOT hard-blocked',
    subStatus2 !== 403 || (subJson2?.error && !subJson2.error.includes('suspended')),
    `status=${subStatus2} error=${subJson2?.error}`);

  // Cleanup
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    anomaly_score: 0,
  });
}

// ── SECTION D: Admin Alert Management ──
async function sectionD() {
  console.log('\n═══ Section D: Admin Alert Management ═══');

  const alertIds = global.__testAlertIds || [];
  const userId = global.__testUserId;

  // D1: List alerts
  const { status: s1, json: j1 } = await post('/admin/alerts', {
    admin_secret: ADMIN_SECRET,
    status: 'open',
    user_id: userId,
  });
  assert('D1 List alerts returns 200', s1 === 200, `status=${s1}`);
  assert('D1 Alerts found', (j1?.data?.alerts?.length || 0) >= 1, `count=${j1?.data?.count}`);

  // D2: Alert has derived severity
  if (j1?.data?.alerts?.[0]) {
    assert('D2 Alert has severity', typeof j1.data.alerts[0].severity === 'string', `sev=${j1.data.alerts[0].severity}`);
  }

  // D3: Acknowledge alert (if we have one)
  if (alertIds.length > 0) {
    const { status: s3, json: j3 } = await post('/admin/alert/acknowledge', {
      admin_secret: ADMIN_SECRET,
      alert_id: alertIds[0],
    });
    assert('D3 Acknowledge returns 200', s3 === 200, `status=${s3}`);
  }

  // D4: Resolve alert
  if (alertIds.length > 0) {
    const { status: s4, json: j4 } = await post('/admin/alert/resolve', {
      admin_secret: ADMIN_SECRET,
      alert_id: alertIds[0],
      notes: 'Resolved during Phase 27 integration test',
    });
    assert('D4 Resolve returns 200', s4 === 200, `status=${s4}`);
  }

  // D5: Resolve same alert again → 409
  if (alertIds.length > 0) {
    const { status: s5 } = await post('/admin/alert/resolve', {
      admin_secret: ADMIN_SECRET,
      alert_id: alertIds[0],
    });
    assert('D5 Double-resolve → 409', s5 === 409, `status=${s5}`);
  }

  // D6: Escalate second alert (if exists)
  if (alertIds.length > 1) {
    const { status: s6, json: j6 } = await post('/admin/alert/escalate', {
      admin_secret: ADMIN_SECRET,
      alert_id: alertIds[1],
      reason: 'Escalated during Phase 27 test',
    });
    assert('D6 Escalate returns 200', s6 === 200, `status=${s6}`);
  }

  // D7: Get anomaly log
  if (userId) {
    const { status: s7, json: j7 } = await post('/admin/anomaly-log', {
      admin_secret: ADMIN_SECRET,
      user_id: userId,
      since_hours: 1,
    });
    assert('D7 Anomaly log returns 200', s7 === 200, `status=${s7}`);
    assert('D7 Has effective_trust', typeof j7?.data?.effective_trust === 'number', JSON.stringify(j7?.data));
  }
}

// ── SECTION E: Admin Trust Management ──
async function sectionE() {
  console.log('\n═══ Section E: Admin Trust Management ═══');

  const { userId, deviceId } = await createTestUser('mgmt');

  // Set degraded state via admin
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    anomaly_score: 0.5,
  });

  // E1: Trust-scores endpoint shows degraded user
  const { status: s1, json: j1 } = await post('/admin/trust-scores', {
    admin_secret: ADMIN_SECRET,
  });
  assert('E1 Trust-scores returns 200', s1 === 200, `status=${s1}`);

  // E2: Override trust
  const { status: s2, json: j2 } = await post('/admin/trust-override', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
  });
  assert('E2 Trust-override returns 200', s2 === 200, `status=${s2}`);
  assert('E2 Override clears anomaly (effective ≥ 0.6)', (j2?.data?.effective_trust || 0) >= 0.6, `effective=${j2?.data?.effective_trust}`);

  // E3: Degrade again then full reset
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    anomaly_score: 0.7,
    trust_score: 0.5,
  });

  const { status: s3, json: j3 } = await post('/admin/trust-reset', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
  });
  assert('E3 Trust-reset returns 200', s3 === 200, `status=${s3}`);
  assert('E3 Trust reset to 1.0', j3?.data?.trust_score === 1.0, `trust=${j3?.data?.trust_score}`);
  assert('E3 Anomaly reset to 0', j3?.data?.anomaly_score === 0, `anomaly=${j3?.data?.anomaly_score}`);

  // E4: Reset nonexistent user → 404
  const { status: s4 } = await post('/admin/trust-reset', {
    admin_secret: ADMIN_SECRET,
    user_id: 'nonexistent-user-xyz',
  });
  assert('E4 Reset nonexistent user → 404', s4 === 404, `status=${s4}`);
}

// ── SECTION F: Health Check + Phase ──
async function sectionF() {
  console.log('\n═══ Section F: Health Check + Phase Verification ═══');

  const { status, json } = await get('/health');
  assert('F1 Health check returns 200', status === 200, `status=${status}`);
  assert('F2 Version is 5.0.0', json?.data?.version === '5.0.0', `version=${json?.data?.version}`);
  assert('F3 Phase is 27', json?.data?.phase === 27, `phase=${json?.data?.phase}`);
  assert('F4 Status is operational', json?.data?.status === 'operational', `status=${json?.data?.status}`);
}

// ── Main ──
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Phase 27 Integration Tests — Trust Decay + Alerting    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Admin secret: ${ADMIN_SECRET ? '***' + ADMIN_SECRET.slice(-4) : 'NOT SET'}`);

  try {
    await sectionA();
    await sectionB();
    await sectionC();
    await sectionD();
    await sectionE();
    await sectionF();
  } catch (err) {
    console.error('\n💥 FATAL ERROR:', err.message);
    fail++;
  }

  // ── Cleanup: reset trust state for test users ──
  // We don't need full DB cleanup — retention cycle handles old test data.
  // Just reset trust state to not pollute future test runs.
  console.log('\n🧹 Cleanup skipped (test data is ephemeral).');

  // ── Summary ──
  console.log('\n════════════════════════════════════');
  console.log(`  PASS: ${pass}   FAIL: ${fail}   TOTAL: ${pass + fail}`);
  console.log('════════════════════════════════════');

  if (fail > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.label}: ${r.detail}`);
    });
  }

  process.exit(fail > 0 ? 1 : 0);
}

// Error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught:', err.message);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled:', err?.message || err);
  process.exit(1);
});

main();
