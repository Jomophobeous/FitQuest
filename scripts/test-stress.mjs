#!/usr/bin/env node
/**
 * Phase 24B — Stress & Break Test Harness
 *
 * Tests:
 *   S1. Rapid sequential requests (burst 20 in <2s)
 *   S2. Rate limit trigger (>60 requests → 429)
 *   S3. Parallel concurrent requests (10 simultaneous device verifications)
 *   S4. Invalid payload shapes (missing fields, wrong types, extra fields)
 *   S5. Multiple device switching (3+ devices rapid-fire)
 *   S6. Timestamp boundary testing (just inside and just outside 5min window)
 *   S7. Large payload rejection (100KB body)
 *   S8. Empty/null/undefined fields
 *   S9. Duplicate user creation under concurrency
 *   S10. Signature tampering variants
 *
 * Run: node scripts/test-stress.mjs
 */

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', 'server', '.env');
const env = {};
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const API_KEY = env.API_KEY;
const SECRET = env.DEVICE_SIGNING_SECRET;
const APP_VERSION = '1.0.0';

const tag = Date.now().toString(36);
const STRESS_USER = `stress_${tag}`;
const STRESS_EMAIL = `${STRESS_USER}@stress.fitquest.local`;

function hmacSign(userId, deviceId, timestamp) {
  const payload = `${userId}|${deviceId}|${APP_VERSION}|${timestamp}`;
  return createHmac('sha256', SECRET).update(payload).digest('hex');
}

async function post(path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-App-Version': APP_VERSION };
  if (opts.apiKey !== null) headers['Authorization'] = `Bearer ${opts.apiKey || API_KEY}`;
  if (opts.contentType) headers['Content-Type'] = opts.contentType;
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST', headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeout || 10000),
    });
    const latency = Date.now() - start;
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json, latency };
  } catch (e) {
    return { status: 0, json: null, latency: Date.now() - start, error: e.message };
  }
}

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
  if (detail) console.log(`     ${detail}`);
  return condition;
}

console.log('\n═══════════════════════════════════════════════');
console.log(' Phase 24B — Stress & Break Tests');
console.log(` Target: ${BASE_URL}`);
console.log('═══════════════════════════════════════════════\n');

// Setup: Create stress test user
const setup = await post('/user/create', { id: STRESS_USER, email: STRESS_EMAIL });
if (setup.status !== 201) {
  console.error(`SETUP FAILED: /user/create returned ${setup.status}`);
  console.error(JSON.stringify(setup.json));
  process.exit(1);
}
console.log(`  Setup: User ${STRESS_USER} created (${setup.latency}ms)\n`);

// ── S1: Burst Requests ──
console.log('── S1: Burst Sequential Requests (20 rapid verifications) ──');
{
  const results = [];
  for (let i = 0; i < 20; i++) {
    const ts = Date.now();
    const sig = hmacSign(STRESS_USER, `device_burst_${tag}`, ts);
    const r = await post('/verify/device', {
      user_id: STRESS_USER, device_id: `device_burst_${tag}`,
      app_version: APP_VERSION, signature: sig, timestamp: ts,
    });
    results.push(r);
  }
  const statuses = results.map(r => r.status);
  const all200 = statuses.every(s => s === 200);
  const latencies = results.map(r => r.latency);
  check(
    `20 rapid requests: all 200=${all200}, avg=${Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length)}ms`,
    all200,
    `statuses: ${[...new Set(statuses)].join(',')}, min=${Math.min(...latencies)}ms max=${Math.max(...latencies)}ms`
  );
}

// ── S2: Rate Limit Trigger ──
console.log('\n── S2: Rate Limit Trigger (65 concurrent requests → should hit 60/min) ──');
{
  // Fire 65 requests concurrently so they all hit within the same second window
  const promises = [];
  for (let i = 0; i < 65; i++) {
    const ts = Date.now();
    const sig = hmacSign(STRESS_USER, `device_rate_${i}_${tag}`, ts);
    promises.push(post('/verify/device', {
      user_id: STRESS_USER, device_id: `device_rate_${i}_${tag}`,
      app_version: APP_VERSION, signature: sig, timestamp: ts,
    }));
  }
  const results = await Promise.all(promises);
  const got429 = results.some(r => r.status === 429);
  const count429 = results.filter(r => r.status === 429).length;
  const count200 = results.filter(r => r.status === 200).length;
  check(
    `Rate limit: ${count200} accepted, ${count429} rejected (429)`,
    got429,
    `Expected some 429s when 65 concurrent requests hit 60/min limit`
  );
}

// Wait for rate limit window to reset (need a fresh window for remaining tests)
console.log('\n  ⏳ Waiting 62s for rate limit window reset...');
await new Promise(r => setTimeout(r, 62000));

// ── S3: Parallel Concurrent Requests ──
console.log('\n── S3: Parallel Concurrent Requests (10 simultaneous) ──');
{
  const promises = [];
  for (let i = 0; i < 10; i++) {
    const ts = Date.now();
    const sig = hmacSign(STRESS_USER, `device_parallel_${i}_${tag}`, ts);
    promises.push(post('/verify/device', {
      user_id: STRESS_USER, device_id: `device_parallel_${i}_${tag}`,
      app_version: APP_VERSION, signature: sig, timestamp: ts,
    }));
  }
  const results = await Promise.all(promises);
  const allOk = results.every(r => r.status === 200);
  const latencies = results.map(r => r.latency);
  check(
    `10 parallel requests: all 200=${allOk}, max=${Math.max(...latencies)}ms`,
    allOk,
    `statuses: ${results.map(r => r.status).join(',')}`
  );
}

// ── S4: Invalid Payload Shapes ──
console.log('\n── S4: Invalid Payload Shapes ──');
{
  // 4a: user_id as number
  const r1 = await post('/verify/device', { user_id: 12345, device_id: 'x', app_version: '1.0.0', signature: 'x', timestamp: Date.now() });
  check(`user_id as number → ${r1.status}`, r1.status === 400, `error=${r1.json?.error}`);

  // 4b: empty string user_id
  const r2 = await post('/verify/device', { user_id: '', device_id: 'x', app_version: '1.0.0', signature: 'x', timestamp: Date.now() });
  check(`empty user_id → ${r2.status}`, r2.status === 400, `error=${r2.json?.error}`);

  // 4c: extra unknown fields (should be ignored, not crash)
  const ts = Date.now();
  const sig = hmacSign(STRESS_USER, `device_extra_${tag}`, ts);
  const r3 = await post('/verify/device', {
    user_id: STRESS_USER, device_id: `device_extra_${tag}`,
    app_version: APP_VERSION, signature: sig, timestamp: ts,
    evil_field: 'DROP TABLE users;', __proto__: { admin: true },
  });
  check(`extra fields ignored → ${r3.status}`, r3.status === 200, `untrusted=${r3.json?.data?.untrusted}`);

  // 4d: timestamp as string
  const r4 = await post('/verify/device', { user_id: STRESS_USER, device_id: 'x', app_version: '1.0.0', signature: 'x', timestamp: 'not-a-number' });
  check(`timestamp as string → ${r4.status}`, r4.status === 400 || r4.status === 403, `error=${r4.json?.error}`);

  // 4e: null body values
  const r5 = await post('/verify/device', { user_id: null, device_id: null, signature: null });
  check(`null fields → ${r5.status}`, r5.status === 400, `error=${r5.json?.error}`);
}

// ── S5: Rapid Device Switching (5 unique devices in <5s) ──
console.log('\n── S5: Rapid Device Switching (5 devices) ──');
{
  const deviceResults = [];
  for (let i = 0; i < 5; i++) {
    const deviceId = `device_switch_${i}_${tag}`;
    const ts = Date.now();
    const sig = hmacSign(STRESS_USER, deviceId, ts);
    const r = await post('/verify/device', {
      user_id: STRESS_USER, device_id: deviceId,
      app_version: APP_VERSION, signature: sig, timestamp: ts,
    });
    deviceResults.push({ deviceId, status: r.status, untrusted: r.json?.data?.untrusted });
  }
  const allSuccess = deviceResults.every(d => d.status === 200);
  const anyUntrusted = deviceResults.some(d => d.untrusted === true);
  check(
    `5 device switches: all 200=${allSuccess}`,
    allSuccess,
    `untrusted flags: ${deviceResults.map(d => d.untrusted).join(',')} ${anyUntrusted ? '(anomaly detected!)' : '(no anomaly flag)'}`
  );
}

// ── S6: Timestamp Boundary ──
console.log('\n── S6: Timestamp Boundary Tests ──');
{
  // 6a: Just inside 5-minute window (4 min 55 sec ago)
  const justInside = Date.now() - (4 * 60 + 55) * 1000;
  const sigInside = hmacSign(STRESS_USER, `device_time_${tag}`, justInside);
  const r1 = await post('/verify/device', {
    user_id: STRESS_USER, device_id: `device_time_${tag}`,
    app_version: APP_VERSION, signature: sigInside, timestamp: justInside,
  });
  check(`4m55s ago → ${r1.status}`, r1.status === 200, 'Should be within window');

  // 6b: Just outside (5 min 10 sec ago)
  const justOutside = Date.now() - (5 * 60 + 10) * 1000;
  const sigOutside = hmacSign(STRESS_USER, `device_time_${tag}`, justOutside);
  const r2 = await post('/verify/device', {
    user_id: STRESS_USER, device_id: `device_time_${tag}`,
    app_version: APP_VERSION, signature: sigOutside, timestamp: justOutside,
  });
  check(`5m10s ago → ${r2.status}`, r2.status === 403, 'Should be rejected');

  // 6c: Future timestamp (5 min ahead)
  const future = Date.now() + 5 * 60 * 1000;
  const sigFuture = hmacSign(STRESS_USER, `device_time_${tag}`, future);
  const r3 = await post('/verify/device', {
    user_id: STRESS_USER, device_id: `device_time_${tag}`,
    app_version: APP_VERSION, signature: sigFuture, timestamp: future,
  });
  check(`5min future → ${r3.status}`, r3.status === 403 || r3.status === 200, 'May or may not reject future timestamps');
}

// ── S7: Large Payload Rejection ──
console.log('\n── S7: Large Payload Rejection ──');
{
  const bigPayload = { user_id: STRESS_USER, device_id: 'x', padding: 'A'.repeat(150 * 1024) };
  const r = await post('/verify/device', bigPayload, { timeout: 5000 });
  check(
    `150KB payload → ${r.status}`,
    r.status === 413 || r.status === 400 || r.status === 0,
    `Expected 413 (too large) or connection reset. Got ${r.status}${r.error ? ': ' + r.error : ''}`
  );
}

// ── S8: SQL/NoSQL Injection Attempts ──
console.log('\n── S8: Injection Resistance ──');
{
  const r1 = await post('/user/create', { id: "'; DROP TABLE users; --", email: 'inject@test.com' });
  check(`SQL injection in id → ${r1.status}`, r1.status !== 500, `Should not crash server`);

  const r2 = await post('/verify/device', {
    user_id: '<script>alert(1)</script>',
    device_id: 'test', signature: 'test', timestamp: Date.now(),
  });
  check(`XSS in user_id → ${r2.status}`, r2.status === 400 || r2.status === 403, `error=${r2.json?.error}`);
}

// ── S9: Concurrent Duplicate User Creation ──
console.log('\n── S9: Concurrent Duplicate User Creation ──');
{
  const dupUser = `dup_${tag}`;
  const dupEmail = `${dupUser}@dup.fitquest.local`;
  const results = await Promise.all([
    post('/user/create', { id: dupUser, email: dupEmail }),
    post('/user/create', { id: dupUser, email: dupEmail }),
    post('/user/create', { id: dupUser, email: dupEmail }),
  ]);
  const statuses = results.map(r => r.status).sort();
  // Expect exactly one 201 and the rest 200 (existing) or 409 (duplicate)
  const created = results.filter(r => r.status === 201).length;
  const existing = results.filter(r => r.status === 200).length;
  const noServerCrash = results.every(r => r.status !== 500);
  check(
    `3 concurrent creates: created=${created} existing=${existing} statuses=${statuses.join(',')}`,
    noServerCrash && created <= 1,
    `No 500s, at most 1 creation`
  );
}

// ── S10: Signature Tampering Variants ──
console.log('\n── S10: Signature Tampering Variants ──');
{
  const deviceId = `device_tamper_${tag}`;
  const ts = Date.now();
  const validSig = hmacSign(STRESS_USER, deviceId, ts);

  // 10a: Flip one byte in signature
  const flipped = validSig.slice(0, -2) + (validSig.slice(-2) === 'ff' ? '00' : 'ff');
  const r1 = await post('/verify/device', {
    user_id: STRESS_USER, device_id: deviceId,
    app_version: APP_VERSION, signature: flipped, timestamp: ts,
  });
  check(`Flipped sig byte → ${r1.status}`, r1.status === 403);

  // 10b: Truncated signature
  const r2 = await post('/verify/device', {
    user_id: STRESS_USER, device_id: deviceId,
    app_version: APP_VERSION, signature: validSig.slice(0, 32), timestamp: ts,
  });
  check(`Truncated sig → ${r2.status}`, r2.status === 403);

  // 10c: Empty signature
  const r3 = await post('/verify/device', {
    user_id: STRESS_USER, device_id: deviceId,
    app_version: APP_VERSION, signature: '', timestamp: ts,
  });
  check(`Empty sig → ${r3.status}`, r3.status === 400 || r3.status === 403);

  // 10d: Valid signature but wrong user_id
  const r4 = await post('/verify/device', {
    user_id: 'wrong_user_' + tag, device_id: deviceId,
    app_version: APP_VERSION, signature: validSig, timestamp: ts,
  });
  check(`Wrong user_id with valid sig → ${r4.status}`, r4.status === 403);

  // 10e: Correct sig, swap device_id
  const r5 = await post('/verify/device', {
    user_id: STRESS_USER, device_id: 'swapped_device',
    app_version: APP_VERSION, signature: validSig, timestamp: ts,
  });
  check(`Swapped device_id → ${r5.status}`, r5.status === 403);
}

// ── Summary ──
console.log('\n═══════════════════════════════════════════════');
console.log(' Phase 24B — Stress Test Results');
console.log('═══════════════════════════════════════════════');
console.log(`\n  Total: ${passed + failed}  |  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}`);
console.log();

if (failed > 0) process.exitCode = 1;
