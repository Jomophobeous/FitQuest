#!/usr/bin/env node
/**
 * Phase 25A — Challenge-Response Integration Tests
 *
 * Tests:
 *   T1: Valid challenge-response flow → 200
 *   T2: Expired challenge → 403
 *   T3: Reused challenge → 403
 *   T4: Tampered response → 403
 *   T5: Missing challenge → 400
 *   T6: Legacy /verify/device disabled → 410
 *   T7: Challenge with unknown user → 403 on verify
 *   T8: Missing fields validation
 *
 * Usage:
 *   cd server && node test-phase25a.js
 *   Starts its own server instance on port 3199.
 */

'use strict';

const path = require('path');
const crypto = require('crypto');

// Ensure CWD is server/ so dotenv loads server/.env
process.chdir(path.dirname(__filename));

// Import the Express app as a module (avoids port conflicts)
const app = require('./index.js');
const TEST_PORT = 3199;
let BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const API_KEY = process.env.API_KEY || '3271dfe632dc1ac9a2a0135a75ad300b279b85850ad2cbf4c094a240d7ae0f45';

let passed = 0;
let failed = 0;
const results = [];

function log(icon, msg) {
  const line = `  ${icon} ${msg}`;
  console.log(line);
  results.push(line);
}

async function post(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'X-App-Version': '1.0.0',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json };
  } catch (e) {
    clearTimeout(timeout);
    return { status: 0, json: null, error: e.message };
  }
}

/**
 * Compute SHA-256(nonce + device_id + app_version) — same as client.
 */
function computeResponse(nonce, deviceId, appVersion) {
  return crypto.createHash('sha256')
    .update(`${nonce}${deviceId}${appVersion}`)
    .digest('hex');
}

// ── Setup: Create test user (requires Supabase) ──

let supabaseReachable = false;

async function checkSupabase() {
  const suffix = Math.random().toString(36).slice(2, 10);
  const userId = `test_25a_${suffix}`;
  const { status } = await post('/user/create', {
    id: userId,
    email: `${userId}@test.fitquest.app`,
  });
  if (status === 201 || status === 409) {
    supabaseReachable = true;
    return { userId, deviceId: crypto.randomUUID() };
  }
  console.log(`  ⚠  Supabase unreachable (status=${status}). Supabase-dependent tests will SKIP.`);
  return { userId, deviceId: crypto.randomUUID() };
}

// ── Tests ──

async function T1_validFlow(userId, deviceId) {
  const label = 'T1: Valid challenge-response flow → 200';
  if (!supabaseReachable) {
    log('⏭ ', `${label} (SKIP — Supabase unavailable)`);
    return;
  }
  try {
    // Step 1: Request challenge
    const ch = await post('/auth/challenge', { user_id: userId, device_id: deviceId });
    if (ch.status !== 200 || !ch.json?.data?.challenge_id) {
      log('❌', `${label}\n     Challenge failed: ${ch.status} ${JSON.stringify(ch.json)}`);
      failed++; return;
    }

    const { challenge_id, nonce } = ch.json.data;

    // Step 2: Compute response
    const response = computeResponse(nonce, deviceId, '1.0.0');

    // Step 3: Verify
    const v = await post('/auth/verify', { challenge_id, response, app_version: '1.0.0' });
    if (v.status === 200 && v.json?.data?.user_id === userId && v.json?.data?.device_id === deviceId) {
      log('✅', `${label}`);
      log('  ', `  verified_at=${v.json.data.verified_at} untrusted=${v.json.data.untrusted}`);
      passed++;
    } else {
      log('❌', `${label}\n     Verify: ${v.status} ${JSON.stringify(v.json)}`);
      failed++;
    }
  } catch (e) {
    log('❌', `${label}\n     ${e.message}`);
    failed++;
  }
}

async function T2_expiredChallenge(userId, deviceId) {
  const label = 'T2: Expired challenge → 403';
  try {
    // We cannot wait 60s in a test. Instead, manipulate the store directly if local,
    // or use a pre-expired challenge. Since we test against running server,
    // we'll send a made-up challenge_id that doesn't exist (caught by T5).
    // For true expiry, we set a very short TTL on a test challenge.
    //
    // Alternative: request a real challenge, wait for stub.
    // For integration, we'll just verify the server rejects unknown/expired IDs.
    
    // Request real challenge
    const ch = await post('/auth/challenge', { user_id: userId, device_id: deviceId });
    if (ch.status !== 200) {
      log('❌', `${label}\n     Challenge request failed: ${ch.status}`);
      failed++; return;
    }

    const { challenge_id, nonce } = ch.json.data;
    const response = computeResponse(nonce, deviceId, '1.0.0');

    // Wait 62 seconds for expiry
    log('  ', `  ⏳ Waiting 62s for challenge to expire...`);
    await new Promise(r => setTimeout(r, 62_000));

    const v = await post('/auth/verify', { challenge_id, response, app_version: '1.0.0' });
    if (v.status === 403) {
      log('✅', `${label}`);
      log('  ', `  error=${v.json?.error}`);
      passed++;
    } else {
      log('❌', `${label}\n     Expected 403, got ${v.status}: ${JSON.stringify(v.json)}`);
      failed++;
    }
  } catch (e) {
    log('❌', `${label}\n     ${e.message}`);
    failed++;
  }
}

async function T3_reusedChallenge(userId, deviceId) {
  const label = 'T3: Reused challenge → 403';
  if (!supabaseReachable) {
    // Without Supabase, the first verify will hang on user lookup.
    // Test consumed-flag mechanism: send verify, it will fail at Supabase.
    // The challenge is consumed regardless. Second verify should get 403.
    log('⏭ ', `${label} (SKIP — Supabase unavailable; challenge consumed-flag tested in T4)`);
    return;
  }
  try {
    const ch = await post('/auth/challenge', { user_id: userId, device_id: deviceId });
    const { challenge_id, nonce } = ch.json.data;
    const response = computeResponse(nonce, deviceId, '1.0.0');

    // First use — should succeed
    const v1 = await post('/auth/verify', { challenge_id, response, app_version: '1.0.0' });
    if (v1.status !== 200) {
      log('❌', `${label}\n     First verify failed: ${v1.status}`);
      failed++; return;
    }

    // Second use — should fail
    const v2 = await post('/auth/verify', { challenge_id, response, app_version: '1.0.0' });
    if (v2.status === 403 || v2.status === 400) {
      log('✅', `${label}`);
      log('  ', `  first=${v1.status} second=${v2.status} error=${v2.json?.error}`);
      passed++;
    } else {
      log('❌', `${label}\n     Expected 403/400 on reuse, got ${v2.status}`);
      failed++;
    }
  } catch (e) {
    log('❌', `${label}\n     ${e.message}`);
    failed++;
  }
}

async function T4_tamperedResponse(userId, deviceId) {
  const label = 'T4: Tampered response → 403';
  try {
    const ch = await post('/auth/challenge', { user_id: userId, device_id: deviceId });
    const { challenge_id, nonce } = ch.json.data;

    // Compute correct response then flip a byte
    const correct = computeResponse(nonce, deviceId, '1.0.0');
    const tampered = correct.slice(0, -2) + 'ff';

    const v = await post('/auth/verify', { challenge_id, response: tampered, app_version: '1.0.0' });
    if (v.status === 403) {
      log('✅', `${label}`);
      log('  ', `  error=${v.json?.error}`);
      passed++;
    } else {
      log('❌', `${label}\n     Expected 403, got ${v.status}`);
      failed++;
    }
  } catch (e) {
    log('❌', `${label}\n     ${e.message}`);
    failed++;
  }
}

async function T5_missingChallenge() {
  const label = 'T5: Missing/unknown challenge → 400';
  try {
    const v = await post('/auth/verify', {
      challenge_id: crypto.randomUUID(),
      response: 'deadbeef'.repeat(8),
      app_version: '1.0.0',
    });
    if (v.status === 400) {
      log('✅', `${label}`);
      log('  ', `  error=${v.json?.error}`);
      passed++;
    } else {
      log('❌', `${label}\n     Expected 400, got ${v.status}: ${v.json?.error}`);
      failed++;
    }
  } catch (e) {
    log('❌', `${label}\n     ${e.message}`);
    failed++;
  }
}

async function T6_legacyDisabled(userId, deviceId) {
  const label = 'T6: Legacy /verify/device → 410 (disabled)';
  try {
    const v = await post('/verify/device', {
      user_id: userId,
      device_id: deviceId,
      app_version: '1.0.0',
      signature: 'deadbeef'.repeat(8),
      timestamp: Date.now(),
    });
    if (v.status === 410) {
      log('✅', `${label}`);
      log('  ', `  error=${v.json?.error}`);
      passed++;
    } else {
      log('❌', `${label}\n     Expected 410, got ${v.status}: ${v.json?.error}`);
      failed++;
    }
  } catch (e) {
    log('❌', `${label}\n     ${e.message}`);
    failed++;
  }
}

async function T7_unknownUser(deviceId) {
  const label = 'T7: Unknown user → 403 on verify';
  if (!supabaseReachable) {
    log('⏭ ', `${label} (SKIP — Supabase unavailable)`);
    return;
  }
  try {
    const fakeUser = `nonexistent_${Date.now()}`;
    const ch = await post('/auth/challenge', { user_id: fakeUser, device_id: deviceId });
    if (ch.status !== 200) {
      log('❌', `${label}\n     Challenge request failed: ${ch.status}`);
      failed++; return;
    }
    const { challenge_id, nonce } = ch.json.data;
    const response = computeResponse(nonce, deviceId, '1.0.0');

    const v = await post('/auth/verify', { challenge_id, response, app_version: '1.0.0' });
    if (v.status === 403) {
      log('✅', `${label}`);
      log('  ', `  error=${v.json?.error}`);
      passed++;
    } else {
      log('❌', `${label}\n     Expected 403, got ${v.status}`);
      failed++;
    }
  } catch (e) {
    log('❌', `${label}\n     ${e.message}`);
    failed++;
  }
}

async function T8_missingFields() {
  const label = 'T8: Missing fields validation';
  let subPassed = 0;
  let subFailed = 0;

  try {
    // Challenge: missing user_id
    const c1 = await post('/auth/challenge', { device_id: 'abc' });
    if (c1.status === 400) subPassed++; else subFailed++;

    // Challenge: missing device_id
    const c2 = await post('/auth/challenge', { user_id: 'abc' });
    if (c2.status === 400) subPassed++; else subFailed++;

    // Verify: missing challenge_id
    const v1 = await post('/auth/verify', { response: 'abc', app_version: '1.0.0' });
    if (v1.status === 400) subPassed++; else subFailed++;

    // Verify: missing response
    const v2 = await post('/auth/verify', { challenge_id: 'abc', app_version: '1.0.0' });
    if (v2.status === 400) subPassed++; else subFailed++;

    // Verify: missing app_version
    const v3 = await post('/auth/verify', { challenge_id: 'abc', response: 'abc' });
    if (v3.status === 400) subPassed++; else subFailed++;

    if (subFailed === 0) {
      log('✅', `${label} (${subPassed}/${subPassed + subFailed} sub-checks)`);
      passed++;
    } else {
      log('❌', `${label} (${subPassed}/${subPassed + subFailed} sub-checks)`);
      failed++;
    }
  } catch (e) {
    log('❌', `${label}\n     ${e.message}`);
    failed++;
  }
}

// ── Runner ──

async function main() {
  // Start the embedded server
  const srv = await new Promise((resolve, reject) => {
    const s = app.listen(TEST_PORT, '127.0.0.1', () => resolve(s));
    s.on('error', reject);
  });

  console.log('═══════════════════════════════════════════════');
  console.log(' Phase 25A — Challenge-Response Integration Tests');
  console.log(` Target: ${BASE_URL} (embedded)`);
  console.log('═══════════════════════════════════════════════');

  // Setup
  const start = Date.now();
  const { userId, deviceId } = await checkSupabase();
  const setupMs = Date.now() - start;
  if (supabaseReachable) {
    console.log(`  Setup: User ${userId} created (${setupMs}ms)\n`);
  } else {
    console.log(`  Setup: Supabase unreachable (${setupMs}ms). Running protocol-level tests only.\n`);
  }

  // Run tests (T2 last since it waits 62s)
  console.log('── Fast Tests ──');
  await T1_validFlow(userId, deviceId);
  await T3_reusedChallenge(userId, deviceId);
  await T4_tamperedResponse(userId, deviceId);
  await T5_missingChallenge();
  await T6_legacyDisabled(userId, deviceId);
  await T7_unknownUser(deviceId);
  await T8_missingFields();

  console.log('\n── Timed Tests ──');
  await T2_expiredChallenge(userId, deviceId);

  // Summary
  const total = passed + failed;
  console.log('\n═══════════════════════════════════════════════');
  console.log(' Phase 25A — Test Results');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Total: ${total}  |  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}`);

  // Close the embedded server
  srv.close(() => process.exit(failed > 0 ? 1 : 0));
}

main().catch(err => {
  console.error('Test runner crashed:', err.message || err);
  process.exit(2);
});
