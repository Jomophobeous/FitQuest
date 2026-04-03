/**
 * FitQuest Security Bridge — Phase 18 (Backend-Assisted Verification)
 *
 * Optional server-side validation that strengthens offline-first security
 * without affecting UX. Backend is ADVISORY — only strengthens confidence,
 * never blocks or degrades users offline.
 *
 * Phase 15: Kill-switch readiness.
 * Phase 17: Reconciliation batch support, offline signal packaging.
 * Phase 18: Live verification dispatch. Client packages state snapshots,
 *   server verifies contradictions against entitlement ground truth,
 *   returns confidence adjustments and flag corrections. Throttled,
 *   timeout-protected, fully offline-safe: null response = no-op.
 *
 * Verification flow:
 *   1. Client packages BridgeVerificationRequest (signals, flags, metrics)
 *   2. dispatchBridgeVerification() sends to server (throttled, 5s timeout)
 *   3. Server returns BridgeVerificationResponse (confirmed contradictions,
 *      entitlement truth, confidence boost, flag overrides)
 *   4. tamperEngine.applyBridgeVerification() processes response
 *   5. On failure or offline → null return → system continues unchanged
 *
 * Offline autonomy guarantee:
 *   - System remains fully functional offline
 *   - Server can only strengthen confidence, never weaken below current
 *   - Null/error/timeout → silent no-op, zero UX impact
 */

import type { VerificationConfidence, SessionMetrics } from './tamperEngine';
import { getApiBaseUrl } from '../apiBaseUrl';

// ── Types ──

export interface BridgeInput {
  riskOverride?: number;
  forceFlags?: string[];
  entitlementOverride?: boolean;
  killSwitch?: boolean;
}

export interface BridgeResult {
  riskOverride?: number;
  forceFlags?: string[];
  entitlementOverride?: boolean;
  killSwitch: boolean;
}

/** Phase 17: Batch of offline session data for server reconciliation. */
export interface ReconciliationBatch {
  offlineSignals: { rule: string; additive: number; timestamp: number }[];
  shadowFlags: Record<string, boolean | number>;
  offlineDurationMs: number;
  riskScore: number;
  deviceContext: {
    memoryClass: string;
    networkReliability: number;
    sessionCount: number;
    offlineSessionRatio: number;
  };
  createdAt: number;
}

/** Phase 17: Server response to reconciliation batch. */
export interface ReconciliationDirective {
  riskAdjustment?: number;
  clearFlags?: string[];
  forceFlags?: string[];
  deviceTrusted?: boolean;
}

/** Phase 18: Client → server verification request. */
export interface BridgeVerificationRequest {
  /** Current session metrics snapshot */
  sessionMetrics: SessionMetrics;
  /** Current shadow flags state */
  shadowFlags: Record<string, boolean | number>;
  /** Signal summary for server cross-referencing */
  signalSnapshot: {
    aiRequestCount: number;
    aiResponseCount: number;
    premiumAccessCount: number;
    entitlementMismatchCount: number;
    telemetryGapCount: number;
    hasActiveEntitlement: boolean;
  };
  /** Pending reconciliation batches */
  reconciliationBatches: ReconciliationBatch[];
  /** Request creation timestamp */
  timestamp: number;
}

/** Phase 18: Server → client verification response.
 *  Server is ADVISORY — can only strengthen confidence, never weaken it.
 */
export interface BridgeVerificationResponse {
  /** Whether server successfully verified the request */
  verified: boolean;
  /** Contradiction rules server confirmed as true positives */
  contradictionsConfirmed: string[];
  /** Server-verified entitlement ground truth (RevenueCat server-side check) */
  entitlementTruth?: boolean;
  /** Confidence level server recommends (only applied if >= current) */
  confidenceBoost?: VerificationConfidence;
  /** Reconciliation directive for offline activity correction */
  reconciliationDirective?: ReconciliationDirective;
  /** Absolute risk score adjustment from server (clamped by client) */
  riskAdjustment?: number;
  /** Shadow flag overrides — server can confirm or clear flags */
  shadowFlagOverrides?: {
    /** Flags server confirmed as true positives — set these */
    set?: string[];
    /** Flags server identified as false positives — clear these */
    clear?: string[];
  };
  /** Server timestamp for drift detection */
  serverTimestamp: number;
}

/** Phase 18: Bridge verification metrics for monitoring. */
export interface BridgeMetrics {
  verificationAttempts: number;
  successes: number;
  failures: number;
  lastSuccessTimestamp: number;
  offlineToOnlineCorrections: number;
  contradictionConfirmations: number;
  avgResponseTimeMs: number;
  /** Rolling response time samples (last 10) for average calculation */
  responseTimeSamples: number[];
}

// ── Constants ──

/** Minimum interval between verification dispatches (2 minutes) */
const BRIDGE_VERIFICATION_THROTTLE_MS = 2 * 60 * 1000;
/** Server request timeout (5 seconds — generous for mobile) */
const BRIDGE_TIMEOUT_MS = 5_000;
/** Server considered unreachable if no contact within this window */
const BRIDGE_AVAILABILITY_WINDOW_MS = 10 * 60 * 1000;
/** Maximum response time samples retained for average calculation */
const MAX_RESPONSE_TIME_SAMPLES = 10;

// ── State ──

const BRIDGE_KEY = '__sb_state';

interface BridgeState {
  lastServerContact: number;
  serverRiskOverride?: number;
  serverFlags?: string[];
  serverEntitlementOverride?: boolean;
  killSwitch: boolean;
  /** Phase 17: Queued reconciliation batches awaiting server connection */
  pendingReconciliationBatches: ReconciliationBatch[];
  /** Phase 17: Last reconciliation directive from server */
  lastReconciliationDirective?: ReconciliationDirective;
  /** Phase 18: Last verification response from server */
  lastVerificationResponse?: BridgeVerificationResponse;
  /** Phase 18: Last verification dispatch timestamp (throttle tracking) */
  lastVerificationAttempt: number;
  /** Phase 18: Verification metrics */
  metrics: BridgeMetrics;
  /** Phase 18: In-flight verification guard (prevent duplicate dispatches) */
  verificationInFlight: boolean;
}

function createFreshMetrics(): BridgeMetrics {
  return {
    verificationAttempts: 0,
    successes: 0,
    failures: 0,
    lastSuccessTimestamp: 0,
    offlineToOnlineCorrections: 0,
    contradictionConfirmations: 0,
    avgResponseTimeMs: 0,
    responseTimeSamples: [],
  };
}

function getBridgeState(): BridgeState {
  const g = globalThis as Record<string, unknown>;
  if (!g[BRIDGE_KEY]) {
    g[BRIDGE_KEY] = {
      lastServerContact: 0,
      killSwitch: false,
      pendingReconciliationBatches: [],
      lastVerificationAttempt: 0,
      metrics: createFreshMetrics(),
      verificationInFlight: false,
    } satisfies BridgeState;
  }
  // Phase 18: backfill metrics/fields for upgraded state
  const s = g[BRIDGE_KEY] as BridgeState;
  if (!s.metrics) s.metrics = createFreshMetrics();
  if (s.lastVerificationAttempt === undefined) s.lastVerificationAttempt = 0;
  if (s.verificationInFlight === undefined) s.verificationInFlight = false;
  return s;
}

// ── Bridge API ──

/**
 * Query the security bridge for server-issued overrides.
 * Returns cached directives from last server contact, or no-op if offline.
 */
export function querySecurityBridge(): BridgeResult {
  const state = getBridgeState();

  if (state.lastServerContact > 0) {
    return {
      riskOverride: state.serverRiskOverride,
      forceFlags: state.serverFlags,
      entitlementOverride: state.serverEntitlementOverride,
      killSwitch: state.killSwitch,
    };
  }

  return { killSwitch: false };
}

/**
 * Receive server-issued security directives.
 * The ONLY entry point for server authority into the client security system.
 */
export function receiveBridgeDirective(input: BridgeInput): void {
  const state = getBridgeState();
  state.lastServerContact = Date.now();

  if (input.riskOverride !== undefined) {
    state.serverRiskOverride = Math.min(100, Math.max(0, input.riskOverride));
  }
  if (input.forceFlags) {
    state.serverFlags = input.forceFlags;
  }
  if (input.entitlementOverride !== undefined) {
    state.serverEntitlementOverride = input.entitlementOverride;
  }
  if (input.killSwitch !== undefined) {
    state.killSwitch = input.killSwitch;
  }
}

/**
 * Check if the server has issued a kill switch (revoke all access).
 */
export function isBridgeKillSwitchActive(): boolean {
  return getBridgeState().killSwitch;
}

// ── Phase 17: Reconciliation API ──

/**
 * Queue a reconciliation batch for server processing.
 * Max 5 pending batches (oldest dropped if exceeded).
 */
export function queueReconciliationBatch(batch: ReconciliationBatch): void {
  const state = getBridgeState();
  state.pendingReconciliationBatches.push(batch);
  if (state.pendingReconciliationBatches.length > 5) {
    state.pendingReconciliationBatches.shift();
  }
}

/**
 * Get pending reconciliation batches for dispatch to server.
 */
export function getPendingReconciliationBatches(): ReconciliationBatch[] {
  return [...getBridgeState().pendingReconciliationBatches];
}

/**
 * Clear pending reconciliation batches after successful dispatch.
 */
export function clearPendingReconciliationBatches(): void {
  getBridgeState().pendingReconciliationBatches = [];
}

/**
 * Receive a reconciliation directive from the server.
 */
export function receiveBridgeReconciliation(directive: ReconciliationDirective): ReconciliationDirective {
  const state = getBridgeState();
  state.lastServerContact = Date.now();
  state.lastReconciliationDirective = directive;
  return directive;
}

/**
 * Get the last reconciliation directive (if any).
 */
export function getLastReconciliationDirective(): ReconciliationDirective | undefined {
  return getBridgeState().lastReconciliationDirective;
}

// ── Phase 18: Backend-Assisted Verification API ──

/**
 * Check if a verification dispatch is allowed (throttle + guard).
 * Returns false if:
 *   - Another verification is in-flight
 *   - Less than BRIDGE_VERIFICATION_THROTTLE_MS since last attempt
 */
export function shouldAttemptVerification(): boolean {
  const state = getBridgeState();
  if (state.verificationInFlight) return false;
  return Date.now() - state.lastVerificationAttempt >= BRIDGE_VERIFICATION_THROTTLE_MS;
}

/**
 * Check if the server has been reachable recently.
 * Returns true if last server contact was within the availability window.
 */
export function isBridgeAvailable(): boolean {
  const state = getBridgeState();
  return state.lastServerContact > 0 && Date.now() - state.lastServerContact < BRIDGE_AVAILABILITY_WINDOW_MS;
}

/**
 * Dispatch a verification request to the server.
 * Returns the server response, or null on failure/timeout/offline.
 *
 * Guarantees:
 *   - Throttled (max once per 2 minutes)
 *   - Guarded (no duplicate in-flight requests)
 *   - Timeout-protected (5s hard limit)
 *   - Null on ANY failure (offline-safe: caller treats null as no-op)
 *
 * STUB: Currently always returns null (no server endpoint).
 * When backend is deployed, replace the fetch stub below.
 */
export async function dispatchBridgeVerification(
  request: BridgeVerificationRequest,
): Promise<BridgeVerificationResponse | null> {
  const state = getBridgeState();

  // Throttle enforcement
  if (!shouldAttemptVerification()) return null;

  state.verificationInFlight = true;
  state.lastVerificationAttempt = Date.now();
  state.metrics.verificationAttempts += 1;

  const startTime = Date.now();

  try {
    // ──────────────────────────────────────────────────
    // Phase 19: Live backend verification via Render authority server
    // ──────────────────────────────────────────────────
    let baseUrl: string | null = null;
    try {
      baseUrl = getApiBaseUrl();
    } catch {
      // No backend configured → offline autonomy preserved
    }

    if (!baseUrl) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS); // abort-timeout
    try {
      const res = await fetch(`${baseUrl}/verify/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'user_local_001',
          bridge_verification: true,
          session_metrics: request.sessionMetrics,
          shadow_flags: request.shadowFlags,
          signal_snapshot: request.signalSnapshot,
          timestamp: request.timestamp,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`Bridge HTTP ${res.status}`);

      const json = (await res.json()) as { success: boolean; data: Record<string, unknown> | null };

      // Server responded — record contact even if data doesn't map to full verification response
      state.lastServerContact = Date.now();

      // Map server subscription response to bridge verification response
      if (json.success && json.data) {
        const sub = json.data;
        const response: BridgeVerificationResponse = {
          verified: true,
          contradictionsConfirmed: [],
          entitlementTruth:
            sub.status === 'active' || sub.status === 'trialing'
              ? true
              : sub.status === 'inactive' || sub.status === 'expired'
                ? false
                : undefined,
          confidenceBoost: 'high',
          serverTimestamp: Date.now(),
        };
        return response;
      }

      return null;
    } finally {
      clearTimeout(timeout);
    }
    // ──────────────────────────────────────────────────
  } catch {
    // Network failure, timeout, parse error → silent no-op
    state.metrics.failures += 1;
    return null;
  } finally {
    state.verificationInFlight = false;

    // Track response time (even for stubs, establishes baseline)
    const elapsed = Date.now() - startTime;
    const samples = state.metrics.responseTimeSamples;
    samples.push(elapsed);
    if (samples.length > MAX_RESPONSE_TIME_SAMPLES) samples.shift();
    state.metrics.avgResponseTimeMs =
      samples.length > 0 ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : 0;
  }
}

/**
 * Record a successful verification completion.
 * Called by tamperEngine after processing a non-null verification response.
 */
export function recordVerificationSuccess(response: BridgeVerificationResponse): void {
  const state = getBridgeState();
  state.metrics.successes += 1;
  state.metrics.lastSuccessTimestamp = Date.now();
  state.lastServerContact = Date.now();
  state.lastVerificationResponse = response;

  // Count specific outcomes
  if (response.contradictionsConfirmed.length > 0) {
    state.metrics.contradictionConfirmations += response.contradictionsConfirmed.length;
  }
  if (response.reconciliationDirective) {
    state.metrics.offlineToOnlineCorrections += 1;
  }

  // Apply server-issued reconciliation directive if present
  if (response.reconciliationDirective) {
    receiveBridgeReconciliation(response.reconciliationDirective);
  }

  // Clear dispatched reconciliation batches (server processed them)
  clearPendingReconciliationBatches();
}

/**
 * Get the last verification response from the server.
 */
export function getLastVerificationResponse(): BridgeVerificationResponse | undefined {
  return getBridgeState().lastVerificationResponse;
}

/**
 * Get bridge verification metrics for monitoring/debugging.
 */
export function getBridgeMetrics(): BridgeMetrics {
  const m = getBridgeState().metrics;
  return { ...m, responseTimeSamples: [...m.responseTimeSamples] };
}
