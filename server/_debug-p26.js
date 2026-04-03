/**
 * Minimal debug runner to find where test-phase26-device-binding.js crashes
 */
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BASE = 'https://fitq-56sj.onrender.com';
const API_KEY = process.env.API_KEY || process.env.EXPO_PUBLIC_AUTHORITY_API_KEY || '';
const APP_VERSION = '2.0.0';
const USER_ID = 'user_local_001';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  process.exit(99);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(98);
});

async function post(urlPath, body) {
  const headers = { 'Content-Type': 'application/json', 'X-App-Version': APP_VERSION };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${BASE}${urlPath}`, {
      method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally {
    clearTimeout(timeout);
  }
}

function computeResponse(nonce, deviceId, appVersion) {
  return crypto.createHash('sha256').update(`${nonce}${deviceId}${appVersion}`).digest('hex');
}

async function main() {
  console.log('DEBUG: Starting...');
  
  // Step 1: Health
  try {
    const r = await fetch(`${BASE}/health`);
    const j = await r.json();
    console.log('1. Health OK:', j.data.version);
  } catch (e) {
    console.error('1. Health FAILED:', e.message);
    return;
  }

  // Step 2: Challenge
  console.log('2. Getting challenge...');
  const devId = `debug-${Date.now()}`;
  const { status: cs, json: cj } = await post('/auth/challenge', { user_id: USER_ID, device_id: devId });
  console.log('2. Challenge:', cs, cj.data?.challenge_id ? 'OK' : 'FAIL');

  // Step 3: Register
  console.log('3. Registering...');
  const cr = computeResponse(cj.data.nonce, devId, APP_VERSION);
  const { status: rs, json: rj } = await post('/device/register', {
    user_id: USER_ID, device_id: devId, app_version: APP_VERSION,
    challenge_id: cj.data.challenge_id, challenge_response: cr,
  });
  console.log('3. Register:', rs, rj.data?.device_token ? 'GOT_TOKEN' : 'NO_TOKEN');

  // Step 4: Sync
  console.log('4. Syncing...');
  const token = rj.data?.device_token;
  const { status: s4cs, json: s4cj } = await post('/auth/challenge', { user_id: USER_ID, device_id: devId });
  const s4cr = computeResponse(s4cj.data.nonce, devId, APP_VERSION);
  const { status: ss, json: sj } = await post('/sync/batch', {
    user_id: USER_ID, device_id: devId, device_token: token, app_version: APP_VERSION,
    challenge_id: s4cj.data.challenge_id, challenge_response: s4cr,
    actions: [{ action_id: `dbg-${Date.now()}`, type: 'workout_complete',
      payload: { completed_exercises: 1, total_exercises: 1, duration_minutes: 5, streak_days: 0 } }],
  });
  console.log('4. Sync:', ss);

  // Step 5: Do 10 more requests
  for (let i = 0; i < 10; i++) {
    const { status: hcs, json: hcj } = await post('/auth/challenge', { user_id: USER_ID, device_id: devId });
    console.log(`5.${i} Challenge:`, hcs);
  }

  console.log('DEBUG: All done!');
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
