/**
 * Security Bridge — Reconciliation queue for offline security events.
 *
 * When the app goes offline, security-relevant events are queued here.
 * When connectivity is restored, the batch is sent to the server
 * for reconciliation (server is the final authority).
 *
 * ENFORCEMENT: Queued events must be reconciled. Unreconciled batches
 * beyond a threshold trigger tamperEngine risk escalation.
 */

import { tamperEngine } from './tamperEngine';

const MAX_PENDING_BATCHES = 50;

interface ReconciliationBatch {
  timestamp: number;
  data: Record<string, unknown>;
}

const pendingBatches: ReconciliationBatch[] = [];

export function queueReconciliationBatch(batch: Record<string, unknown>): void {
  pendingBatches.push({
    timestamp: Date.now(),
    data: batch,
  });

  // If too many unreconciled batches, escalate risk
  if (pendingBatches.length > MAX_PENDING_BATCHES) {
    if (__DEV__) console.warn(`[SecurityBridge] ${pendingBatches.length} pending batches — escalating risk`);
    tamperEngine.requestBridgeVerification();
  }
}

/**
 * Get all pending batches for reconciliation.
 * Called when connectivity is restored.
 */
export function getPendingBatches(): ReconciliationBatch[] {
  return [...pendingBatches];
}

/**
 * Clear reconciled batches.
 * Called after server confirms reconciliation.
 */
export function clearReconciledBatches(count: number): void {
  pendingBatches.splice(0, count);
}

/**
 * Get count of pending batches (for diagnostics).
 */
export function getPendingCount(): number {
  return pendingBatches.length;
}
