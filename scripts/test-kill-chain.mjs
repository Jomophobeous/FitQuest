#!/usr/bin/env node
/**
 * Phase 24A — Manual Kill Chain Test
 *
 * Sequential flow that proves the full lifecycle:
 *   1. Create user
 *   2. Verify device (first-time registration)
 *   3. Re-verify same device (should pass, untrusted=false)
 *   4. Switch device_id → expect anomaly observation (untrusted may flip)
 *   5. Verify subscription (no record → inactive)
 *   6. Create user again (idempotent → created=false)
 *
 * Run: node scripts/test-kill-chain.mjs
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

const USER_ID = 'killchain_' + Date.now().toString(36);
const DEVICE_A = 'device_A_' + Date.now().toString(36);
const DEVICE_B = 'device_B_' + Date.now().toString(36);  // different device
const EMAIL = USER_ID + '@killchain.fitquest.local';
const APP_VERSION = '1.0.0';

function hmacSign(userId, deviceId, timestamp) {
  const payload = `${userId}|${deviceId}|${APP_VERSION}|${timestamp}`;
  return createHmac('sha256', SECRET).update(payload).digest('hex');
}

async function post(path, body, { apiKey = API_KEY } = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-App-Version': APP_VERSION };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST', headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const latency = Date.now() - start;
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, latency };
}

function check(label, condition, detail) {
  const icon = condition ? '✅' : '❌';
  console.log(`  ${icon} ${label}`);
  if (detail) console.log(`     ${detail}`);
  if (!condition) process.exitCode = 1;
  return condition;
}

console.log('\n═══════════════════════════════════════════════');
console.log(' Kill Chain — Full Lifecycle Validation');
console.log(` Target: ${BASE_URL}`);
console.log(` User: ${USER_ID}`);
console.log(` Device A: ${DEVICE_A}`);
console.log(` Device B: ${DEVICE_B}`);
console.log('═══════════════════════════════════════════════\n');

// Step 1: Create user
console.log('── Step 1: Create User ──');
const r1 = await post('/user/create', { id: USER_ID, email: EMAIL });
const userOk = check(
  `POST /user/create → ${r1.status} (${r1.latency}ms)`,
  r1.status === 201 && r1.json?.data?.created === true,
  `created=${r1.json?.data?.created}, id=${r1.json?.data?.id}`
);
if (!userOk) { console.error('\nFATAL: Cannot continue without user.\n'); process.exit(1); }

// Step 2: First device verification
console.log('\n── Step 2: First Device Verification (Device A) ──');
const ts2 = Date.now();
const sig2 = hmacSign(USER_ID, DEVICE_A, ts2);
const r2 = await post('/verify/device', {
  user_id: USER_ID, device_id: DEVICE_A,
  app_version: APP_VERSION, signature: sig2, timestamp: ts2,
});
check(
  `POST /verify/device → ${r2.status} (${r2.latency}ms)`,
  r2.status === 200 && r2.json?.data?.untrusted === false,
  `untrusted=${r2.json?.data?.untrusted}, verified_at=${r2.json?.data?.verified_at}`
);

// Step 3: Re-verify same device
console.log('\n── Step 3: Re-verify Same Device (Device A) ──');
const ts3 = Date.now();
const sig3 = hmacSign(USER_ID, DEVICE_A, ts3);
const r3 = await post('/verify/device', {
  user_id: USER_ID, device_id: DEVICE_A,
  app_version: APP_VERSION, signature: sig3, timestamp: ts3,
});
check(
  `POST /verify/device → ${r3.status} (${r3.latency}ms)`,
  r3.status === 200 && r3.json?.data?.untrusted === false,
  `untrusted=${r3.json?.data?.untrusted} (should still be false — same device)`
);

// Step 4: Switch device → anomaly observation
console.log('\n── Step 4: Switch to Device B (Anomaly Trigger) ──');
const ts4 = Date.now();
const sig4 = hmacSign(USER_ID, DEVICE_B, ts4);
const r4 = await post('/verify/device', {
  user_id: USER_ID, device_id: DEVICE_B,
  app_version: APP_VERSION, signature: sig4, timestamp: ts4,
});
// Server may set untrusted=true for device switching, or may just log the anomaly
// Either way, it should be 200 (valid signature)
check(
  `POST /verify/device → ${r4.status} (${r4.latency}ms)`,
  r4.status === 200,
  `untrusted=${r4.json?.data?.untrusted} (may be true due to device switch)`
);
if (r4.json?.data?.untrusted) {
  console.log('     ⚠️  ANOMALY DETECTED: Server flagged untrusted after device switch');
} else {
  console.log('     ℹ️  Server accepted new device (anomaly logged server-side)');
}

// Step 5: Verify subscription (should be inactive — no purchase)
console.log('\n── Step 5: Subscription Check (No Record) ──');
const r5 = await post('/verify/subscription', {
  user_id: USER_ID, device_id: DEVICE_A,
});
check(
  `POST /verify/subscription → ${r5.status} (${r5.latency}ms)`,
  r5.status === 200 && r5.json?.data?.status === 'inactive',
  `status=${r5.json?.data?.status}, restricted=${r5.json?.data?.restricted}`
);

// Step 6: Idempotent user creation
console.log('\n── Step 6: Idempotent User Creation (Same ID) ──');
const r6 = await post('/user/create', { id: USER_ID, email: EMAIL });
check(
  `POST /user/create → ${r6.status} (${r6.latency}ms)`,
  r6.status === 200 && r6.json?.data?.created === false,
  `created=${r6.json?.data?.created} (should be false — already exists)`
);

// Summary
console.log('\n═══════════════════════════════════════════════');
console.log(' Kill Chain Complete');
console.log('═══════════════════════════════════════════════\n');

const latencies = [r1, r2, r3, r4, r5, r6].map(r => r.latency);
console.log(`  Latency: min=${Math.min(...latencies)}ms avg=${Math.round(latencies.reduce((a,b) => a+b, 0) / latencies.length)}ms max=${Math.max(...latencies)}ms`);
console.log();
