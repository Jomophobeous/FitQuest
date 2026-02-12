import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const SERVER_DIR = path.resolve(process.cwd());
const PORT = Number(process.env.PHASE3_SMOKE_PORT || 8789);
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
  console.log(`Phase 3 smoke test starting on ${BASE_URL}`);
  const server = startServer();

  try {
    await waitForHealth();
    console.log('✓ health');

    const auth = await requestJson('/auth/dev', {
      method: 'POST',
      body: JSON.stringify({ email: `sync_${Date.now()}@fitquest.local` }),
    });
    assert(auth.response.ok, `/auth/dev failed (${auth.response.status})`);
    const accessToken = auth.json?.accessToken;
    assert(accessToken, 'missing access token');
    const authHeader = { authorization: `Bearer ${accessToken}` };
    console.log('✓ auth/dev');

    const backup = await requestJson('/backups', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ blob: '{"phase3":"snapshot"}', meta: { source: 'phase3-smoke' } }),
    });
    assert(backup.response.ok, `/backups create failed (${backup.response.status})`);
    const backupId = backup.json?.id;
    assert(backupId, 'missing backup id');
    console.log('✓ backup snapshot');

    const putV1 = await requestJson('/sync/state-meta', {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        version: 1,
        base_hash: 'base_hash_v1',
        state_hash: 'state_hash_v1',
        backup_id: backupId,
        device_id: 'device_phase3_a',
      }),
    });
    assert(putV1.response.ok, `/sync/state-meta v1 failed (${putV1.response.status})`);
    assert(putV1.json?.state_meta?.version === 1, 'state_meta version mismatch for v1');
    console.log('✓ sync/state-meta v1');

    const latestV1 = await requestJson('/sync/state-meta/latest', {
      method: 'GET',
      headers: authHeader,
    });
    assert(latestV1.response.ok, `/sync/state-meta/latest failed (${latestV1.response.status})`);
    assert(latestV1.json?.state_meta?.version === 1, 'latest state_meta should be v1');
    console.log('✓ sync/state-meta latest');

    const eventId = `evt_${Date.now()}`;
    const appendEvents = await requestJson('/sync/events', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        events: [
          {
            id: eventId,
            event_type: 'completed_session',
            occurred_at: Date.now(),
            device_id: 'device_phase3_a',
            state_version: 1,
            payload: { session_id: 'session_a', duration_minutes: 20, success: true },
          },
          {
            id: eventId,
            event_type: 'completed_session',
            occurred_at: Date.now(),
            device_id: 'device_phase3_a',
            state_version: 1,
            payload: { session_id: 'session_a', duration_minutes: 20, success: true },
          },
        ],
      }),
    });
    assert(appendEvents.response.ok, `/sync/events append failed (${appendEvents.response.status})`);
    assert(appendEvents.json?.accepted_count === 1, 'expected one accepted event after dedupe');
    assert(appendEvents.json?.skipped_count === 1, 'expected one skipped duplicate event');
    console.log('✓ sync/events append + dedupe');

    const listEvents = await requestJson('/sync/events?since=0&limit=50', {
      method: 'GET',
      headers: authHeader,
    });
    assert(listEvents.response.ok, `/sync/events list failed (${listEvents.response.status})`);
    assert(Array.isArray(listEvents.json?.events), 'events response missing array');
    assert(listEvents.json.events.some((event) => event.id === eventId), 'expected event not found');
    console.log('✓ sync/events list');

    const staleV1 = await requestJson('/sync/state-meta', {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        version: 1,
        base_hash: 'base_hash_v1',
        state_hash: 'state_hash_v1_conflict',
        backup_id: backupId,
        device_id: 'device_phase3_b',
      }),
    });
    assert(staleV1.response.status === 409, `expected 409 for same-version conflict, got ${staleV1.response.status}`);
    console.log('✓ sync/state-meta conflict');

    const putV2 = await requestJson('/sync/state-meta', {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        version: 2,
        base_hash: 'state_hash_v1',
        state_hash: 'state_hash_v2',
        backup_id: backupId,
        device_id: 'device_phase3_b',
      }),
    });
    assert(putV2.response.ok, `/sync/state-meta v2 failed (${putV2.response.status})`);
    assert(putV2.json?.state_meta?.version === 2, 'state_meta version mismatch for v2');
    console.log('✓ sync/state-meta v2');

    const latestV2 = await requestJson('/sync/state-meta/latest', {
      method: 'GET',
      headers: authHeader,
    });
    assert(latestV2.response.ok, `/sync/state-meta/latest v2 failed (${latestV2.response.status})`);
    assert(latestV2.json?.state_meta?.version === 2, 'latest state_meta should be v2');
    console.log('✓ sync/state-meta latest v2');

    const deleteUser = await requestJson('/users/data', {
      method: 'DELETE',
      headers: authHeader,
    });
    assert(deleteUser.response.status === 204, `/users/data delete failed (${deleteUser.response.status})`);
    console.log('✓ users/data delete');

    console.log('Phase 3 smoke test passed');
  } finally {
    server.kill('SIGTERM');
    await sleep(200);
    if (!server.killed) {
      server.kill('SIGKILL');
    }
  }
}

run().catch((error) => {
  console.error(`Phase 3 smoke test failed: ${error.message}`);
  process.exit(1);
});
