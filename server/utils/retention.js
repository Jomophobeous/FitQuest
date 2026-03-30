/**
 * Data Retention Runner — Phase 23 (D1-D3)
 *
 * Invokes Supabase RPC functions for data lifecycle management:
 *   - purge_old_events()    → 90 days retention
 *   - purge_old_anomalies() → 180 days retention
 *   - purge_old_ai_usage()  → 90 days retention
 *
 * Runs once on startup (after 60s delay) and then every 24 hours.
 * All operations are fire-and-forget — retention failures never block the server.
 */
'use strict';

const supabase = require('./supabaseClient');

const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STARTUP_DELAY_MS = 60 * 1000; // 60 seconds after boot

/**
 * Execute a single retention purge via Supabase RPC.
 * Returns the number of deleted rows, or -1 on error.
 */
async function executePurge(functionName) {
  try {
    const { data, error } = await supabase.rpc(functionName);
    if (error) {
      console.error(`[retention] ${functionName} error:`, error.message);
      return -1;
    }
    return data || 0;
  } catch (err) {
    console.error(`[retention] ${functionName} exception:`, err.message);
    return -1;
  }
}

/**
 * Run all retention purges. Logs results.
 */
async function runRetentionCycle() {
  console.log('[retention] Starting data retention cycle...');
  const start = Date.now();

  const [events, anomalies, aiUsage] = await Promise.all([
    executePurge('purge_old_events'),
    executePurge('purge_old_anomalies'),
    executePurge('purge_old_ai_usage'),
  ]);

  const elapsed = Date.now() - start;
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    type: 'retention_cycle',
    events_purged: events,
    anomalies_purged: anomalies,
    ai_usage_purged: aiUsage,
    elapsed_ms: elapsed,
  }));
}

let retentionInterval = null;

/**
 * Start the retention scheduler.
 * Runs once after startup delay, then every 24 hours.
 */
function startRetentionScheduler() {
  // Delay first run to avoid contention during startup
  setTimeout(() => {
    runRetentionCycle().catch(() => {}); // Never throws

    retentionInterval = setInterval(() => {
      runRetentionCycle().catch(() => {});
    }, RETENTION_INTERVAL_MS);

    // Ensure interval doesn't prevent graceful shutdown
    if (retentionInterval.unref) retentionInterval.unref();
  }, STARTUP_DELAY_MS);
}

/**
 * Stop the retention scheduler (for graceful shutdown).
 */
function stopRetentionScheduler() {
  if (retentionInterval) {
    clearInterval(retentionInterval);
    retentionInterval = null;
  }
}

module.exports = {
  runRetentionCycle,
  startRetentionScheduler,
  stopRetentionScheduler,
};
