import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const SERVER_DIR = path.resolve(process.cwd());
const PORT = Number(process.env.PHASE4_SMOKE_PORT || 8790);
const BASE_URL = `http://localhost:${PORT}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let json = null;
  const text = await response.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  return { response, json };
}

async function waitForHealth(maxAttempts = 40, delayMs = 250) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
    }
    await sleep(delayMs);
  }
  throw new Error('Server did not become healthy in time');
}

function startServer() {
  const child = spawn('node', ['src/index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: process.env.NODE_ENV || 'development',
      ANALYTICS_MIN_GROUP_SIZE: '2',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (buf) => {
    const line = String(buf).trim();
    if (line) process.stdout.write(`[server] ${line}\n`);
  });
  child.stderr.on('data', (buf) => {
    const line = String(buf).trim();
    if (line) process.stderr.write(`[server:err] ${line}\n`);
  });

  return child;
}

async function run() {
  console.log(`Phase 4 smoke test starting on ${BASE_URL}`);
  const server = startServer();

  try {
    await waitForHealth();
    console.log('✓ health');

    const auth = await requestJson('/auth/dev', {
      method: 'POST',
      body: JSON.stringify({ email: `analytics_${Date.now()}@fitquest.local` }),
    });
    assert(auth.response.ok, `/auth/dev failed (${auth.response.status})`);
    const accessToken = auth.json?.accessToken;
    assert(accessToken, 'missing access token');
    const authHeader = { authorization: `Bearer ${accessToken}` };
    console.log('✓ auth/dev');

    const noConsent = await requestJson('/analytics/events', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        events: [{
          event_type: 'exercise_outcome',
          goal: 'calisthenics',
          experience: 'beginner',
          exercise_id: 'push_up',
          success: true,
          sets_completed: 3,
          duration_seconds: 120,
          occurred_at: Date.now(),
        }],
      }),
    });
    assert(noConsent.response.status === 403, `expected 403 before consent, got ${noConsent.response.status}`);
    console.log('✓ analytics consent gate');

    const consent = await requestJson('/users/consent', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({}),
    });
    assert(consent.response.ok, `/users/consent failed (${consent.response.status})`);
    console.log('✓ users/consent');

    const ingest = await requestJson('/analytics/events', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        events: [
          {
            event_type: 'exercise_outcome',
            goal: 'calisthenics',
            experience: 'beginner',
            exercise_id: 'push_up',
            success: true,
            sets_completed: 3,
            duration_seconds: 140,
            occurred_at: Date.now(),
          },
          {
            event_type: 'exercise_outcome',
            goal: 'calisthenics',
            experience: 'beginner',
            exercise_id: 'push_up',
            success: false,
            sets_completed: 1,
            duration_seconds: 80,
            occurred_at: Date.now(),
          },
          {
            event_type: 'workout_session_completed',
            goal: 'calisthenics',
            experience: 'beginner',
            exercise_id: 'all',
            success: true,
            sets_completed: 5,
            duration_seconds: 900,
            occurred_at: Date.now(),
          },
        ],
      }),
    });
    assert(ingest.response.status === 202, `/analytics/events failed (${ingest.response.status})`);
    assert(ingest.json?.accepted_count === 3, 'expected three accepted analytics events');
    console.log('✓ analytics/events ingest');

    const summary = await requestJson('/analytics/summary?min_count=1&since_days=7', {
      method: 'GET',
      headers: authHeader,
    });
    assert(summary.response.ok, `/analytics/summary failed (${summary.response.status})`);
    assert(Array.isArray(summary.json?.groups), 'analytics summary groups missing');
    assert(summary.json.groups.length >= 1, 'expected at least one summary group');
    console.log('✓ analytics/summary');

    const suggestions = await requestJson('/analytics/tuning-suggestions?min_count=1&since_days=7', {
      method: 'GET',
      headers: authHeader,
    });
    assert(suggestions.response.ok, `/analytics/tuning-suggestions failed (${suggestions.response.status})`);
    assert(Array.isArray(suggestions.json?.suggestions), 'analytics suggestions missing array');
    console.log('✓ analytics/tuning-suggestions');

    const deleteUser = await requestJson('/users/data', {
      method: 'DELETE',
      headers: authHeader,
    });
    assert(deleteUser.response.status === 204, `/users/data delete failed (${deleteUser.response.status})`);
    console.log('✓ users/data delete');

    console.log('Phase 4 smoke test passed');
  } finally {
    server.kill('SIGTERM');
    await sleep(200);
    if (!server.killed) {
      server.kill('SIGKILL');
    }
  }
}

run().catch((error) => {
  console.error(`Phase 4 smoke test failed: ${error.message}`);
  process.exit(1);
});
