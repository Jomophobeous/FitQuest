/**
 * FitQuest Offline Queue — Phase 25B
 *
 * SQLite-backed queue for actions performed while offline.
 * All queued actions are unverified until the sync engine
 * submits them to the authority server.
 *
 * Allowed offline actions: workout_complete, xp_earn, step_log, jog_log, progress_photo
 * Disallowed offline: subscription_unlock, reward_finalize, ai_request
 */

import { getDatabase } from '../database/schema';
import * as Crypto from 'expo-crypto';
import { getStableDeviceId } from './deviceSignature';

// ── Types ──

export type QueueActionType =
  | 'workout_complete'
  | 'xp_earn'
  | 'step_log'
  | 'jog_log'
  | 'progress_photo'
  | 'streak_update';

export type QueueStatus = 'pending' | 'syncing' | 'accepted' | 'rejected' | 'failed';

export interface QueuedAction {
  action_id: string;
  type: QueueActionType;
  payload: Record<string, unknown>;
  device_id: string;
  verified: boolean;
  retry_count: number;
  status: QueueStatus;
  error_message: string | null;
  created_at: number;
  synced_at: number | null;
}

// Actions that are NEVER allowed offline — require live server
const ONLINE_ONLY_ACTIONS = new Set(['subscription_unlock', 'reward_finalize', 'ai_request']);

// ── Queue Operations ──

/**
 * Enqueue an action for deferred server verification.
 * Returns the action_id (UUID) for tracking.
 */
export async function enqueueAction(type: QueueActionType, payload: Record<string, unknown>): Promise<string> {
  if (ONLINE_ONLY_ACTIONS.has(type)) {
    throw new Error(`Action "${type}" requires online connectivity. Cannot queue.`);
  }

  const db = await getDatabase();
  const actionId = Crypto.randomUUID();
  const deviceId = await getStableDeviceId();
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO offline_queue (action_id, type, payload, device_id, verified, retry_count, status, created_at)
     VALUES (?, ?, ?, ?, 0, 0, 'pending', ?)`,
    [actionId, type, JSON.stringify(payload), deviceId, now],
  );

  return actionId;
}

/**
 * Get all pending actions (not yet synced), ordered by creation time.
 */
export async function getPendingActions(): Promise<QueuedAction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    action_id: string;
    type: string;
    payload: string;
    device_id: string;
    verified: number;
    retry_count: number;
    status: string;
    error_message: string | null;
    created_at: number;
    synced_at: number | null;
  }>(`SELECT * FROM offline_queue WHERE status IN ('pending', 'failed') ORDER BY created_at ASC`);

  return rows.map(toQueuedAction);
}

/**
 * Get count of pending actions.
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM offline_queue WHERE status IN ('pending', 'failed')`,
  );
  return result?.cnt ?? 0;
}

/**
 * Mark actions as syncing (in-progress).
 */
export async function markSyncing(actionIds: string[]): Promise<void> {
  if (actionIds.length === 0) return;
  const db = await getDatabase();
  const placeholders = actionIds.map(() => '?').join(',');
  await db.runAsync(`UPDATE offline_queue SET status = 'syncing' WHERE action_id IN (${placeholders})`, actionIds);
}

/**
 * Mark an action as accepted by the server.
 */
export async function markAccepted(actionId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE offline_queue SET status = 'accepted', verified = 1, synced_at = ? WHERE action_id = ?`, [
    Date.now(),
    actionId,
  ]);
}

/**
 * Mark an action as rejected by the server.
 */
export async function markRejected(actionId: string, errorMessage: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE offline_queue SET status = 'rejected', error_message = ?, synced_at = ? WHERE action_id = ?`,
    [errorMessage, Date.now(), actionId],
  );
}

/**
 * Mark an action as failed (transient error, will retry).
 */
export async function markFailed(actionId: string, errorMessage: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE offline_queue SET status = 'failed', retry_count = retry_count + 1, error_message = ? WHERE action_id = ?`,
    [errorMessage, actionId],
  );
}

/**
 * Prune old accepted/rejected actions (keep last 7 days).
 */
export async function pruneOldActions(): Promise<number> {
  const db = await getDatabase();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const result = await db.runAsync(
    `DELETE FROM offline_queue WHERE status IN ('accepted', 'rejected') AND created_at < ?`,
    [cutoff],
  );
  return result.changes;
}

/**
 * Remove actions that have exceeded max retries (5).
 */
export async function removeExhaustedActions(): Promise<string[]> {
  const db = await getDatabase();
  const exhausted = await db.getAllAsync<{ action_id: string }>(
    `SELECT action_id FROM offline_queue WHERE retry_count >= 5 AND status = 'failed'`,
  );
  const ids = exhausted.map((r) => r.action_id);
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE offline_queue SET status = 'rejected', error_message = 'Max retries exceeded' WHERE action_id IN (${placeholders})`,
      ids,
    );
  }
  return ids;
}

/**
 * Clear all queue data (emergency reset).
 */
export async function clearQueue(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM offline_queue`);
}

// ── Helpers ──

function toQueuedAction(row: {
  action_id: string;
  type: string;
  payload: string;
  device_id: string;
  verified: number;
  retry_count: number;
  status: string;
  error_message: string | null;
  created_at: number;
  synced_at: number | null;
}): QueuedAction {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    /* corrupt payload — empty object */
  }

  return {
    action_id: row.action_id,
    type: row.type as QueueActionType,
    payload,
    device_id: row.device_id,
    verified: row.verified === 1,
    retry_count: row.retry_count,
    status: row.status as QueueStatus,
    error_message: row.error_message,
    created_at: row.created_at,
    synced_at: row.synced_at,
  };
}
