/**
 * Phase 22.2 Integration Test — Anomaly Engine Hardening
 * Run from server/: node test-phase22_2.js
 *
 * Tests:
 *   1.  Health check (v2.4.0, phase 22.2)
 *   2.  Create user
 *   3.  Device verify — 200, has expected fields
 *   4.  Device verify — anomaly_score NOT in response
 *   5.  Subscription verify — 200, has expected fields
 *   6.  Subscription verify — anomaly_score NOT in response
 *   7.  AI request — 200, authorized
 *   8.  AI request — anomaly_score NOT in response
 *   9.  AI request — triggered NOT in response (hidden per 22.2)
 *   10. computeEffectiveScore — returns expected shape
 *   11. Unknown device → 403
 *   12. Unknown user → 403
 *   13. Missing fields → 400
 *   14. 404 catch-all
 *   15. Re-verify device — persistence check, no anomaly_score leak
 */
'use strict';

require('dotenv').config();
const app = require('./index');
const { computeEffectiveScore, THRESHOLDS, SEVERITIES } = require('./engines/anomalyEngine');

const PORT = 4024;
let server;
let passed = 0;
let failed = 0;

async function post(path, body) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function get(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return { status: res.status, data: await res.json() };
}

function check(name, condition) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
}

/**
 * Recursively checks that a key does NOT exist anywhere in an object.
 */
function keyAbsent(obj, key) {
  if (obj == null || typeof obj !== 'object') return true;
  if (Array.isArray(obj)) return obj.every(item => keyAbsent(item, key));
  if (key in obj) return false;
  return Object.values(obj).every(v => keyAbsent(v, key));
}

const USER_ID = 'test_p222_user';
const DEVICE_ID = 'dev_p222_001';

async function run() {
  console.log('\n=== Phase 22.2 Integration Tests ===\n');

  // ── 1. Health check ──
  {
    const r = await get('/health');
    check('Health 200', r.status === 200);
    check('Phase 22.2', r.data.data?.phase === 22.2);
    check('Version 2.4.0', r.data.data?.version === '2.4.0');
  }

  // ── 2. Create user ──
  {
    const r = await post('/user/create', { id: USER_ID, email: 'p222@test.com' });
    check('Create user (200/201/409)', r.status === 200 || r.status === 201 || r.status === 409);
  }

  // ── 3–4. Device verify ──
  {
    const r = await post('/verify/device', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      app_version: '2.4.0',
      signature: 'sig_test',
    });
    check('Device verify 200', r.status === 200);
    check('Device has trust_score', typeof r.data.data?.trust_score === 'number');
    check('Device has effective_trust', typeof r.data.data?.effective_trust === 'number');
    check('Device has untrusted', typeof r.data.data?.untrusted === 'boolean');
    check('Device NO anomaly_score', keyAbsent(r.data, 'anomaly_score'));
    check('Device NO triggered', keyAbsent(r.data, 'triggered'));
    console.log(`    trust=${r.data.data?.trust_score} effective=${r.data.data?.effective_trust}`);
  }

  // ── 5–6. Subscription verify ──
  {
    const r = await post('/verify/subscription', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      receipt: 'rc_test',
    });
    check('Subscription verify 200', r.status === 200);
    check('Sub has effective_trust', typeof r.data.data?.effective_trust === 'number');
    check('Sub NO anomaly_score', keyAbsent(r.data, 'anomaly_score'));
    console.log(`    effective_trust=${r.data.data?.effective_trust}`);
  }

  // ── 7–9. AI request ──
  {
    const r = await post('/ai/request', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      prompt: 'test prompt for phase 22.2',
      personality: 'COACH',
    });
    check('AI request 200', r.status === 200);
    check('AI authorized', r.data.data?.authorized === true);
    check('AI has remaining', typeof r.data.data?.remaining === 'number');
    check('AI NO anomaly_score', keyAbsent(r.data, 'anomaly_score'));
    check('AI NO triggered', keyAbsent(r.data, 'triggered'));
    check('AI NO effective_trust', keyAbsent(r.data, 'effective_trust'));
  }

  // ── 10. computeEffectiveScore (direct engine call) ──
  {
    const score = await computeEffectiveScore(USER_ID, DEVICE_ID);
    check('computeEffectiveScore has effectiveScore', typeof score.effectiveScore === 'number');
    check('computeEffectiveScore has trustScore', typeof score.trustScore === 'number');
    check('computeEffectiveScore has anomalyScore', typeof score.anomalyScore === 'number');
    check('effectiveScore in [0, 1]', score.effectiveScore >= 0 && score.effectiveScore <= 1);
    check('THRESHOLDS exported', typeof THRESHOLDS === 'object' && THRESHOLDS.maxDevicesPer10Min === 3);
    check('SEVERITIES exported', typeof SEVERITIES === 'object' && SEVERITIES.device_switching === 0.30);
    console.log(`    effective=${score.effectiveScore} trust=${score.trustScore} anomaly=${score.anomalyScore}`);
  }

  // ── 11. Unknown device → 403 ──
  {
    const r = await post('/verify/subscription', {
      user_id: USER_ID,
      device_id: 'unknown_dev_xyz_999',
      receipt: 'rc_test',
    });
    check('Unknown device → 403', r.status === 403);
  }

  // ── 12. Unknown user → 403 ──
  {
    const r = await post('/verify/device', {
      user_id: 'nonexistent_user_xyz_222',
      device_id: 'dev_001',
      app_version: '1.0.0',
      signature: 'sig_test',
    });
    check('Unknown user → 403', r.status === 403);
  }

  // ── 13. Missing fields → 400 ──
  {
    const r = await post('/ai/request', {
      user_id: USER_ID,
    });
    check('Missing fields → 400', r.status === 400);
  }

  // ── 14. 404 catch-all ──
  {
    const r = await get('/nonexistent');
    check('404 catch-all', r.status === 404);
  }

  // ── 15. Re-verify device ──
  {
    const r = await post('/verify/device', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      app_version: '2.4.0',
      signature: 'sig_test',
    });
    check('Re-verify 200', r.status === 200);
    check('Re-verify has effective_trust', typeof r.data.data?.effective_trust === 'number');
    check('Re-verify NO anomaly_score', keyAbsent(r.data, 'anomaly_score'));
  }

  // ── Summary ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed (${passed + failed} total) ===\n`);

  server.close(() => process.exit(failed > 0 ? 1 : 0));
}

server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[TEST] Server on port ${PORT}`);
  run().catch(err => {
    console.error('[TEST FATAL]', err.message);
    server.close(() => process.exit(1));
  });
});
