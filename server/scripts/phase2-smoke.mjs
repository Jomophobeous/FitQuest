import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const SERVER_DIR = path.resolve(process.cwd());
const PORT = Number(process.env.PHASE2_SMOKE_PORT || 8788);
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
      // retry
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
  console.log(`Phase 2 smoke test starting on ${BASE_URL}`);
  const server = startServer();

  try {
    await waitForHealth();
    console.log('✓ health');

    const auth = await requestJson('/auth/dev', {
      method: 'POST',
      body: JSON.stringify({ email: `smoke_${Date.now()}@fitquest.local` }),
    });
    assert(auth.response.ok, `/auth/dev failed (${auth.response.status})`);
    assert(auth.json?.accessToken && auth.json?.refreshToken, '/auth/dev missing tokens');
    let accessToken = auth.json.accessToken;
    let refreshToken = auth.json.refreshToken;
    console.log('✓ auth/dev');

    const refreshed = await requestJson('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    assert(refreshed.response.ok, `/auth/refresh failed (${refreshed.response.status})`);
    assert(refreshed.json?.accessToken && refreshed.json?.refreshToken, '/auth/refresh missing tokens');
    assert(refreshed.json.refreshToken !== refreshToken, 'refresh token did not rotate');
    accessToken = refreshed.json.accessToken;
    refreshToken = refreshed.json.refreshToken;
    console.log('✓ auth/refresh rotation');

    const authHeader = { authorization: `Bearer ${accessToken}` };

    const me = await requestJson('/me', { method: 'GET', headers: authHeader });
    assert(me.response.ok, `/me failed (${me.response.status})`);
    assert(me.json?.user?.id, '/me missing user');
    console.log('✓ me');

    const consent = await requestJson('/users/consent', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({}),
    });
    assert(consent.response.ok, `/users/consent failed (${consent.response.status})`);
    assert(consent.json?.consentTimestamp, '/users/consent missing timestamp');
    console.log('✓ users/consent');

    const migrate = await requestJson('/users/migrate', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ deviceId: `device_${Date.now()}` }),
    });
    assert(migrate.response.ok, `/users/migrate failed (${migrate.response.status})`);
    assert(migrate.json?.deviceId, '/users/migrate missing deviceId');
    console.log('✓ users/migrate');

    const created = await requestJson('/backups', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ blob: '{"phase2":"smoke-v1"}', meta: { bytes: 18 } }),
    });
    assert(created.response.ok, `/backups create failed (${created.response.status})`);
    const backupId = created.json?.id;
    assert(backupId, 'create backup missing id');
    console.log('✓ backups create');

    const listed = await requestJson('/backups', { method: 'GET', headers: authHeader });
    assert(listed.response.ok, `/backups list failed (${listed.response.status})`);
    assert(Array.isArray(listed.json?.backups), 'backups list missing array');
    assert(listed.json.backups.some((b) => b.id === backupId), 'created backup not listed');
    console.log('✓ backups list');

    const fetched = await requestJson(`/backups/${encodeURIComponent(backupId)}`, {
      method: 'GET',
      headers: authHeader,
    });
    assert(fetched.response.ok, `/backups/:id fetch failed (${fetched.response.status})`);
    assert(String(fetched.json?.blob || '').includes('smoke-v1'), 'fetched backup blob mismatch');
    console.log('✓ backups fetch');

    const overwrite = await requestJson(`/backups/${encodeURIComponent(backupId)}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ blob: '{"phase2":"smoke-v2"}', meta: { bytes: 18 } }),
    });
    assert(overwrite.response.ok, `/backups/:id overwrite failed (${overwrite.response.status})`);

    const fetched2 = await requestJson(`/backups/${encodeURIComponent(backupId)}`, {
      method: 'GET',
      headers: authHeader,
    });
    assert(fetched2.response.ok, `/backups/:id fetch after overwrite failed (${fetched2.response.status})`);
    assert(String(fetched2.json?.blob || '').includes('smoke-v2'), 'overwrite backup blob mismatch');
    console.log('✓ backups overwrite');

    const exported = await requestJson('/users/export', { method: 'GET', headers: authHeader });
    assert(exported.response.ok, `/users/export failed (${exported.response.status})`);
    assert(Array.isArray(exported.json?.backups), '/users/export missing backups');
    assert(Array.isArray(exported.json?.migrations), '/users/export missing migrations');
    console.log('✓ users/export');

    const logout = await requestJson('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    assert(logout.response.status === 204, `/auth/logout failed (${logout.response.status})`);
    console.log('✓ auth/logout');

    const deleteBackup = await requestJson(`/backups/${encodeURIComponent(backupId)}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    assert(deleteBackup.response.status === 204, `/backups delete failed (${deleteBackup.response.status})`);
    console.log('✓ backups delete');

    const deleteUser = await requestJson('/users/data', {
      method: 'DELETE',
      headers: authHeader,
    });
    assert(deleteUser.response.status === 204, `/users/data delete failed (${deleteUser.response.status})`);
    console.log('✓ users/data delete');

    const exportAfterDelete = await requestJson('/users/export', {
      method: 'GET',
      headers: authHeader,
    });
    assert(exportAfterDelete.response.status === 404, `expected /users/export 404 after delete, got ${exportAfterDelete.response.status}`);
    console.log('✓ post-delete export check');

    console.log('Phase 2 smoke test passed');
  } finally {
    server.kill('SIGTERM');
    await sleep(200);
    if (!server.killed) {
      server.kill('SIGKILL');
    }
  }
}

run().catch((error) => {
  console.error(`Phase 2 smoke test failed: ${error.message}`);
  process.exit(1);
});
