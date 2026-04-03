'use strict';
const crypto = require('crypto');

const API_KEY = '3271dfe632dc1ac9a2a0135a75ad300b279b85850ad2cbf4c094a240d7ae0f45';
const BASE = 'https://fitq-56sj.onrender.com';

async function run() {
  // Step 1: Health
  console.log('── Step 1: GET /health ──');
  const hRes = await fetch(BASE + '/health');
  const hJson = await hRes.json();
  console.log('Status:', hRes.status);
  console.log('Version:', hJson.data && hJson.data.version);

  // Step 2: Challenge
  console.log('\n── Step 2: POST /auth/challenge ──');
  const chRes = await fetch(BASE + '/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY, 'X-App-Version': '1.0.0' },
    body: JSON.stringify({ user_id: 'user_local_001', device_id: 'live_test_device' })
  });
  const chJson = await chRes.json();
  console.log('Status:', chRes.status);
  console.log('Body:', JSON.stringify(chJson, null, 2));

  if (chRes.status !== 200 || !chJson.data) {
    console.log('FAIL: Challenge did not return 200. Stopping.');
    return;
  }

  const challengeId = chJson.data.challenge_id;
  const nonce = chJson.data.nonce;

  // Step 3: Compute response + verify
  const response = crypto.createHash('sha256').update(nonce + 'live_test_device' + '1.0.0').digest('hex');
  console.log('\n── Step 3: POST /auth/verify ──');
  const vRes = await fetch(BASE + '/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY, 'X-App-Version': '1.0.0' },
    body: JSON.stringify({ challenge_id: challengeId, response: response, app_version: '1.0.0' })
  });
  const vJson = await vRes.json();
  console.log('Status:', vRes.status);
  console.log('Body:', JSON.stringify(vJson, null, 2));

  // Step 4: Subscription check
  console.log('\n── Step 4: POST /verify/subscription ──');
  const sRes = await fetch(BASE + '/verify/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY, 'X-App-Version': '1.0.0' },
    body: JSON.stringify({ user_id: 'user_local_001' })
  });
  const sJson = await sRes.json();
  console.log('Status:', sRes.status);
  console.log('Body:', JSON.stringify(sJson, null, 2));

  // Step 5: Replay attack
  console.log('\n── Step 5: Replay attack (reuse consumed challenge) ──');
  const rRes = await fetch(BASE + '/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY, 'X-App-Version': '1.0.0' },
    body: JSON.stringify({ challenge_id: challengeId, response: response, app_version: '1.0.0' })
  });
  const rJson = await rRes.json();
  console.log('Status:', rRes.status, '(expected 403)');
  console.log('Body:', JSON.stringify(rJson, null, 2));

  // Summary
  console.log('\n════════════════════════════════');
  console.log('  LIVE VERIFICATION SUMMARY');
  console.log('════════════════════════════════');
  console.log('  Health:    ' + (hRes.status === 200 && hJson.data.version === '3.0.0' ? 'v3.0.0 PASS' : 'FAIL'));
  console.log('  Challenge: ' + (chRes.status === 200 ? 'PASS' : 'FAIL'));
  console.log('  Verify:    ' + (vRes.status === 200 ? 'PASS' : 'FAIL'));
  console.log('  Subscript: ' + sRes.status);
  console.log('  Replay:    ' + (rRes.status === 403 ? 'BLOCKED (correct)' : 'NOT BLOCKED (fail)'));
  
  const allPass = hRes.status === 200 && chRes.status === 200 && vRes.status === 200 && rRes.status === 403;
  console.log('\n  RESULT: ' + (allPass ? 'ALL PASS — System aligned' : 'FAILURES DETECTED'));
  process.exit(allPass ? 0 : 1);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
