/**
 * Phase 22.1 Integration Test — Real-Time Anomaly Detection Engine
 * Run from server/: node test-phase22_1.js
 *
 * Tests:
 *   1.  Health check (v2.3.0, phase 22.1)
 *   2.  Create user
 *   3.  Device verify (new registration + anomaly eval)
 *   4.  Device verify returns anomaly fields
 *   5.  Subscription verify (anomaly-aware)
 *   6.  AI request (anomaly-aware, authorized)
 *   7.  AI request (PROFESSOR personality)
 *   8.  Unknown device → 403
 *   9.  Unknown user → 403
 *   10. Missing fields → 400
 *   11. 404 catch-all
 *   12. Re-verify device (score persistence check)
 *   13. Subscription has anomaly_score field
 *   14. AI response has triggered field
 */
'use strict';

require('dotenv').config();
const app = require('./index');

const PORT = 4023;
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

async function run() {
  console.log('\n=== Phase 22.1 Integration Tests ===\n');

  // 1. Health check
  {
    const r = await get('/health');
    check('Health 200', r.status === 200);
    check('Phase 22.1', r.data.data?.phase === 22.1);
    check('Version 2.3.0', r.data.data?.version === '2.3.0');
  }

  // 2. Create user
  {
    const r = await post('/user/create', { id: 'test_p221_user', email: 'p221@test.com' });
    check('Create user (200 or 409)', r.status === 200 || r.status === 409);
  }

  // 3. Device verify (new registration)
  {
    const r = await post('/verify/device', {
      user_id: 'test_p221_user',
      device_id: 'dev_p221_001',
      app_version: '2.3.0',
      signature: 'sig_test',
    });
    check('Device verify 200', r.status === 200);
    check('Has trust_score', typeof r.data.data?.trust_score === 'number');
    check('Has anomaly_score', typeof r.data.data?.anomaly_score === 'number');
    check('Has effective_trust', typeof r.data.data?.effective_trust === 'number');
    check('Has triggered array', Array.isArray(r.data.data?.triggered));
    check('Has untrusted field', typeof r.data.data?.untrusted === 'boolean');
    console.log(`    trust=${r.data.data?.trust_score} anomaly=${r.data.data?.anomaly_score} effective=${r.data.data?.effective_trust} triggered=[${r.data.data?.triggered}]`);
  }

  // 4. Subscription verify
  {
    const r = await post('/verify/subscription', {
      user_id: 'test_p221_user',
      device_id: 'dev_p221_001',
      receipt: 'rc_test',
    });
    check('Subscription verify 200', r.status === 200);
    check('Sub has effective_trust', typeof r.data.data?.effective_trust === 'number');
    check('Sub has anomaly_score', typeof r.data.data?.anomaly_score === 'number');
    console.log(`    effective_trust=${r.data.data?.effective_trust} anomaly=${r.data.data?.anomaly_score}`);
  }

  // 5. AI request (COACH)
  {
    const r = await post('/ai/request', {
      user_id: 'test_p221_user',
      device_id: 'dev_p221_001',
      prompt: 'test prompt for phase 22.1',
      personality: 'COACH',
    });
    check('AI request 200', r.status === 200);
    check('AI has anomaly_score', typeof r.data.data?.anomaly_score === 'number');
    check('AI has effective_trust', typeof r.data.data?.effective_trust === 'number');
    check('AI has triggered', Array.isArray(r.data.data?.triggered));
    console.log(`    anomaly=${r.data.data?.anomaly_score} effective=${r.data.data?.effective_trust} triggered=[${r.data.data?.triggered}]`);
  }

  // 6. AI request (PROFESSOR)
  {
    const r = await post('/ai/request', {
      user_id: 'test_p221_user',
      device_id: 'dev_p221_001',
      prompt: 'explain recovery science',
      personality: 'PROFESSOR',
    });
    check('AI professor 200', r.status === 200);
  }

  // 7. Unknown device → 403
  {
    const r = await post('/verify/subscription', {
      user_id: 'test_p221_user',
      device_id: 'unknown_dev_xyz_999',
      receipt: 'rc_test',
    });
    check('Unknown device → 403', r.status === 403);
  }

  // 8. Unknown user → 403
  {
    const r = await post('/verify/device', {
      user_id: 'nonexistent_user_xyz',
      device_id: 'dev_001',
      app_version: '1.0.0',
      signature: 'sig_test',
    });
    check('Unknown user → 403', r.status === 403);
  }

  // 9. Missing fields → 400
  {
    const r = await post('/ai/request', {
      user_id: 'test_p221_user',
    });
    check('Missing fields → 400', r.status === 400);
  }

  // 10. 404 catch-all
  {
    const r = await get('/nonexistent');
    check('404 catch-all', r.status === 404);
  }

  // 11. Re-verify device (persistence check)
  {
    const r = await post('/verify/device', {
      user_id: 'test_p221_user',
      device_id: 'dev_p221_001',
      app_version: '2.3.0',
      signature: 'sig_test',
    });
    check('Re-verify 200', r.status === 200);
    check('Re-verify has effective_trust', typeof r.data.data?.effective_trust === 'number');
    check('Re-verify has triggered', Array.isArray(r.data.data?.triggered));
  }

  // Summary
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
