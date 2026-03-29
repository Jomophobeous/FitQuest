/**
 * Phase 22 Integration Test — Anomaly & Anti-Abuse Layer
 * Run from server/: node test-phase22.js
 */
'use strict';

require('dotenv').config();
const app = require('./index');

const PORT = 4022;
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
  console.log('\n=== Phase 22 Integration Tests ===\n');

  // 1. Health check
  {
    const r = await get('/health');
    check('Health 200', r.status === 200);
    check('Phase 22', r.data.data?.phase === 22);
    check('Version 2.2.0', r.data.data?.version === '2.2.0');
  }

  // 2. Create user
  {
    const r = await post('/user/create', { id: 'test_p22_user', email: 'p22@test.com' });
    check('Create user (200 or 409)', r.status === 200 || r.status === 409);
  }

  // 3. Verify device (new registration)
  {
    const r = await post('/verify/device', {
      user_id: 'test_p22_user',
      device_id: 'dev_p22_001',
      app_version: '2.2.0',
      signature: 'sig_test',
    });
    check('Device verify 200', r.status === 200);
    check('Has trust_score', typeof r.data.data?.trust_score === 'number');
    check('Has anomaly_score', typeof r.data.data?.anomaly_score === 'number');
    check('Has effective_trust', typeof r.data.data?.effective_trust === 'number');
    console.log(`    trust=${r.data.data?.trust_score} anomaly=${r.data.data?.anomaly_score} effective=${r.data.data?.effective_trust}`);
  }

  // 4. Verify subscription (with anomaly-aware trust)
  {
    const r = await post('/verify/subscription', {
      user_id: 'test_p22_user',
      device_id: 'dev_p22_001',
      receipt: 'rc_test',
    });
    check('Subscription verify 200', r.status === 200);
    check('Sub has effective_trust', typeof r.data.data?.effective_trust === 'number');
    check('Sub has anomaly_score', typeof r.data.data?.anomaly_score === 'number');
    console.log(`    effective_trust=${r.data.data?.effective_trust} anomaly=${r.data.data?.anomaly_score}`);
  }

  // 5. AI request (anomaly-aware)
  {
    const r = await post('/ai/request', {
      user_id: 'test_p22_user',
      device_id: 'dev_p22_001',
      prompt: 'test prompt for phase 22',
      personality: 'COACH',
    });
    check('AI request 200', r.status === 200);
    check('AI has anomaly_score', typeof r.data.data?.anomaly_score === 'number');
    console.log(`    anomaly_score=${r.data.data?.anomaly_score}`);
  }

  // 6. Unknown device (trust fails)
  {
    const r = await post('/verify/subscription', {
      user_id: 'test_p22_user',
      device_id: 'unknown_dev_xyz_999',
      receipt: 'rc_test',
    });
    check('Unknown device → 403', r.status === 403);
  }

  // 7. Unknown user on device verify (403)
  {
    const r = await post('/verify/device', {
      user_id: 'nonexistent_user_xyz',
      device_id: 'dev_001',
      app_version: '1.0.0',
      signature: 'sig_test',
    });
    check('Unknown user → 403', r.status === 403);
  }

  // 8. 404 catch-all
  {
    const r = await get('/nonexistent');
    check('404 catch-all', r.status === 404);
  }

  // 9. Second device verify (trust recovery check)
  {
    const r = await post('/verify/device', {
      user_id: 'test_p22_user',
      device_id: 'dev_p22_001',
      app_version: '2.2.0',
      signature: 'sig_test',
    });
    check('Re-verify 200', r.status === 200);
    check('Re-verify has effective_trust', typeof r.data.data?.effective_trust === 'number');
  }

  // 10. Second AI request (PROFESSOR personality)
  {
    const r = await post('/ai/request', {
      user_id: 'test_p22_user',
      device_id: 'dev_p22_001',
      prompt: 'tell me about recovery',
      personality: 'PROFESSOR',
    });
    check('AI professor 200', r.status === 200);
  }

  // 11. Missing fields validation
  {
    const r = await post('/ai/request', {
      user_id: 'test_p22_user',
    });
    check('Missing fields → 400', r.status === 400);
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
