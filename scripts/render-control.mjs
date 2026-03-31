#!/usr/bin/env node
/**
 * Render Programmatic Control Layer
 * ──────────────────────────────────
 * Trigger deploys, verify health, fetch logs, manage env vars.
 * All operations are API-only — no dashboard dependence.
 *
 * Usage:
 *   node scripts/render-control.mjs <command> [options]
 *
 * Commands:
 *   health              Check production /health endpoint
 *   status              Get service metadata
 *   deploys             List recent deploys
 *   deploy              Trigger a new deploy
 *   logs                Fetch recent service logs
 *   env-list            List env vars (values masked)
 *   env-set KEY=VALUE   Set/update an env var
 *   env-delete KEY      Remove an env var
 *
 * Environment (from server/.env via dotenv):
 *   RENDER_API_KEY      Render API bearer token
 *   RENDER_SERVICE_ID   Service ID (srv-...)
 *   RENDER_BASE_URL     Production URL for health checks
 */
'use strict';

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load env from server/.env ──
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../server/.env');
try {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* .env optional when vars already exported */ }

const API = 'https://api.render.com/v1';
const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;
const RENDER_BASE_URL = process.env.RENDER_BASE_URL;

// ── Validate config ──
function requireConfig() {
  const missing = [];
  if (!RENDER_API_KEY) missing.push('RENDER_API_KEY');
  if (!RENDER_SERVICE_ID) missing.push('RENDER_SERVICE_ID');
  if (missing.length) {
    console.error(`FATAL: Missing env vars: ${missing.join(', ')}`);
    console.error('Set them in server/.env or export directly.');
    process.exit(1);
  }
}

function headers(json = false) {
  const h = { 'Authorization': `Bearer ${RENDER_API_KEY}`, 'Accept': 'application/json' };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

// ── API helpers ──

export async function getService() {
  const r = await fetch(`${API}/services/${RENDER_SERVICE_ID}`, { headers: headers() });
  if (!r.ok) throw new Error(`getService failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function getDeploys(limit = 5) {
  const r = await fetch(`${API}/services/${RENDER_SERVICE_ID}/deploys?limit=${limit}`, { headers: headers() });
  if (!r.ok) throw new Error(`getDeploys failed: ${r.status}`);
  return r.json();
}

export async function triggerDeploy() {
  const r = await fetch(`${API}/services/${RENDER_SERVICE_ID}/deploys`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ clearCache: 'do_not_clear' })
  });
  if (!r.ok && r.status !== 202) throw new Error(`triggerDeploy failed: ${r.status} ${await r.text()}`);
  // 202 Accepted may have empty body
  const text = await r.text();
  return text ? JSON.parse(text) : { deploy: { id: 'pending', status: 'created' } };
}

export async function getLogs() {
  const r = await fetch(`${API}/services/${RENDER_SERVICE_ID}/logs`, { headers: headers() });
  if (!r.ok) throw new Error(`getLogs failed: ${r.status}`);
  return r.json();
}

export async function getEnvVars() {
  const r = await fetch(`${API}/services/${RENDER_SERVICE_ID}/env-vars`, { headers: headers() });
  if (!r.ok) throw new Error(`getEnvVars failed: ${r.status}`);
  return r.json();
}

export async function setEnvVar(key, value) {
  // Render PUT replaces ALL env vars, so read-modify-write
  const current = await getEnvVars();
  const vars = current.map(e => ({ key: (e.envVar || e).key, value: (e.envVar || e).value }));
  const idx = vars.findIndex(v => v.key === key);
  if (idx >= 0) vars[idx].value = value;
  else vars.push({ key, value });

  const r = await fetch(`${API}/services/${RENDER_SERVICE_ID}/env-vars`, {
    method: 'PUT',
    headers: headers(true),
    body: JSON.stringify(vars)
  });
  if (!r.ok) throw new Error(`setEnvVar failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function deleteEnvVar(key) {
  const current = await getEnvVars();
  const vars = current
    .map(e => ({ key: (e.envVar || e).key, value: (e.envVar || e).value }))
    .filter(v => v.key !== key);

  const r = await fetch(`${API}/services/${RENDER_SERVICE_ID}/env-vars`, {
    method: 'PUT',
    headers: headers(true),
    body: JSON.stringify(vars)
  });
  if (!r.ok) throw new Error(`deleteEnvVar failed: ${r.status}`);
  return r.json();
}

export async function verifyHealth(expectedVersion, expectedPhase) {
  const url = RENDER_BASE_URL || 'https://fitq-56sj.onrender.com';
  const r = await fetch(`${url}/health`);
  if (!r.ok) throw new Error(`Health check failed: ${r.status}`);
  const body = await r.json();
  const data = body.data || body;
  const result = { ok: true, version: data.version, phase: data.phase, status: data.status };
  if (expectedVersion && data.version !== expectedVersion) {
    result.ok = false;
    result.error = `Version mismatch: expected ${expectedVersion}, got ${data.version}`;
  }
  if (expectedPhase && data.phase !== expectedPhase) {
    result.ok = false;
    result.error = `Phase mismatch: expected ${expectedPhase}, got ${data.phase}`;
  }
  return result;
}

// ── CLI ──
const cmd = process.argv[2];

if (cmd) {
  requireConfig();

  const run = {
    async health() {
      const h = await verifyHealth();
      console.log(h.ok ? '✅ HEALTHY' : '❌ UNHEALTHY');
      console.log(`   Version: ${h.version} | Phase: ${h.phase} | Status: ${h.status}`);
      if (h.error) console.log(`   Error: ${h.error}`);
      process.exit(h.ok ? 0 : 1);
    },
    async status() {
      const s = await getService();
      const svc = s.service || s;
      console.log(`Service: ${svc.name || svc.id}`);
      console.log(`Type: ${svc.type} | Runtime: ${svc.env || svc.runtime}`);
      console.log(`URL: ${svc.serviceDetails?.url || 'N/A'}`);
      console.log(`Auto-deploy: ${svc.autoDeploy}`);
      console.log(`Branch: ${svc.branch || svc.sourceBranch || 'N/A'}`);
      console.log(`Updated: ${svc.updatedAt}`);
    },
    async deploys() {
      const d = await getDeploys();
      const list = Array.isArray(d) ? d : [d];
      for (const item of list) {
        const dep = item.deploy || item;
        const msg = dep.commit?.message?.split('\n')[0]?.slice(0, 60) || 'N/A';
        console.log(`${dep.id}  ${dep.status.padEnd(12)}  ${dep.createdAt}  ${msg}`);
      }
    },
    async deploy() {
      console.log('Triggering deploy...');
      const d = await triggerDeploy();
      const dep = d.deploy || d;
      console.log(`Deploy ${dep.id} triggered (status: ${dep.status})`);
    },
    async logs() {
      const l = await getLogs();
      const entries = Array.isArray(l) ? l : [l];
      for (const e of entries) {
        const log = e.log || e;
        console.log(`[${log.timestamp || ''}] ${log.message || JSON.stringify(log)}`);
      }
    },
    'env-list': async () => {
      const vars = await getEnvVars();
      for (const item of vars) {
        const v = item.envVar || item;
        const masked = v.value ? v.value.slice(0, 6) + '...' : '(empty)';
        console.log(`${v.key} = ${masked}`);
      }
    },
    'env-set': async () => {
      const pair = process.argv[3];
      if (!pair || !pair.includes('=')) { console.error('Usage: env-set KEY=VALUE'); process.exit(1); }
      const [key, ...rest] = pair.split('=');
      const value = rest.join('=');
      await setEnvVar(key, value);
      console.log(`✅ ${key} set`);
    },
    'env-delete': async () => {
      const key = process.argv[3];
      if (!key) { console.error('Usage: env-delete KEY'); process.exit(1); }
      await deleteEnvVar(key);
      console.log(`✅ ${key} deleted`);
    }
  };

  if (!run[cmd]) {
    console.error(`Unknown command: ${cmd}`);
    console.error('Commands: health, status, deploys, deploy, logs, env-list, env-set, env-delete');
    process.exit(1);
  }

  run[cmd]().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
