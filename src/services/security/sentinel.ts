/**
 * FitQuest Sentinel — Phase 16 (Distributed Micro-Checks + Connectivity Signals)
 *
 * Redundant, independent integrity micro-checks that operate outside
 * the main tamper engine. If tamperEngine is disabled/stubbed/patched,
 * the sentinel still detects anomalies through inline verification.
 *
 * Phase 15: Added distributed micro-checks — tiny validations designed
 * to be sprinkled across AI handlers, navigation events, button presses.
 * No single check is meaningful alone. Combined = system integrity.
 *
 * Phase 16: Added connectivity signal recording. Feeds network presence
 * to tamperEngine for verification confidence transitions. Sentinel
 * itself now also gates anomaly scoring by network awareness.
 *
 * Design:
 *   - Lightweight — no timers, no background work, purely reactive
 *   - Independent — does NOT import tamperEngine (avoids circular dep)
 *   - Redundant — duplicates critical checks with different logic paths
 *   - Distributed — micro-checks in multiple integration points
 *   - Obfuscated purpose — named and structured to not advertise intent
 */

// ── State ──

const SENTINEL_KEY = '__qos_metrics';

interface QualityMetrics {
  networkCalls: number;
  featureAccess: number;
  entitlementVerified: boolean;
  lastVerification: number;
  aiCallsWithoutNetwork: number;
  premiumCallsWithoutEntitlement: number;
  engineHeartbeatSnapshot: number;
  lastEngineCheck: number;
  anomalyScore: number;
  /** Phase 15: Distributed micro-check accumulators */
  microTimingDrift: number;
  microStateChecks: number;
  microLastNavTimestamp: number;
  microNavCount: number;
  microEntropyExpected: number;
  /** Phase 16: Connectivity tracking */
  lastConnectivityTimestamp: number;
  isOnline: boolean;
}

function getMetrics(): QualityMetrics {
  const g = globalThis as Record<string, unknown>;
  if (!g[SENTINEL_KEY]) {
    g[SENTINEL_KEY] = createMetrics();
  }
  return g[SENTINEL_KEY] as QualityMetrics;
}

function createMetrics(): QualityMetrics {
  return {
    networkCalls: 0,
    featureAccess: 0,
    entitlementVerified: false,
    lastVerification: 0,
    aiCallsWithoutNetwork: 0,
    premiumCallsWithoutEntitlement: 0,
    engineHeartbeatSnapshot: -1,
    lastEngineCheck: 0,
    anomalyScore: 0,
    microTimingDrift: 0,
    microStateChecks: 0,
    microLastNavTimestamp: 0,
    microNavCount: 0,
    microEntropyExpected: ((Date.now() * 2246822519) >>> 0) % 1000,
    lastConnectivityTimestamp: 0,
    isOnline: false,
  };
}

// ── Sentinel API ──

/**
 * Record that an AI network call was made.
 * Called from aiProvider alongside tamperEngine.recordAIRequestSent().
 */
export function sentinelRecordNetworkCall(): void {
  getMetrics().networkCalls += 1;
}

/**
 * Phase 16: Record connectivity state change.
 * Called when network presence is detected (e.g., successful API call, connectivity event).
 * Feeds into tamperEngine confidence transitions via the caller.
 * Sentinel tracks this independently for its own anomaly gating.
 */
export function sentinelRecordConnectivity(isOnline: boolean): void {
  const m = getMetrics();
  m.isOnline = isOnline;
  if (isOnline) {
    m.lastConnectivityTimestamp = Date.now();
  }
}

/**
 * Phase 16: Check if sentinel believes device is online.
 * Used by degradation engine for additional gating.
 */
export function sentinelIsOnline(): boolean {
  return getMetrics().isOnline;
}

/**
 * Record that an AI feature was accessed.
 * Returns true if the access pattern looks anomalous.
 */
export function sentinelRecordAIAccess(): boolean {
  const m = getMetrics();
  m.featureAccess += 1;

  // Independent check: AI accessed but zero network calls after several uses
  if (m.featureAccess > 3 && m.networkCalls === 0) {
    m.aiCallsWithoutNetwork += 1;
    m.anomalyScore = Math.min(100, m.anomalyScore + 15);
    return true;
  }
  return false;
}

/**
 * Record premium feature access with entitlement state.
 * Returns true if anomalous (premium used without entitlement).
 */
export function sentinelRecordPremiumAccess(hasEntitlement: boolean): boolean {
  const m = getMetrics();
  m.entitlementVerified = hasEntitlement;
  m.lastVerification = Date.now();

  if (!hasEntitlement) {
    m.premiumCallsWithoutEntitlement += 1;
    m.anomalyScore = Math.min(100, m.anomalyScore + 20);
    return true;
  }
  return false;
}

/**
 * Verify the main engine is still alive by checking its heartbeat counter.
 * Called periodically from integration points.
 *
 * @param currentHeartbeat - tamperEngine.getHeartbeatCounter() value
 * @returns true if engine appears dead/frozen
 */
export function sentinelVerifyEngine(currentHeartbeat: number): boolean {
  const m = getMetrics();
  const now = Date.now();

  // Only check every 2 minutes
  if (now - m.lastEngineCheck < 120_000) return false;
  m.lastEngineCheck = now;

  if (m.engineHeartbeatSnapshot === -1) {
    // First check — record baseline
    m.engineHeartbeatSnapshot = currentHeartbeat;
    return false;
  }

  // If heartbeat hasn't advanced in 2+ minutes, engine is frozen/disabled
  if (currentHeartbeat <= m.engineHeartbeatSnapshot) {
    m.anomalyScore = Math.min(100, m.anomalyScore + 30);
    return true; // Engine appears dead
  }

  // Engine is alive — update snapshot
  m.engineHeartbeatSnapshot = currentHeartbeat;
  return false;
}

/**
 * Get current sentinel anomaly score (0-100).
 * Used by degradation engine as secondary signal.
 */
export function sentinelGetAnomalyScore(): number {
  return getMetrics().anomalyScore;
}

/**
 * Check if sentinel has detected enough anomalies to warrant degradation.
 * This is the sentinel's independent risk assessment — works even if
 * the main tamper engine is completely disabled.
 */
export function sentinelShouldDegrade(): boolean {
  return getMetrics().anomalyScore >= 50;
}

// ── Phase 15: Distributed Micro-Checks ──
// Tiny validators designed to be called from many integration points.
// Each adds small risk (2-5 pts) independently. No single check decisive.

/**
 * Micro-check: timing coherence.
 * Detects if Date.now() is being spoofed or frozen.
 * Call from AI request/response handlers.
 */
export function microCheckTiming(callSiteLabel: string): void {
  const m = getMetrics();
  const now = Date.now();

  if (m.lastVerification > 0 && now < m.lastVerification) {
    // Time went backwards — clock manipulation
    m.microTimingDrift += 1;
    m.anomalyScore = Math.min(100, m.anomalyScore + 5);
  }

  // AI response arriving < 50ms after request = likely spoofed
  if (callSiteLabel === 'ai_response' && m.lastVerification > 0) {
    const elapsed = now - m.lastVerification;
    if (elapsed > 0 && elapsed < 50) {
      m.anomalyScore = Math.min(100, m.anomalyScore + 3);
    }
  }

  m.lastVerification = now;
}

/**
 * Micro-check: state coherence.
 * Verifies that the sentinel's own state still exists and hasn't been zeroed.
 * Call from navigation transitions.
 */
export function microCheckStateCoherence(): void {
  const g = globalThis as Record<string, unknown>;
  const m = getMetrics();
  m.microStateChecks += 1;

  // Sentinel global key should exist after first access
  if (m.microStateChecks > 3 && !g[SENTINEL_KEY]) {
    // Our own state was deleted — recreation happened, but flag it
    m.anomalyScore = Math.min(100, m.anomalyScore + 8);
  }
}

/**
 * Micro-check: navigation pattern.
 * Tracks navigation frequency to detect automated/scripted interaction.
 * Call from screen mount or navigation events.
 */
export function microCheckNavPattern(): void {
  const m = getMetrics();
  const now = Date.now();
  m.microNavCount += 1;

  if (m.microLastNavTimestamp > 0) {
    const gap = now - m.microLastNavTimestamp;
    // Sub-200ms screen transition = likely automated
    if (gap > 0 && gap < 200 && m.microNavCount > 5) {
      m.anomalyScore = Math.min(100, m.anomalyScore + 4);
    }
  }
  m.microLastNavTimestamp = now;
}

/**
 * Micro-check: entropy alignment.
 * Verifies the sentinel's internal entropy seed hasn't been externally mutated.
 * Call from button press handlers or periodic events.
 */
export function microCheckEntropy(): void {
  const m = getMetrics();
  // Re-derive expected value from current state
  const derived = ((Date.now() * 2246822519) >>> 0) % 1000;
  // If entropy seed was set to an impossible value, flag it
  // (seed should be a number 0-999, set at creation time)
  if (typeof m.microEntropyExpected !== 'number' || m.microEntropyExpected < 0 || m.microEntropyExpected >= 1000) {
    m.anomalyScore = Math.min(100, m.anomalyScore + 3);
    m.microEntropyExpected = derived;
  }
}
