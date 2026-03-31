/**
 * FitQuest Sync Engine — Phase 25B
 *
 * Batch-syncs queued offline actions to the authority server.
 * Every sync is preceded by a challenge-response handshake.
 * Server is final authority — accepted values overwrite local state.
 *
 * Flow:
 *   1. Acquire challenge (POST /auth/challenge)
 *   2. Compute response (SHA-256)
 *   3. Submit batch (POST /sync/batch) with challenge proof
 *   4. Process results: mark accepted/rejected per action
 *   5. Apply server corrections (XP, subscription, progression)
 */

import { getApiBaseUrl } from './apiBaseUrl';
import { getStableDeviceId, computeChallengeResponse, getAppVersion } from './deviceSignature';
import {
  getPendingActions,
  markSyncing,
  markAccepted,
  markRejected,
  markFailed,
  pruneOldActions,
  removeExhaustedActions,
  type QueuedAction,
} from './offlineQueue';

// ── Types ──

interface SyncResult {
  synced: number;
  rejected: number;
  failed: number;
  serverXP: number | null;
  serverSubscriptionStatus: string | null;
}

interface BatchActionResult {
  action_id: string;
  status: 'accepted' | 'rejected';
  error?: string;
}

interface BatchSyncResponse {
  success: boolean;
  data: {
    results: BatchActionResult[];
    server_xp: number | null;
    subscription_status: string | null;
    verified_at: string;
  } | null;
  error: string | null;
}

// ── Constants ──

const AUTHORITY_API_KEY = process.env.EXPO_PUBLIC_AUTHORITY_API_KEY || '';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_BATCH_SIZE = 50;

// Mutex to prevent concurrent syncs
let syncInProgress = false;

// ── Core Sync ──

/**
 * Sync all pending actions to the authority server.
 * Returns summary of what was synced.
 */
export async function syncPendingActions(): Promise<SyncResult> {
  if (syncInProgress) {
    return { synced: 0, rejected: 0, failed: 0, serverXP: null, serverSubscriptionStatus: null };
  }

  syncInProgress = true;
  const result: SyncResult = { synced: 0, rejected: 0, failed: 0, serverXP: null, serverSubscriptionStatus: null };

  try {
    // Housekeeping first
    await removeExhaustedActions();
    await pruneOldActions();

    const pending = await getPendingActions();
    if (pending.length === 0) return result;

    // Process in batches
    for (let i = 0; i < pending.length; i += MAX_BATCH_SIZE) {
      const batch = pending.slice(i, i + MAX_BATCH_SIZE);
      const batchResult = await syncBatch(batch);

      result.synced += batchResult.synced;
      result.rejected += batchResult.rejected;
      result.failed += batchResult.failed;
      if (batchResult.serverXP !== null) result.serverXP = batchResult.serverXP;
      if (batchResult.serverSubscriptionStatus !== null) {
        result.serverSubscriptionStatus = batchResult.serverSubscriptionStatus;
      }
    }

    // Apply server corrections
    if (result.serverXP !== null) {
      await applyServerXP(result.serverXP);
    }
    if (result.serverSubscriptionStatus !== null) {
      await applyServerSubscriptionStatus(result.serverSubscriptionStatus);
    }
  } catch (e) {
    if (__DEV__) console.warn('[SyncEngine] Sync failed:', e);
  } finally {
    syncInProgress = false;
  }

  return result;
}

/**
 * Sync a single batch of actions with challenge-response authentication.
 */
async function syncBatch(actions: QueuedAction[]): Promise<SyncResult> {
  const batchResult: SyncResult = { synced: 0, rejected: 0, failed: 0, serverXP: null, serverSubscriptionStatus: null };

  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    // Offline — mark all as failed
    for (const action of actions) {
      await markFailed(action.action_id, 'No network');
      batchResult.failed++;
    }
    return batchResult;
  }

  const actionIds = actions.map((a) => a.action_id);

  try {
    // Mark as syncing
    await markSyncing(actionIds);

    // Step 1: Acquire challenge
    const deviceId = await getStableDeviceId();
    const appVersion = getAppVersion();

    const challengeRes = await timedFetch(`${baseUrl}/auth/challenge`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ user_id: 'user_local_001', device_id: deviceId }),
    });

    if (!challengeRes.ok) {
      // Challenge failed — revert to pending
      for (const action of actions) {
        await markFailed(action.action_id, `Challenge failed: ${challengeRes.status}`);
        batchResult.failed++;
      }
      return batchResult;
    }

    const challengeJson = await challengeRes.json();
    if (!challengeJson.data?.challenge_id || !challengeJson.data?.nonce) {
      for (const action of actions) {
        await markFailed(action.action_id, 'Invalid challenge response');
        batchResult.failed++;
      }
      return batchResult;
    }

    // Step 2: Compute response
    const { challenge_id, nonce } = challengeJson.data;
    const response = await computeChallengeResponse(nonce, deviceId);

    // Step 3: Submit batch with challenge proof
    const batchPayload = {
      challenge_id,
      response,
      app_version: appVersion,
      device_id: deviceId,
      actions: actions.map((a) => ({
        action_id: a.action_id,
        type: a.type,
        payload: a.payload,
        created_at: a.created_at,
      })),
    };

    const syncRes = await timedFetch(`${baseUrl}/sync/batch`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(batchPayload),
    });

    if (!syncRes.ok) {
      // Server error — revert to failed for retry
      const errText = await syncRes.text().catch(() => 'Unknown');
      for (const action of actions) {
        await markFailed(action.action_id, `Server ${syncRes.status}: ${errText.slice(0, 200)}`);
        batchResult.failed++;
      }
      return batchResult;
    }

    const syncJson: BatchSyncResponse = await syncRes.json();
    if (!syncJson.success || !syncJson.data) {
      for (const action of actions) {
        await markFailed(action.action_id, syncJson.error || 'Sync response invalid');
        batchResult.failed++;
      }
      return batchResult;
    }

    // Step 4: Process per-action results
    const resultMap = new Map(syncJson.data.results.map((r) => [r.action_id, r]));

    for (const action of actions) {
      const actionResult = resultMap.get(action.action_id);
      if (!actionResult) {
        // Server didn't acknowledge — keep as failed
        await markFailed(action.action_id, 'Not acknowledged by server');
        batchResult.failed++;
        continue;
      }

      if (actionResult.status === 'accepted') {
        await markAccepted(action.action_id);
        batchResult.synced++;
      } else {
        await markRejected(action.action_id, actionResult.error || 'Rejected by server');
        batchResult.rejected++;
      }
    }

    // Capture server-authoritative state
    batchResult.serverXP = syncJson.data.server_xp;
    batchResult.serverSubscriptionStatus = syncJson.data.subscription_status;
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : 'Unknown error';
    for (const action of actions) {
      await markFailed(action.action_id, errMsg);
      batchResult.failed++;
    }
  }

  return batchResult;
}

// ── Server State Application ──

/**
 * Overwrite local XP with server-authoritative value.
 */
async function applyServerXP(serverXP: number): Promise<void> {
  try {
    const { setServerAuthoritativeXP } = await import('./xpService');
    await setServerAuthoritativeXP(serverXP);
    const { setAppState } = await import('../database/service');
    await setAppState('last_xp_sync', Date.now().toString());
    if (__DEV__) console.log(`[SyncEngine] XP overwritten with server value: ${serverXP}`);
  } catch (e) {
    if (__DEV__) console.warn('[SyncEngine] Failed to apply server XP:', e);
  }
}

/**
 * Update local subscription cache with server-authoritative status.
 */
async function applyServerSubscriptionStatus(status: string): Promise<void> {
  try {
    const { updateCachedSubscription } = await import('./subscriptionEnforcer');
    await updateCachedSubscription(status);
    if (__DEV__) console.log(`[SyncEngine] Subscription status set to: ${status}`);
  } catch (e) {
    if (__DEV__) console.warn('[SyncEngine] Failed to apply subscription status:', e);
  }
}

// ── Helpers ──

function getBaseUrl(): string | null {
  try {
    return getApiBaseUrl();
  } catch {
    return null;
  }
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Version': getAppVersion(),
  };
  if (AUTHORITY_API_KEY) {
    headers['Authorization'] = `Bearer ${AUTHORITY_API_KEY}`;
  }
  return headers;
}

async function timedFetch(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
