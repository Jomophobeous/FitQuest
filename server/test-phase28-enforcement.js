#!/usr/bin/env node
/**
 * Phase 28 Integration Tests — Enforcement Layer
 *
 * Test sections:
 *   A. Enforcement config & access profiles
 *   B. Feature gating (LOCKDOWN → 403, SOFT_RESTRICT → restricted)
 *   C. Admin enforcement routes (force-profile, enforcement-status, clear-override)
 *   D. Token revocation & reinstatement
 *   E. Trust recovery
 *   F. Adaptive penalty (unit)
 *   G. Health check + phase verification
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
const results = [];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
    // Auto-retry once on 429
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

// ── Helper: create a test user with full challenge-response device registration ──
async function createTestUser(suffix) {
  const userId = `test-phase28-${suffix}-${Date.now()}`;
  const email = `${userId}@test.fitquest.dev`;
  const deviceId = `device-phase28-${suffix}-${Date.now()}`;
  const appVersion = '1.0.0';

  // Retry user creation if rate-limited
  let userStatus;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await post('/user/create', { id: userId, email });
    userStatus = r.status;
    if (userStatus !== 429) break;
    console.log(`  ⏳ User create rate-limited, waiting 15s (attempt ${attempt + 1})…`);
    await sleep(15000);
  }
  if (userStatus !== 200 && userStatus !== 201) {
    console.log(`  ⚠️  User create returned ${userStatus} for ${userId}`);
  }

  let deviceToken = null;
  const { status: chalStatus, json: chalJson } = await post('/auth/challenge', {
    user_id: userId,
    device_id: deviceId,
  });

  if (chalStatus === 200 && chalJson?.data?.nonce) {
    const { challenge_id, nonce } = chalJson.data;
    const response = crypto.createHash('sha256')
      .update(`${nonce}${deviceId}${appVersion}`)
      .digest('hex');

    const { status: verStatus } = await post('/auth/verify', {
      challenge_id,
      response,
      app_version: appVersion,
    });

    if (verStatus === 200) {
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

// ══════════════════════════════════════════════════════════════
// SECTION A: Enforcement Config & Access Profiles
// ══════════════════════════════════════════════════════════════
async function sectionA() {
  console.log('\n═══ Section A: Enforcement Config & Access Profiles ═══');

  // A1: Config returns Phase 28 with trust_bands and access_profiles
  const { status: s1, json: j1 } = await post('/admin/config', { admin_secret: ADMIN_SECRET });
  assert('A1 Config returns 200', s1 === 200, `status=${s1}`);
  assert('A1 Phase is 28', j1?.data?.phase === 28, `phase=${j1?.data?.phase}`);
  assert('A1 Has trust_bands', j1?.data?.trust_bands?.SAFE === 0.8, JSON.stringify(j1?.data?.trust_bands));
  assert('A1 Has trust_bands.WATCH', j1?.data?.trust_bands?.WATCH === 0.6, JSON.stringify(j1?.data?.trust_bands));
  assert('A1 Has trust_bands.RESTRICTED', j1?.data?.trust_bands?.RESTRICTED === 0.4, JSON.stringify(j1?.data?.trust_bands));
  assert('A1 Has trust_bands.CRITICAL', j1?.data?.trust_bands?.CRITICAL === 0.2, JSON.stringify(j1?.data?.trust_bands));
  assert('A1 Has access_profiles', Array.isArray(j1?.data?.access_profiles) && j1.data.access_profiles.length === 5, `profiles=${JSON.stringify(j1?.data?.access_profiles)}`);
  assert('A1 access_profiles includes LOCKDOWN', j1?.data?.access_profiles?.includes('LOCKDOWN'), `profiles=${JSON.stringify(j1?.data?.access_profiles)}`);

  // A2: Admin auth still works — missing secret → 401
  const { status: s2 } = await post('/admin/config', { dummy: true });
  assert('A2 Missing admin_secret → 401', s2 === 401, `status=${s2}`);

  // A3: Wrong secret → 401
  const { status: s3 } = await post('/admin/config', { admin_secret: 'wrong-secret-value' });
  assert('A3 Wrong admin_secret → 401', s3 === 401, `status=${s3}`);
}

// ══════════════════════════════════════════════════════════════
// SECTION B: Feature Gating (LOCKDOWN → 403)
// ══════════════════════════════════════════════════════════════
async function sectionB() {
  console.log('\n═══ Section B: Feature Gating ═══');

  const { userId, deviceId, deviceToken } = await createTestUser('gate');

  // B1: User starts with FULL access — verify subscription works
  const { status: s1, json: j1 } = await post('/verify/subscription', {
    user_id: userId,
    device_id: deviceId,
    device_token: deviceToken,
  });
  assert('B1 FULL user can verify subscription', s1 === 200, `status=${s1} json=${JSON.stringify(j1)}`);

  // B2: Drop trust to LOCKDOWN range (< 0.2)
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    trust_score: 0.1,
    anomaly_score: 0.0,
  });

  // B3: LOCKDOWN user gets 403 on subscription endpoint
  const { status: s3, json: j3 } = await post('/verify/subscription', {
    user_id: userId,
    device_id: deviceId,
    device_token: deviceToken,
  });
  assert('B3 LOCKDOWN → 403', s3 === 403, `status=${s3} json=${JSON.stringify(j3)}`);

  // B4: Drop trust to SOFT_RESTRICT range (0.4–0.59) — still allowed through trustCheck
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    trust_score: 0.5,
    anomaly_score: 0.0,
  });
  const { status: s4 } = await post('/verify/subscription', {
    user_id: userId,
    device_id: deviceId,
    device_token: deviceToken,
  });
  assert('B4 SOFT_RESTRICT passes trustCheck (200)', s4 === 200, `status=${s4}`);

  // B5: Verify accessProfile is attached — check via enforcement-status admin route
  const { status: s5, json: j5 } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
  });
  assert('B5 Enforcement status returns 200', s5 === 200, `status=${s5}`);
  assert('B5 Access profile is SOFT_RESTRICT', j5?.data?.accessProfile === 'SOFT_RESTRICT', `profile=${j5?.data?.accessProfile}`);
  assert('B5 featureGate has rate_limit_multiplier 0.5', j5?.data?.featureGate?.rate_limit_multiplier === 0.5, `gate=${JSON.stringify(j5?.data?.featureGate)}`);

  // B6: HARD_RESTRICT range (0.2–0.39)
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    trust_score: 0.3,
    anomaly_score: 0.0,
  });
  const { status: s6, json: j6 } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
  });
  assert('B6 HARD_RESTRICT profile', j6?.data?.accessProfile === 'HARD_RESTRICT', `profile=${j6?.data?.accessProfile}`);
  assert('B6 HARD_RESTRICT blocks AI', j6?.data?.featureGate?.ai_access === false, `ai_access=${j6?.data?.featureGate?.ai_access}`);
  assert('B6 HARD_RESTRICT blocks premium', j6?.data?.featureGate?.premium_features === false, `premium=${j6?.data?.featureGate?.premium_features}`);

  // B7: Reset user for cleanup
  await post('/admin/trust-reset', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
  });
}

// ══════════════════════════════════════════════════════════════
// SECTION C: Admin Enforcement Routes
// ══════════════════════════════════════════════════════════════
async function sectionC() {
  console.log('\n═══ Section C: Admin Enforcement Routes ═══');

  const { userId } = await createTestUser('enforce');

  // C1: Force profile to FULL override
  const { status: s1, json: j1 } = await post('/admin/force-profile', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    profile: 'FULL',
    reason: 'test_override',
  });
  assert('C1 Force profile returns 200', s1 === 200, `status=${s1}`);
  assert('C1 Force profile → FULL', j1?.data?.forced_profile === 'FULL', `profile=${j1?.data?.forced_profile}`);
  assert('C1 Has expires_at', typeof j1?.data?.expires_at === 'string', `expires_at=${j1?.data?.expires_at}`);

  // C2: Enforcement status shows override active
  const { status: s2, json: j2 } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
  });
  assert('C2 Status shows override', j2?.data?.override === true, `override=${j2?.data?.override}`);
  assert('C2 Profile is FULL (overridden)', j2?.data?.accessProfile === 'FULL', `profile=${j2?.data?.accessProfile}`);

  // C3: Even with low trust, override forces FULL
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    trust_score: 0.1,
    anomaly_score: 0.0,
  });
  const { status: s3, json: j3 } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
  });
  assert('C3 Override persists with low trust', j3?.data?.accessProfile === 'FULL', `profile=${j3?.data?.accessProfile}`);

  // C4: Clear override
  const { status: s4, json: j4 } = await post('/admin/clear-override', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
  });
  assert('C4 Clear returns 200', s4 === 200, `status=${s4}`);
  assert('C4 Override was cleared', j4?.data?.cleared === true, `cleared=${j4?.data?.cleared}`);

  // C5: After clear, low trust → LOCKDOWN
  const { status: s5, json: j5 } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
  });
  assert('C5 No override, low trust → LOCKDOWN', j5?.data?.accessProfile === 'LOCKDOWN', `profile=${j5?.data?.accessProfile}`);
  assert('C5 Override is false', j5?.data?.override === false, `override=${j5?.data?.override}`);

  // C6: Invalid profile → 400
  const { status: s6 } = await post('/admin/force-profile', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    profile: 'INVALID_PROFILE',
  });
  assert('C6 Invalid profile → 400', s6 === 400, `status=${s6}`);

  // C7: Missing user_id → 400
  const { status: s7 } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET,
  });
  assert('C7 Missing user_id → 400', s7 === 400, `status=${s7}`);

  // Cleanup
  await post('/admin/trust-reset', { admin_secret: ADMIN_SECRET, user_id: userId });
}

// ══════════════════════════════════════════════════════════════
// SECTION D: Token Revocation & Reinstatement
// ══════════════════════════════════════════════════════════════
async function sectionD() {
  console.log('\n═══ Section D: Token Revocation & Reinstatement ═══');

  const { userId, deviceId, deviceToken } = await createTestUser('token');

  // D1: User can access endpoint before revocation
  const { status: s1 } = await post('/verify/subscription', {
    user_id: userId,
    device_id: deviceId,
    device_token: deviceToken,
  });
  assert('D1 Token valid before revocation', s1 === 200, `status=${s1}`);

  // D2: Revoke all tokens
  const { status: s2, json: j2 } = await post('/admin/revoke-tokens', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    reason: 'TEST_REVOCATION',
  });
  assert('D2 Revoke returns 200', s2 === 200, `status=${s2}`);
  assert('D2 At least 1 token revoked', (j2?.data?.tokens_revoked || 0) >= 1, `revoked=${j2?.data?.tokens_revoked}`);

  // D3: Revoked token → 403 on protected endpoint
  const { status: s3 } = await post('/verify/subscription', {
    user_id: userId,
    device_id: deviceId,
    device_token: deviceToken,
  });
  assert('D3 Revoked token → 403', s3 === 403, `status=${s3}`);

  // D4: Reinstate tokens
  const { status: s4, json: j4 } = await post('/admin/reinstate-tokens', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
  });
  assert('D4 Reinstate returns 200', s4 === 200, `status=${s4}`);
  assert('D4 At least 1 token reinstated', (j4?.data?.tokens_reinstated || 0) >= 1, `reinstated=${j4?.data?.tokens_reinstated}`);

  // D5: Reinstated token works again
  const { status: s5 } = await post('/verify/subscription', {
    user_id: userId,
    device_id: deviceId,
    device_token: deviceToken,
  });
  assert('D5 Reinstated token → 200', s5 === 200, `status=${s5}`);
}

// ══════════════════════════════════════════════════════════════
// SECTION E: Trust Recovery
// ══════════════════════════════════════════════════════════════
async function sectionE() {
  console.log('\n═══ Section E: Trust Recovery ═══');

  const { userId } = await createTestUser('recovery');

  // E1: Set trust low
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    trust_score: 0.5,
    anomaly_score: 0.0,
  });

  // E2: Trigger recovery (10 hours clean)
  const { status: s2, json: j2 } = await post('/admin/trigger-recovery', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    hours_clean: 10,
  });
  assert('E2 Recovery returns 200', s2 === 200, `status=${s2}`);
  assert('E2 Previous trust was 0.5', j2?.data?.previous === 0.5, `previous=${j2?.data?.previous}`);
  assert('E2 Recovery amount is 0.2', j2?.data?.recovered === 0.2, `recovered=${j2?.data?.recovered}`);
  assert('E2 New trust is 0.7', j2?.data?.newTrust === 0.7, `newTrust=${j2?.data?.newTrust}`);

  // E3: Verify score updated
  const { json: j3 } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
  });
  assert('E3 Trust score updated', j3?.data?.trustScore === 0.7, `trust=${j3?.data?.trustScore}`);
  assert('E3 Profile upgraded to WATCH', j3?.data?.accessProfile === 'WATCH', `profile=${j3?.data?.accessProfile}`);

  // E4: Recovery capped at 1.0
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    trust_score: 0.95,
    anomaly_score: 0.0,
  });
  const { json: j4 } = await post('/admin/trigger-recovery', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    hours_clean: 100,
  });
  assert('E4 Recovery capped at 1.0', j4?.data?.newTrust === 1.0 || j4?.data?.skipped, `newTrust=${j4?.data?.newTrust}`);

  // E5: Recovery skipped during override cooldown
  await post('/admin/force-profile', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    profile: 'FULL',
    reason: 'test_cooldown',
  });
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    trust_score: 0.5,
    anomaly_score: 0.0,
  });
  const { json: j5 } = await post('/admin/trigger-recovery', {
    admin_secret: ADMIN_SECRET,
    user_id: userId,
    hours_clean: 10,
  });
  assert('E5 Recovery skipped during override', j5?.data?.skipped === true, `skipped=${j5?.data?.skipped}`);

  // Cleanup
  await post('/admin/clear-override', { admin_secret: ADMIN_SECRET, user_id: userId });
  await post('/admin/trust-reset', { admin_secret: ADMIN_SECRET, user_id: userId });
}

// ══════════════════════════════════════════════════════════════
// SECTION F: Adaptive Penalty (unit-level assertions)
// ══════════════════════════════════════════════════════════════
async function sectionF() {
  console.log('\n═══ Section F: Adaptive Penalty (Unit) ═══');

  // F1–F4: These test the getAccessProfile function via enforcement-status
  const { userId } = await createTestUser('penalty');

  // F1: Trust 0.9 → FULL
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET, user_id: userId, trust_score: 0.9, anomaly_score: 0.0,
  });
  const { json: j1 } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('F1 Trust 0.9 → FULL', j1?.data?.accessProfile === 'FULL', `profile=${j1?.data?.accessProfile}`);

  // F2: Trust 0.7 → WATCH
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET, user_id: userId, trust_score: 0.7, anomaly_score: 0.0,
  });
  const { json: j2 } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('F2 Trust 0.7 → WATCH', j2?.data?.accessProfile === 'WATCH', `profile=${j2?.data?.accessProfile}`);

  // F3: Trust 0.5 → SOFT_RESTRICT
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET, user_id: userId, trust_score: 0.5, anomaly_score: 0.0,
  });
  const { json: j3 } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('F3 Trust 0.5 → SOFT_RESTRICT', j3?.data?.accessProfile === 'SOFT_RESTRICT', `profile=${j3?.data?.accessProfile}`);

  // F4: Trust 0.3 → HARD_RESTRICT
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET, user_id: userId, trust_score: 0.3, anomaly_score: 0.0,
  });
  const { json: j4 } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('F4 Trust 0.3 → HARD_RESTRICT', j4?.data?.accessProfile === 'HARD_RESTRICT', `profile=${j4?.data?.accessProfile}`);

  // F5: Trust 0.1 → LOCKDOWN
  await post('/admin/set-scores', {
    admin_secret: ADMIN_SECRET, user_id: userId, trust_score: 0.1, anomaly_score: 0.0,
  });
  const { json: j5 } = await post('/admin/enforcement-status', {
    admin_secret: ADMIN_SECRET, user_id: userId,
  });
  assert('F5 Trust 0.1 → LOCKDOWN', j5?.data?.accessProfile === 'LOCKDOWN', `profile=${j5?.data?.accessProfile}`);
  assert('F5 LOCKDOWN blocks everything', j5?.data?.featureGate?.sync === false, `sync=${j5?.data?.featureGate?.sync}`);

  // Cleanup
  await post('/admin/trust-reset', { admin_secret: ADMIN_SECRET, user_id: userId });
}

// ══════════════════════════════════════════════════════════════
// SECTION G: Health Check + Phase Verification
// ══════════════════════════════════════════════════════════════
async function sectionG() {
  console.log('\n═══ Section G: Health Check + Phase Verification ═══');

  const { status, json } = await get('/health');
  assert('G1 Health returns 200', status === 200, `status=${status}`);
  assert('G1 Phase is 28', json?.data?.phase === 28, `phase=${json?.data?.phase}`);
  assert('G1 Service is fitquest-authority', json?.data?.service === 'fitquest-authority', `service=${json?.data?.service}`);
  assert('G1 Status is operational', json?.data?.status === 'operational', `status=${json?.data?.status}`);
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Phase 28 — Enforcement Layer Tests           ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║  Target: ${BASE_URL}`);
  console.log(`║  API_KEY: ${API_KEY ? '✅ set' : '❌ missing'}`);
  console.log(`║  ADMIN_SECRET: ${ADMIN_SECRET ? '✅ set' : '❌ missing'}`);
  console.log('╚════════════════════════════════════════════════╝');

  if (!API_KEY || !ADMIN_SECRET) {
    console.error('\n❌ Missing API_KEY or ADMIN_SECRET. Set them in .env');
    process.exit(1);
  }

  // Wake up Render free-tier server before running tests
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
    await get('/health'); // keepalive
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
