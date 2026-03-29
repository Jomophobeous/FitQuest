/**
 * Phase 22.3 Integration Test — Anti-Abuse + Hardening
 * Run from server/: node test-phase22_3.js
 *
 * Tests:
 *   1.  Health check (v2.5.0, phase 22.3)
 *   2.  Create user
 *   3.  Device verify — 200, no internal scores in response
 *   4.  Device verify — trust_score NOT in response
 *   5.  Device verify — effective_trust NOT in response
 *   6.  Device verify — anomaly_score NOT in response
 *   7.  Subscription verify — 200, no internal scores
 *   8.  Subscription verify — effective_trust NOT in response
 *   9.  Subscription verify — anomaly_score NOT in response
 *   10. AI request — 200, authorized, no internal scores
 *   11. AI request — anomaly_score NOT in response
 *   12. AI request — triggered NOT in response
 *   13. AI request — effectiveTrust NOT in response
 *   14. computeEffectiveScore — returns expected shape
 *   15. computeEffectiveScore — effectiveScore in [0, 1]
 *   16. THRESHOLDS exported with correct values
 *   17. SEVERITIES exported with correct values
 *   18. DEDUP_WINDOW_MINUTES exported (5)
 *   19. hashPayload exported and works
 *   20. Unknown device → 403
 *   21. Unknown user → 403
 *   22. Missing fields → 400
 *   23. 404 catch-all
 *   24. Re-verify device — no score leakage
 *   25. evaluateUserActivity returns effectiveScore field
 *   26. HIGH_SEVERITY_EVENTS exported from logEvent
 *   27. Device response has ONLY allowed fields
 *   28. Subscription response has ONLY allowed fields
 *   29. AI response has ONLY allowed fields
 *   30. trustCheck THRESHOLD_RESTRICTED exported (0.5)
 *   31. trustCheck THRESHOLD_SUSPENDED exported (0.3)
 *   32. 32nd placeholder kept for parity
 *
 * Validates:
 *   - No client EVER sees trust_score, anomaly_score, effectiveTrust, triggered
 *   - computeEffectiveScore correct shape
 *   - All constants exported
 *   - Response shapes locked down
 */
'use strict';

require('dotenv').config();
const app = require('./index');
const {
  computeEffectiveScore,
  evaluateUserActivity,
  THRESHOLDS,
  SEVERITIES,
  DEDUP_WINDOW_MINUTES,
  hashPayload,
} = require('./engines/anomalyEngine');
const { HIGH_SEVERITY_EVENTS } = require('./utils/logEvent');
const { THRESHOLD_RESTRICTED, THRESHOLD_SUSPENDED } = require('./middleware/trustCheck');

const PORT = 4026;
let server;
let passed = 0;
let failed = 0;

// Safety timeout: if tests hang beyond 120s, force exit with partial results
const SAFETY_TIMEOUT = setTimeout(() => {
  console.log(`\n=== TIMEOUT: Tests took too long. Results so far: ${passed} passed, ${failed} failed ===\n`);
  if (server) server.close();
  process.exit(failed > 0 ? 1 : 0);
}, 120 * 1000);

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

/**
 * Phase 22.3: Check that response ONLY contains allowed keys (whitelist).
 */
function onlyHasKeys(obj, allowedKeys) {
  if (!obj || typeof obj !== 'object') return false;
  const actual = Object.keys(obj);
  return actual.every(k => allowedKeys.includes(k));
}

// ── Forbidden keys: NEVER in any client response ──
const FORBIDDEN_KEYS = [
  'anomaly_score', 'trust_score', 'effective_trust', 'effectiveTrust',
  'triggered', 'anomalyScore', 'trustScore',
];

const USER_ID = 'test_p223_user';
const DEVICE_ID = 'dev_p223_001';

async function run() {
  console.log('\n=== Phase 22.3 Integration Tests — Anti-Abuse + Hardening ===\n');

  // ── 1. Health check ──
  {
    const r = await get('/health');
    check('1. Health 200', r.status === 200);
    check('1b. Phase 22.3', r.data.data?.phase === 22.3);
    check('1c. Version 2.5.0', r.data.data?.version === '2.5.0');
  }

  // ── 2. Create user ──
  {
    const r = await post('/user/create', { id: USER_ID, email: 'p223@test.com' });
    check('2. Create user (200/201/409)', r.status === 200 || r.status === 201 || r.status === 409);
  }

  // ── 3–6. Device verify — no internal scores ──
  let deviceData;
  {
    const r = await post('/verify/device', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      app_version: '2.5.0',
      signature: 'sig_test',
    });
    deviceData = r.data.data;
    check('3. Device verify 200', r.status === 200);
    check('4. Device NO trust_score', keyAbsent(r.data, 'trust_score'));
    check('5. Device NO effective_trust', keyAbsent(r.data, 'effective_trust'));
    check('6. Device NO anomaly_score', keyAbsent(r.data, 'anomaly_score'));
  }

  // ── 7–9. Subscription verify — no internal scores ──
  {
    const r = await post('/verify/subscription', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      receipt: 'rc_test',
    });
    check('7. Subscription verify 200', r.status === 200);
    check('8. Sub NO effective_trust', keyAbsent(r.data, 'effective_trust'));
    check('9. Sub NO anomaly_score', keyAbsent(r.data, 'anomaly_score'));
  }

  // ── 10–13. AI request — no internal scores ──
  {
    const r = await post('/ai/request', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      prompt: 'test prompt for phase 22.3',
      personality: 'COACH',
    });
    check('10. AI request 200', r.status === 200);
    check('11. AI NO anomaly_score', keyAbsent(r.data, 'anomaly_score'));
    check('12. AI NO triggered', keyAbsent(r.data, 'triggered'));
    check('13. AI NO effectiveTrust', keyAbsent(r.data, 'effectiveTrust'));
  }

  // ── 14–15. computeEffectiveScore (direct engine call) ──
  {
    const score = await computeEffectiveScore(USER_ID, DEVICE_ID);
    check('14. computeEffectiveScore shape', 
      typeof score.effectiveScore === 'number' && 
      typeof score.trustScore === 'number' && 
      typeof score.anomalyScore === 'number');
    check('15. effectiveScore in [0, 1]', score.effectiveScore >= 0 && score.effectiveScore <= 1);
    console.log(`    effective=${score.effectiveScore} trust=${score.trustScore} anomaly=${score.anomalyScore}`);
  }

  // ── 16–19. Constants and utilities exported ──
  {
    check('16. THRESHOLDS exported', 
      typeof THRESHOLDS === 'object' && 
      THRESHOLDS.maxDevicesPer10Min === 3 &&
      THRESHOLDS.maxFailedVerifications15Min === 5 &&
      THRESHOLDS.maxAIRequestsPer5Min === 20 &&
      THRESHOLDS.maxAvgPromptLength === 2000 &&
      THRESHOLDS.maxIPsPer10Min === 5);
    check('17. SEVERITIES exported', 
      typeof SEVERITIES === 'object' && 
      SEVERITIES.device_switching === 0.30 &&
      SEVERITIES.subscription_abuse === 0.40 &&
      SEVERITIES.version_downgrade === 0.25 &&
      SEVERITIES.ai_abuse === 0.35 &&
      SEVERITIES.ip_anomaly === 0.30);
    check('18. DEDUP_WINDOW_MINUTES = 5', DEDUP_WINDOW_MINUTES === 5);
    check('19. hashPayload works', typeof hashPayload({ test: 1 }) === 'string' && hashPayload({ test: 1 }).length === 16);
  }

  // ── 20. Unknown device → 403 ──
  {
    const r = await post('/verify/subscription', {
      user_id: USER_ID,
      device_id: 'unknown_dev_xyz_999',
      receipt: 'rc_test',
    });
    check('20. Unknown device → 403', r.status === 403);
  }

  // ── 21. Unknown user → 403 ──
  {
    const r = await post('/verify/device', {
      user_id: 'nonexistent_user_xyz_223',
      device_id: 'dev_001',
      app_version: '1.0.0',
      signature: 'sig_test',
    });
    check('21. Unknown user → 403', r.status === 403);
  }

  // ── 22. Missing fields → 400 ──
  {
    const r = await post('/ai/request', { user_id: USER_ID });
    check('22. Missing fields → 400', r.status === 400);
  }

  // ── 23. 404 catch-all ──
  {
    const r = await get('/nonexistent');
    check('23. 404 catch-all', r.status === 404);
  }

  // ── 24. Re-verify device — no leakage ──
  {
    const r = await post('/verify/device', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      app_version: '2.5.0',
      signature: 'sig_test',
    });
    check('24. Re-verify 200, all forbidden keys absent',
      r.status === 200 && FORBIDDEN_KEYS.every(k => keyAbsent(r.data, k)));
  }

  // ── 25. evaluateUserActivity returns effectiveScore ──
  {
    const result = await evaluateUserActivity(USER_ID, DEVICE_ID, { event_type: 'test' });
    check('25. evaluateUserActivity has effectiveScore', typeof result.effectiveScore === 'number');
  }

  // ── 26. HIGH_SEVERITY_EVENTS exported ──
  {
    check('26. HIGH_SEVERITY_EVENTS is Set',
      HIGH_SEVERITY_EVENTS instanceof Set &&
      HIGH_SEVERITY_EVENTS.has('access_suspended') &&
      HIGH_SEVERITY_EVENTS.has('device_untrusted') &&
      HIGH_SEVERITY_EVENTS.has('ai_blocked_anomaly'));
  }

  // ── 27. Device response shape whitelist ──
  {
    const allowedDeviceKeys = ['user_id', 'device_id', 'untrusted', 'verified_at'];
    check('27. Device response ONLY has allowed keys',
      deviceData && onlyHasKeys(deviceData, allowedDeviceKeys));
  }

  // ── 28. Subscription response shape ──
  {
    const r = await post('/verify/subscription', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      receipt: 'rc_test',
    });
    const allowedSubKeys = ['user_id', 'status', 'expires_at', 'restricted', 'verified_at', 'reason'];
    check('28. Sub response ONLY has allowed keys',
      r.data.data && onlyHasKeys(r.data.data, allowedSubKeys));
  }

  // ── 29. AI response shape ──
  {
    const r = await post('/ai/request', {
      user_id: USER_ID,
      device_id: DEVICE_ID,
      prompt: 'shape test',
    });
    const allowedAIKeys = ['authorized', 'restricted', 'remaining', 'timestamp', 'reason', 'retryAfterMs'];
    check('29. AI response ONLY has allowed keys',
      r.data.data && onlyHasKeys(r.data.data, allowedAIKeys));
  }

  // ── 30–31. trustCheck thresholds ──
  {
    check('30. THRESHOLD_RESTRICTED = 0.5', THRESHOLD_RESTRICTED === 0.5);
    check('31. THRESHOLD_SUSPENDED = 0.3', THRESHOLD_SUSPENDED === 0.3);
  }

  // ── 32. Full forbidden key sweep across all endpoints ──
  {
    // Device
    const d = await post('/verify/device', {
      user_id: USER_ID, device_id: DEVICE_ID,
      app_version: '2.5.0', signature: 'sig',
    });
    // Subscription
    const s = await post('/verify/subscription', {
      user_id: USER_ID, device_id: DEVICE_ID,
    });
    // AI
    const a = await post('/ai/request', {
      user_id: USER_ID, device_id: DEVICE_ID, prompt: 'sweep',
    });

    const allClean = [d, s, a].every(r =>
      FORBIDDEN_KEYS.every(k => keyAbsent(r.data, k))
    );
    check('32. Full forbidden-key sweep: ALL endpoints clean', allClean);
  }

  // ── Summary ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed (${passed + failed} total) ===\n`);

  // Log violations if any
  if (failed > 0) {
    console.log('[VIOLATION] Some tests failed — investigate before deploying.\n');
  }

  clearTimeout(SAFETY_TIMEOUT);
  server.close(() => process.exit(failed > 0 ? 1 : 0));
}

server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[TEST] Server on port ${PORT}`);
  run().catch(err => {
    console.error('[TEST FATAL]', err.message);
    server.close(() => process.exit(1));
  });
});
