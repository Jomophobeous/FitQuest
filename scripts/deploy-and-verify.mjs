#!/usr/bin/env node
/**
 * Deploy → Poll → Verify Pipeline
 * ─────────────────────────────────
 * 1. Trigger Render deploy
 * 2. Poll deploy status every 10s until live/failed
 * 3. Hit /health, validate version + phase
 * 4. On failure — pull logs immediately
 *
 * Usage:
 *   node scripts/deploy-and-verify.mjs [--version 5.0.0] [--phase 27]
 *
 * Exit codes:
 *   0 = deploy live + health verified
 *   1 = deploy failed or health mismatch
 */
'use strict';

import {
  triggerDeploy,
  getDeploys,
  verifyHealth,
  getLogs
} from './render-control.mjs';

// ── Parse args ──
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const expectedVersion = flag('version');
const expectedPhase = flag('phase') ? Number(flag('phase')) : undefined;

// ── Config ──
const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 60; // 10min max

function ts() { return new Date().toISOString().slice(11, 19); }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getLatestDeployStatus() {
  const deploys = await getDeploys(1);
  const list = Array.isArray(deploys) ? deploys : [deploys];
  if (!list.length) return null;
  const dep = list[0].deploy || list[0];
  return dep;
}

async function pullLogs() {
  console.log('\n📋 Pulling recent logs...');
  try {
    const logs = await getLogs();
    const entries = Array.isArray(logs) ? logs : [logs];
    for (const e of entries.slice(-30)) {
      const log = e.log || e;
      console.log(`  [${log.timestamp || ''}] ${log.message || JSON.stringify(log)}`);
    }
  } catch (e) {
    console.error('  Could not fetch logs:', e.message);
  }
}

// ── Main ──
async function main() {
  console.log(`[${ts()}] Triggering deploy...`);
  const d = await triggerDeploy();
  const dep = d.deploy || d;
  console.log(`[${ts()}] Deploy ${dep.id} triggered (status: ${dep.status})`);

  // Poll
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const latest = await getLatestDeployStatus();
    if (!latest) { console.log(`[${ts()}] No deploy found`); continue; }

    const status = (latest.status || '').toLowerCase();
    console.log(`[${ts()}] Poll ${i + 1}/${MAX_POLLS}: ${latest.id} → ${status}`);

    if (status === 'live') {
      console.log(`[${ts()}] Deploy is LIVE`);
      break;
    }
    if (status === 'deactivated' || status === 'build_failed' || status === 'update_failed' || status === 'canceled') {
      console.error(`[${ts()}] Deploy FAILED: ${status}`);
      await pullLogs();
      process.exit(1);
    }
  }

  // Health check (with retry — server may need a cold-start moment)
  console.log(`\n[${ts()}] Running health check...`);
  let health;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      health = await verifyHealth(expectedVersion, expectedPhase);
      if (health.ok) break;
    } catch (e) {
      console.log(`[${ts()}] Health attempt ${attempt}/6 failed: ${e.message}`);
    }
    if (attempt < 6) await sleep(10_000);
  }

  if (!health || !health.ok) {
    console.error(`[${ts()}] HEALTH CHECK FAILED`);
    if (health?.error) console.error(`  ${health.error}`);
    await pullLogs();
    process.exit(1);
  }

  console.log(`[${ts()}] VERIFIED`);
  console.log(`  Version: ${health.version}`);
  console.log(`  Phase:   ${health.phase}`);
  console.log(`  Status:  ${health.status}`);
  process.exit(0);
}

main().catch(e => {
  console.error(`FATAL: ${e.message}`);
  process.exit(1);
});
