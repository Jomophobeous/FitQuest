/**
 * FitQuest Tamper Detection Engine — Phase 18 (Backend-Assisted Verification)
 *
 * Layered, self-verifying, redundant integrity enforcement.
 *
 * Phase 13: Cross-validation, multiplicative scoring, persistence, shadow flags,
 *   behavioral fingerprinting, controlled entropy.
 * Phase 14: Self-integrity checks, delayed triggers, tripwires, grace calibration.
 * Phase 15: Dynamic integrity (moving target), state fragmentation, false recovery,
 *   backend hook readiness.
 * Phase 16: Verification-driven adaptive defense. Offline = uncertainty, NOT suspicion.
 *   Detection gates behind verificationConfidence. Contradiction-based enforcement.
 * Phase 17: Adaptive signal optimization. Dynamic rule weighting based on device/session
 *   context. Confidence-modulated shadow amplification. Telemetry reconciliation on
 *   online transition. Shadow flag false-positive fix. Session metrics collection.
 * Phase 18: Backend-assisted verification. Optional server-side validation that
 *   strengthens offline-first security without affecting UX. Bridge verification
 *   dispatched opportunistically on AI success / entitlement checks. Server confirms
 *   contradictions, verifies entitlement truth, adjusts confidence, clears false-positive
 *   flags. System remains fully functional offline — backend is advisory only.
 *
 * Design:
 *   - Silent — NO alerts, NO blocking, NO UI disruption
 *   - Moving target — integrity tokens evolve each cycle, no fixed signature
 *   - Fragmented state — persisted across multiple storage keys
 *   - False recovery loops — temporary apparent relief then re-escalation
 *   - Backend-assisted — bridge verification confirms/corrects client decisions
 *   - Verification-gated — telemetry rules suppressed when offline (confidence=low)
 *   - Contradiction-first — only penalize mismatch, never penalize uncertainty
 *   - Context-aware — rules adjust weights per device class, network reliability, session pattern
 *   - Reconciliation — offline signals validated on online transition, risk corrected retroactively
 *   - Offline-safe — null bridge response = no-op, system continues unchanged
 */

import { getSessionErrorCount } from '../crashReporting';
import { isPostHogConfigured } from '../posthogService';
import { getAppState, setAppState } from '../../database/service';
import * as SecureStore from 'expo-secure-store';
import {
  querySecurityBridge,
  shouldAttemptVerification,
  dispatchBridgeVerification,
  recordVerificationSuccess,
  getPendingReconciliationBatches,
  type BridgeVerificationRequest,
  type BridgeVerificationResponse,
} from './securityBridge';

// ============================================
// TYPES
// ============================================

export type RiskLevel = 'low' | 'medium' | 'high';

/** Phase 16: Verification confidence — gates rule activation and risk caps.
 * LOW:    offline / no recent verification → telemetry rules disabled, risk capped < HIGH
 * MEDIUM: network detected or entitlement checked → behavioral rules weakened
 * HIGH:   successful AI round-trip or telemetry burst → full rule evaluation enabled
 */
export type VerificationConfidence = 'low' | 'medium' | 'high';

/** Phase 17: Device context for dynamic rule weighting. */
export interface DeviceContext {
  /** Device memory class — affects tolerance for slow telemetry */
  memoryClass: 'low' | 'standard' | 'high';
  /** Network reliability score 0-1 (rolling average of recent connectivity) */
  networkReliability: number;
  /** Average session duration in ms (rolling across recent sessions) */
  avgSessionDuration: number;
  /** Total session count this install */
  sessionCount: number;
  /** Ratio of offline sessions to total sessions (0-1) */
  offlineSessionRatio: number;
}

/** Phase 17: Collected session metrics for backend reconciliation. */
export interface SessionMetrics {
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: VerificationConfidence;
  shadowFlagCount: number;
  rulesTriggered: string[];
  deviceContext: DeviceContext;
  offlineDurationMs: number;
  reconciliationPending: boolean;
}

export interface TamperSignals {
  // AI signals
  ai_feature_used: boolean;
  ai_request_sent: boolean;
  ai_response_received: boolean;
  ai_request_count: number;
  ai_response_count: number;
  ai_feature_timestamps: number[];

  // RevenueCat / subscription signals
  premium_feature_used: boolean;
  premium_access_count: number;
  hasActiveEntitlement: boolean;
  lastEntitlementCheck: number;
  entitlementMismatchCount: number;

  // Telemetry signals (PostHog)
  lastEventTimestamp: number;
  eventsPerSession: number;
  posthogConfigured: boolean;
  telemetryGapCount: number;

  // Error signals (Sentry)
  errorCount: number;
  lastErrorTimestamp: number;

  // Session signals
  sessionStartTimestamp: number;
  lastActivityTimestamp: number;
  heavyUsageDetected: boolean;

  // Behavioral fingerprint signals
  featureAccessSequence: string[];
  interActionDelays: number[];
  lastFeatureTimestamp: number;
}

/** Shadow flags — sticky, never fully reset, amplify future penalties. */
interface ShadowFlags {
  suspectedSpoofing: boolean;
  telemetryIntegrityBroken: boolean;
  entitlementMismatchHistory: number;
  premiumBypassEverDetected: boolean;
  aiSpoofEverDetected: boolean;
  consecutiveHighSessions: number;
  firstViolationTimestamp: number;
  // Phase 14 additions
  integrityViolationDetected: boolean;
  tripwireTriggered: boolean;
  engineDisableDetected: boolean;
}

/** Persisted state — survives app restart via SQLite app_state. */
interface PersistedState {
  riskScore: number;
  shadowFlags: ShadowFlags;
  degradationDay: number;
  lastSessionTimestamp: number;
  /** Phase 14: persisted pending penalties from delayed triggers */
  pendingPenalties: number;
  /** Phase 15: false recovery state */
  recoveryPhase: 'none' | 'cooling' | 'reapply';
  recoveryStartedAt: number;
  /** Phase 16: verification confidence persisted across sessions */
  verificationConfidence?: VerificationConfidence;
  lastVerificationTimestamp?: number;
  /** Phase 17: persisted session context for cross-session learning */
  offlineSessionCount?: number;
  totalSessionCount?: number;
  networkReliabilitySamples?: boolean[];
  deviceMemoryClass?: 'low' | 'standard' | 'high';
}

interface RuleResult {
  rule: string;
  triggered: boolean;
  factor: number;
  additive: number;
  reason: string;
}

/** Phase 14: Delayed trigger — penalty applied after random delay */
interface DelayedPenalty {
  points: number;
  multiplier: number;
  shadowFlag?: keyof ShadowFlags;
  applyAfter: number; // timestamp
}

interface TamperStateGlobal {
  signals: TamperSignals;
  riskScore: number;
  shadowFlags: ShadowFlags;
  degradationDay: number;
  lastDecayTimestamp: number;
  lastEvaluationTimestamp: number;
  lastPersistTimestamp: number;
  lastIntegrityCheckTimestamp: number;
  initialized: boolean;
  persistenceLoaded: boolean;
  ruleResults: RuleResult[];
  entropyCounter: number;
  /** Phase 14: deferred penalty queue */
  delayedPenalties: DelayedPenalty[];
  /** Phase 14: heartbeat alive counter — incremented each heartbeat */
  heartbeatCounter: number;
  /** Phase 14: integrity token — set on init, verified periodically */
  integrityToken: number;
  /** Phase 14: tripwire canary values */
  canary_premium_internal: boolean;
  canary_telemetry_override: boolean;
  /** Phase 15: dynamic integrity seed — evolves each heartbeat */
  integritySeed: number;
  integrityEpoch: number;
  /** Phase 15: false recovery loop state */
  recoveryPhase: 'none' | 'cooling' | 'reapply';
  recoveryStartedAt: number;
  preRecoveryScore: number;
  /** Phase 15: session entropy anchor — derived at launch, never stored */
  sessionAnchor: number;
  /** Phase 16: verification confidence — gates rule activation + risk caps */
  verificationConfidence: VerificationConfidence;
  lastVerificationTimestamp: number;
  /** Phase 16: stability window — score must stay at threshold for this duration before degradation applies */
  stabilityWindowStart: number;
  /** Phase 16: last detected network connectivity signal timestamp */
  lastConnectivityTimestamp: number;
  /** Phase 17: device context for dynamic rule weighting */
  deviceContext: DeviceContext;
  /** Phase 17: offline signal buffer for reconciliation on online transition */
  offlineSignalBuffer: { rule: string; additive: number; timestamp: number }[];
  /** Phase 17: timestamp when device last went offline (confidence dropped to LOW) */
  offlineStartTimestamp: number;
  /** Phase 17: count of sessions with no network contact */
  offlineSessionCount: number;
  /** Phase 17: total session count (persisted for ratio calculation) */
  totalSessionCount: number;
  /** Phase 17: rolling network reliability samples (last 10 connectivity results) */
  networkReliabilitySamples: boolean[];
}

// ============================================
// CONSTANTS
// ============================================

const DECAY_INTERVAL_MS = 5 * 60 * 1000;
const DECAY_AMOUNT = 5;
const EVALUATION_THROTTLE_MS = 30_000;
const SESSION_ACTIVE_THRESHOLD_MS = 2 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60_000;
const PERSIST_INTERVAL_MS = 3 * 60 * 1000;
const PERSIST_KEY = '__tds_v3';
const BEHAVIORAL_WINDOW = 10;

// Risk thresholds
const MEDIUM_THRESHOLD = 30;
const HIGH_THRESHOLD = 60;
const MAX_SCORE = 100;

// Cross-validation correlation windows
const CORRELATION_WINDOW_MS = 10_000;

// Behavioral fingerprint thresholds
const INSTANT_FEATURE_MS = 500;
const IMPOSSIBLE_SPEED_MS = 100;

// Phase 14: Grace period — new sessions immune to behavioral rules
const GRACE_PERIOD_MS = 90_000; // 90 seconds

// Phase 14: Integrity check interval
const INTEGRITY_CHECK_INTERVAL_MS = 2 * 60 * 1000; // Every 2 minutes

// Phase 14: Delayed trigger range
const DELAYED_TRIGGER_MIN_MS = 30_000; // 30s
const DELAYED_TRIGGER_MAX_MS = 180_000; // 3 minutes

// Phase 15: Dynamic integrity — no static magic value. Seed derived at runtime.
// Token = (seed × heartbeat × epoch) XOR-mixed, recomputed each check.
// Attacker must reverse the specific seed + counter combination to predict.

// Phase 14: Max score for first 5 minutes (grace ceiling)
const GRACE_MAX_SCORE = 45; // Cannot exceed MEDIUM+ during grace window

// Phase 15: State fragmentation — secondary persistence key in SecureStore
const SHARD_KEY_SECONDARY = '__qm_shard';

// Phase 15: False recovery loop timing
const RECOVERY_COOLING_MS = 3 * 60 * 1000; // 3 minutes of apparent relief
const RECOVERY_REAPPLY_BOOST = 15; // Extra penalty on reapplication

// Phase 16: Verification-driven adaptive defense constants
const CONFIDENCE_DECAY_MS = 24 * 60 * 60 * 1000; // 24h offline → confidence degrades to 'low'
const STABILITY_WINDOW_MS = 2 * 60 * 1000; // Score must remain at threshold 2 min before degradation
const ACCELERATED_DECAY_MULTIPLIER = 2; // ×2 decay when signals normalize + confidence='low'
const LOW_CONFIDENCE_WEIGHT = 0.3; // Behavioral rules weakened to 30% when confidence='low'

// Phase 17: Adaptive signal optimization constants
/** Shadow amplification dampening at LOW confidence — non-contradiction flags reduced to this fraction */
const LOW_CONFIDENCE_SHADOW_DAMPENING = 0.4;
/** Shadow amplification dampening at MEDIUM confidence */
const MEDIUM_CONFIDENCE_SHADOW_DAMPENING = 0.7;
/** Dynamic weight: low-memory devices get more tolerance on telemetry timing */
const LOW_DEVICE_WEIGHT_FACTOR = 0.6;
/** Dynamic weight: high offline ratio → more tolerance */
const HIGH_OFFLINE_RATIO_THRESHOLD = 0.5;
const HIGH_OFFLINE_RATIO_WEIGHT = 0.5;
/** Max offline signals retained for reconciliation */
const MAX_OFFLINE_SIGNAL_BUFFER = 50;
/** Reconciliation retroactive correction cap (max risk points removed) */
const RECONCILIATION_MAX_CORRECTION = 25;
/** Network reliability sample window */
const NETWORK_RELIABILITY_SAMPLES = 10;

// ============================================
// GLOBAL STATE (HMR-safe)
// ============================================

const GLOBAL_KEY = '__tamperState_v3';

function getGlobalState(): TamperStateGlobal {
  const g = globalThis as Record<string, unknown>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createFreshState();
  }
  return g[GLOBAL_KEY] as TamperStateGlobal;
}

function createFreshShadowFlags(): ShadowFlags {
  return {
    suspectedSpoofing: false,
    telemetryIntegrityBroken: false,
    entitlementMismatchHistory: 0,
    premiumBypassEverDetected: false,
    aiSpoofEverDetected: false,
    consecutiveHighSessions: 0,
    firstViolationTimestamp: 0,
    integrityViolationDetected: false,
    tripwireTriggered: false,
    engineDisableDetected: false,
  };
}

function createFreshState(): TamperStateGlobal {
  const now = Date.now();
  return {
    signals: {
      ai_feature_used: false,
      ai_request_sent: false,
      ai_response_received: false,
      ai_request_count: 0,
      ai_response_count: 0,
      ai_feature_timestamps: [],
      premium_feature_used: false,
      premium_access_count: 0,
      hasActiveEntitlement: false,
      lastEntitlementCheck: 0,
      entitlementMismatchCount: 0,
      lastEventTimestamp: 0,
      eventsPerSession: 0,
      posthogConfigured: false,
      telemetryGapCount: 0,
      errorCount: 0,
      lastErrorTimestamp: 0,
      sessionStartTimestamp: now,
      lastActivityTimestamp: now,
      heavyUsageDetected: false,
      featureAccessSequence: [],
      interActionDelays: [],
      lastFeatureTimestamp: 0,
    },
    riskScore: 0,
    shadowFlags: createFreshShadowFlags(),
    degradationDay: 0,
    lastDecayTimestamp: now,
    lastEvaluationTimestamp: 0,
    lastPersistTimestamp: 0,
    lastIntegrityCheckTimestamp: now,
    initialized: false,
    persistenceLoaded: false,
    ruleResults: [],
    entropyCounter: 0,
    delayedPenalties: [],
    heartbeatCounter: 0,
    integrityToken: 0, // Phase 15: set dynamically in initialize()
    canary_premium_internal: false,
    canary_telemetry_override: false,
    integritySeed: 0,
    integrityEpoch: 0,
    recoveryPhase: 'none',
    recoveryStartedAt: 0,
    preRecoveryScore: 0,
    sessionAnchor: ((now * 2654435761) ^ (now >>> 7)) >>> 0,
    // Phase 16: verification-driven defaults — start offline (low confidence)
    verificationConfidence: 'low',
    lastVerificationTimestamp: 0,
    stabilityWindowStart: 0,
    lastConnectivityTimestamp: 0,
    // Phase 17: adaptive signal optimization defaults
    deviceContext: {
      memoryClass: 'standard',
      networkReliability: 0,
      avgSessionDuration: 0,
      sessionCount: 0,
      offlineSessionRatio: 0,
    },
    offlineSignalBuffer: [],
    offlineStartTimestamp: now,
    offlineSessionCount: 0,
    totalSessionCount: 0,
    networkReliabilitySamples: [],
  };
}

// ============================================
// ENTROPY — controlled randomization
// ============================================

function entropy(state: TamperStateGlobal): number {
  state.entropyCounter += 1;
  const seed = (state.entropyCounter * 6364136223846793005 + Date.now()) >>> 0;
  return (((seed ^ (seed >>> 16)) * 2654435769) >>> 0) / 4294967296;
}

function entropyRange(state: TamperStateGlobal, min: number, max: number): number {
  return Math.floor(min + entropy(state) * (max - min));
}

// ============================================
// TAMPER ENGINE
// ============================================

class TamperEngine {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize. Safe to call multiple times (idempotent).
   * Restores persisted risk state from SQLite on first call.
   */
  initialize(): void {
    const state = getGlobalState();
    if (state.initialized) return;

    state.initialized = true;
    state.signals.sessionStartTimestamp = Date.now();
    state.signals.lastActivityTimestamp = Date.now();
    state.signals.posthogConfigured = isPostHogConfigured();
    state.lastIntegrityCheckTimestamp = Date.now();

    // Phase 15: Dynamic integrity — derive session-unique seed
    const launchMs = Date.now();
    state.sessionAnchor = ((launchMs * 2654435761) ^ (launchMs >>> 7)) >>> 0;
    state.integritySeed = ((state.sessionAnchor * 1103515245 + 12345) ^ (launchMs >>> 3)) >>> 0;
    state.integrityEpoch = 0;
    state.integrityToken = this.computeDynamicToken(state);

    // Restore persisted state (fire-and-forget, non-blocking)
    this.restorePersistedState().catch(() => {});

    // Phase 15: Restore secondary shard from SecureStore
    this.restoreSecondaryShard(state).catch(() => {});

    this.startHeartbeat();

    if (__DEV__) {
      console.warn('[TamperEngine] v3 initialized');
    }
  }

  destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    const state = getGlobalState();
    this.persistState().catch(() => {});
    this.persistSecondaryShard(state).catch(() => {});
    const g = globalThis as Record<string, unknown>;
    delete g[GLOBAL_KEY];
  }

  // ── Signal Recorders ──

  recordAIFeatureUsed(): void {
    const state = getGlobalState();
    const s = state.signals;
    const now = Date.now();
    s.ai_feature_used = true;
    s.ai_feature_timestamps.push(now);
    if (s.ai_feature_timestamps.length > 20) s.ai_feature_timestamps.shift();
    s.lastActivityTimestamp = now;
    this.recordFeatureAccess('ai', now);
  }

  recordAIRequestSent(): void {
    const s = getGlobalState().signals;
    s.ai_request_sent = true;
    s.ai_request_count += 1;
    s.lastActivityTimestamp = Date.now();
  }

  recordAIResponseReceived(): void {
    const s = getGlobalState().signals;
    s.ai_response_received = true;
    s.ai_response_count += 1;
    s.lastActivityTimestamp = Date.now();
  }

  recordPremiumFeatureUsed(): void {
    const state = getGlobalState();
    const s = state.signals;
    const now = Date.now();
    s.premium_feature_used = true;
    s.premium_access_count += 1;
    s.lastActivityTimestamp = now;

    if (!s.hasActiveEntitlement && s.lastEntitlementCheck > 0) {
      s.entitlementMismatchCount += 1;
      state.shadowFlags.entitlementMismatchHistory += 1;
      if (!state.shadowFlags.premiumBypassEverDetected) {
        state.shadowFlags.premiumBypassEverDetected = true;
        state.shadowFlags.firstViolationTimestamp = state.shadowFlags.firstViolationTimestamp || now;
      }
    }
    this.recordFeatureAccess('premium', now);
  }

  updateEntitlementState(hasAccess: boolean): void {
    const s = getGlobalState().signals;
    s.hasActiveEntitlement = hasAccess;
    s.lastEntitlementCheck = Date.now();
  }

  recordTelemetryEvent(): void {
    const state = getGlobalState();
    const s = state.signals;
    const now = Date.now();

    if (s.lastEventTimestamp > 0) {
      const gap = now - s.lastEventTimestamp;
      if (gap > 5 * 60 * 1000 && now - s.sessionStartTimestamp > 5 * 60 * 1000) {
        s.telemetryGapCount += 1;
      }
    }

    s.eventsPerSession += 1;
    s.lastEventTimestamp = now;
  }

  recordHeavyUsage(): void {
    getGlobalState().signals.heavyUsageDetected = true;
  }

  // ── Phase 14: Tripwire Canaries ──
  // These methods represent bait paths. Under normal execution they are
  // NEVER called. If an attacker patches premium/telemetry to always-true,
  // these canaries fire and prove tampering definitively.

  /** TRIPWIRE: Should never be called. Proves premium gate was bypassed at code level. */
  tripwirePremiumInternal(): void {
    const state = getGlobalState();
    state.canary_premium_internal = true;
    state.shadowFlags.tripwireTriggered = true;
    // Delayed reaction — don't immediately jump to HIGH
    this.queueDelayedPenalty(35, 1.8, 'tripwireTriggered');
  }

  /** TRIPWIRE: Should never be called. Proves telemetry override was injected. */
  tripwireTelemetryOverride(): void {
    const state = getGlobalState();
    state.canary_telemetry_override = true;
    state.shadowFlags.tripwireTriggered = true;
    this.queueDelayedPenalty(30, 1.5, 'tripwireTriggered');
  }

  // ── Behavioral Fingerprinting ──

  private recordFeatureAccess(feature: string, now: number): void {
    const s = getGlobalState().signals;
    s.featureAccessSequence.push(feature);
    if (s.featureAccessSequence.length > BEHAVIORAL_WINDOW) {
      s.featureAccessSequence.shift();
    }
    if (s.lastFeatureTimestamp > 0) {
      const delay = now - s.lastFeatureTimestamp;
      s.interActionDelays.push(delay);
      if (s.interActionDelays.length > BEHAVIORAL_WINDOW) {
        s.interActionDelays.shift();
      }
    }
    s.lastFeatureTimestamp = now;
  }

  // ── Phase 15: Dynamic Integrity Token ──
  // Token evolves each heartbeat. No fixed signature to patch.

  private computeDynamicToken(state: TamperStateGlobal): number {
    const base = state.integritySeed ^ (state.integrityEpoch * 2246822519);
    const mixed = ((base ^ state.sessionAnchor) * 3266489917) >>> 0;
    return ((mixed ^ (mixed >>> 13)) * 668265263) >>> 0;
  }

  private advanceIntegrityEpoch(state: TamperStateGlobal): void {
    state.integrityEpoch += 1;
    state.integrityToken = this.computeDynamicToken(state);
  }

  // ── Phase 15: State Fragmentation — Secondary Shard ──
  // Critical shadow flags stored separately in SecureStore.
  // Missing shard on restore = implicit suspicion.

  private async restoreSecondaryShard(state: TamperStateGlobal): Promise<void> {
    try {
      const raw = await SecureStore.getItemAsync(SHARD_KEY_SECONDARY);
      if (!raw) {
        // Missing shard after first session = suspicion
        if (state.persistenceLoaded && state.degradationDay > 0) {
          state.riskScore = Math.min(MAX_SCORE, state.riskScore + 8);
        }
        return;
      }
      const shard = JSON.parse(raw) as {
        pbd?: boolean;
        asd?: boolean;
        tib?: boolean;
        ivd?: boolean;
        tt?: boolean;
        edd?: boolean;
        rp?: 'none' | 'cooling' | 'reapply';
        rs?: number;
        prs?: number;
      };
      // Merge shard into live state — sticky flags use OR (never downgrade)
      if (shard.pbd) state.shadowFlags.premiumBypassEverDetected = true;
      if (shard.asd) state.shadowFlags.aiSpoofEverDetected = true;
      if (shard.tib) state.shadowFlags.telemetryIntegrityBroken = true;
      if (shard.ivd) state.shadowFlags.integrityViolationDetected = true;
      if (shard.tt) state.shadowFlags.tripwireTriggered = true;
      if (shard.edd) state.shadowFlags.engineDisableDetected = true;
      // Phase 15: Restore false recovery state from shard
      if (shard.rp && shard.rp !== 'none') {
        state.recoveryPhase = shard.rp;
        state.recoveryStartedAt = shard.rs || 0;
        state.preRecoveryScore = shard.prs || 0;
      }
    } catch {
      // Corrupted shard — add minor suspicion
      state.riskScore = Math.min(MAX_SCORE, state.riskScore + 5);
    }
  }

  private async persistSecondaryShard(state: TamperStateGlobal): Promise<void> {
    try {
      const sf = state.shadowFlags;
      const shard = {
        pbd: sf.premiumBypassEverDetected || undefined,
        asd: sf.aiSpoofEverDetected || undefined,
        tib: sf.telemetryIntegrityBroken || undefined,
        ivd: sf.integrityViolationDetected || undefined,
        tt: sf.tripwireTriggered || undefined,
        edd: sf.engineDisableDetected || undefined,
        rp: state.recoveryPhase !== 'none' ? state.recoveryPhase : undefined,
        rs: state.recoveryStartedAt || undefined,
        prs: state.preRecoveryScore || undefined,
      };
      await SecureStore.setItemAsync(SHARD_KEY_SECONDARY, JSON.stringify(shard));
    } catch {
      // Best effort
    }
  }

  // ── Phase 15: False Recovery Loop ──
  // After hitting HIGH, temporarily reduce apparent risk (cooling phase).
  // Attacker thinks fix worked. After cooling window → snap back harder.

  private processFalseRecovery(state: TamperStateGlobal, now: number): void {
    const riskLevel =
      state.riskScore >= HIGH_THRESHOLD ? 'high' : state.riskScore >= MEDIUM_THRESHOLD ? 'medium' : 'low';

    if (state.recoveryPhase === 'none' && riskLevel === 'high') {
      // Enter cooling phase with entropy-based probability (not every time)
      if (entropy(state) < 0.35) {
        state.recoveryPhase = 'cooling';
        state.recoveryStartedAt = now;
        state.preRecoveryScore = state.riskScore;
        // Temporarily knock score down to medium range
        state.riskScore = MEDIUM_THRESHOLD + Math.round(entropy(state) * 10);
      }
    } else if (state.recoveryPhase === 'cooling') {
      if (now - state.recoveryStartedAt > RECOVERY_COOLING_MS) {
        // Cooling expired → snap back harder
        state.recoveryPhase = 'reapply';
        state.riskScore = Math.min(MAX_SCORE, state.preRecoveryScore + RECOVERY_REAPPLY_BOOST);
        state.preRecoveryScore = 0;
      }
    } else if (state.recoveryPhase === 'reapply') {
      // Reapply is sticky for remainder of session
      // Reset to 'none' only on fresh session (in restorePersistedState)
      state.recoveryPhase = 'none';
    }
  }

  // ── Phase 14: Delayed Trigger Queue ──

  private queueDelayedPenalty(points: number, multiplier: number, shadowFlag?: keyof ShadowFlags): void {
    const state = getGlobalState();
    const delay = entropyRange(state, DELAYED_TRIGGER_MIN_MS, DELAYED_TRIGGER_MAX_MS);
    state.delayedPenalties.push({
      points,
      multiplier,
      shadowFlag,
      applyAfter: Date.now() + delay,
    });
  }

  private drainDelayedPenalties(state: TamperStateGlobal): void {
    const now = Date.now();
    const ready = state.delayedPenalties.filter((p) => now >= p.applyAfter);
    const remaining = state.delayedPenalties.filter((p) => now < p.applyAfter);
    state.delayedPenalties = remaining;

    for (const penalty of ready) {
      if (penalty.multiplier > 1.0) {
        state.riskScore = Math.max(state.riskScore, MEDIUM_THRESHOLD);
        state.riskScore = Math.round(state.riskScore * penalty.multiplier);
      }
      state.riskScore += penalty.points;
      if (penalty.shadowFlag && penalty.shadowFlag in state.shadowFlags) {
        (state.shadowFlags as unknown as Record<string, unknown>)[penalty.shadowFlag] = true;
      }
    }
    state.riskScore = Math.min(MAX_SCORE, state.riskScore);
  }

  // ── Phase 14: Self-Integrity Checks ──

  private checkSelfIntegrity(state: TamperStateGlobal, now: number): void {
    if (now - state.lastIntegrityCheckTimestamp < INTEGRITY_CHECK_INTERVAL_MS) return;
    state.lastIntegrityCheckTimestamp = now;

    let violated = false;

    // Check 1: Dynamic integrity token must match recomputed value (Phase 15)
    const expectedToken = this.computeDynamicToken(state);
    if (state.integrityToken !== expectedToken) {
      violated = true;
    }

    // Check 2: Heartbeat must be advancing (engine not frozen/stubbed)
    // After 3+ minutes, heartbeat counter should have incremented
    const sessionAge = now - state.signals.sessionStartTimestamp;
    if (sessionAge > 3 * 60 * 1000 && state.heartbeatCounter < 2) {
      violated = true;
    }

    // Check 3: Global state key must still exist and match
    const g = globalThis as Record<string, unknown>;
    if (!g[GLOBAL_KEY] || g[GLOBAL_KEY] !== state) {
      violated = true;
    }

    // Check 4: Canary values must not have been flipped externally
    // (canaries should only be true if tripwire methods were called)
    if (state.canary_premium_internal && !state.shadowFlags.tripwireTriggered) {
      violated = true; // Canary was set but shadow flag wasn't → external mutation
    }

    if (violated) {
      state.shadowFlags.integrityViolationDetected = true;
      state.shadowFlags.engineDisableDetected = true;
      // Queue delayed penalty — don't react instantly
      this.queueDelayedPenalty(40, 2.0, 'integrityViolationDetected');

      if (__DEV__) {
        console.warn('[TamperEngine] Integrity violation detected');
      }
    }
  }

  // ── Phase 16: Verification Confidence ──
  // Confidence transitions: LOW → MEDIUM (network detected, entitlement checked)
  //                         MEDIUM → HIGH (successful AI cycle, telemetry burst ≥3)
  //                         HIGH → LOW (>24h offline, restart without network)
  // Only upgrades — never downgrades within same trigger event.
  // Degradation to LOW happens passively during evaluation via time-based check.

  /**
   * Update verification confidence level.
   * Only accepts upgrades — calling with 'medium' when already 'high' is a no-op.
   * Phase 17: Triggers reconciliation when transitioning to HIGH.
   */
  updateVerificationConfidence(level: VerificationConfidence): void {
    const state = getGlobalState();
    const now = Date.now();
    const rank = { low: 0, medium: 1, high: 2 } as const;

    if (rank[level] > rank[state.verificationConfidence]) {
      const previousConfidence = state.verificationConfidence;
      state.verificationConfidence = level;
      state.lastVerificationTimestamp = now;

      // Phase 17: Record network reliability sample on confidence upgrade
      state.networkReliabilitySamples.push(true);
      if (state.networkReliabilitySamples.length > NETWORK_RELIABILITY_SAMPLES) {
        state.networkReliabilitySamples.shift();
      }
      // Update device context network reliability
      const onlineCount = state.networkReliabilitySamples.filter(Boolean).length;
      state.deviceContext.networkReliability = onlineCount / state.networkReliabilitySamples.length;

      // Phase 17: Trigger offline reconciliation when going from LOW → HIGH
      if (previousConfidence === 'low' && level === 'high') {
        this.reconcileOfflineSignals();
      }

      if (__DEV__) {
        console.warn('[TamperEngine] Confidence →', level);
      }
    }
  }

  /**
   * Record that network connectivity was detected.
   * Transitions LOW → MEDIUM if currently low.
   * Phase 17: Also records connectivity sample for network reliability tracking.
   */
  recordConnectivitySignal(): void {
    const state = getGlobalState();
    state.lastConnectivityTimestamp = Date.now();
    if (state.verificationConfidence === 'low') {
      this.updateVerificationConfidence('medium');
    }
  }

  /**
   * Phase 17: Record a failed connectivity attempt.
   * Tracks network reliability without changing confidence.
   */
  recordConnectivityFailure(): void {
    const state = getGlobalState();
    state.networkReliabilitySamples.push(false);
    if (state.networkReliabilitySamples.length > NETWORK_RELIABILITY_SAMPLES) {
      state.networkReliabilitySamples.shift();
    }
    const onlineCount = state.networkReliabilitySamples.filter(Boolean).length;
    state.deviceContext.networkReliability =
      state.networkReliabilitySamples.length > 0 ? onlineCount / state.networkReliabilitySamples.length : 0;
  }

  /**
   * Get current verification confidence level.
   * Used by degradation engine to gate enforcement.
   */
  getVerificationConfidence(): VerificationConfidence {
    return getGlobalState().verificationConfidence;
  }

  /**
   * Phase 16: Check if stability window is satisfied.
   * Score must have been at/above threshold for STABILITY_WINDOW_MS
   * before degradation should apply.
   */
  isStabilityWindowSatisfied(): boolean {
    const state = getGlobalState();
    if (state.stabilityWindowStart === 0) return false;
    return Date.now() - state.stabilityWindowStart >= STABILITY_WINDOW_MS;
  }

  /**
   * Phase 16: Apply time-based confidence decay.
   * If no verification event in 24h, degrade to LOW.
   */
  private applyConfidenceDecay(state: TamperStateGlobal, now: number): void {
    if (state.verificationConfidence === 'low') return;
    if (state.lastVerificationTimestamp > 0 && now - state.lastVerificationTimestamp > CONFIDENCE_DECAY_MS) {
      state.verificationConfidence = 'low';
      state.offlineStartTimestamp = now;
      if (__DEV__) {
        console.warn('[TamperEngine] Confidence decayed → low (24h timeout)');
      }
    }
  }

  // ── Phase 17: Device Context & Dynamic Weighting ──

  /**
   * Update device context for dynamic rule weighting.
   * Called from integration points that can determine device capabilities.
   */
  updateDeviceContext(partial: Partial<DeviceContext>): void {
    const state = getGlobalState();
    Object.assign(state.deviceContext, partial);
  }

  /**
   * Phase 17: Compute dynamic weight multiplier for rule additives.
   * Reduces false positives for low-end devices, unreliable networks,
   * and users with high offline session ratios.
   *
   * Returns a multiplier 0.3 - 1.0 applied to non-contradiction rule additives.
   */
  private computeDynamicWeight(state: TamperStateGlobal): number {
    const ctx = state.deviceContext;
    let weight = 1.0;

    // Low-memory devices: telemetry SDK may not initialize quickly
    if (ctx.memoryClass === 'low') {
      weight *= LOW_DEVICE_WEIGHT_FACTOR;
    }

    // Unreliable network: telemetry gaps expected
    if (ctx.networkReliability < 0.5 && ctx.networkReliability > 0) {
      weight *= 0.6 + ctx.networkReliability * 0.8; // 0.6 at 0 reliability → 1.0 at 0.5
    }

    // High offline ratio: user frequently offline, telemetry absence is normal
    if (ctx.offlineSessionRatio > HIGH_OFFLINE_RATIO_THRESHOLD) {
      weight *= HIGH_OFFLINE_RATIO_WEIGHT;
    }

    return Math.max(0.3, Math.min(1.0, weight));
  }

  /**
   * Phase 17: Buffer an offline signal for later reconciliation.
   * When device comes online, buffered signals are reviewed and
   * false-positive contributions are retroactively corrected.
   */
  private bufferOfflineSignal(state: TamperStateGlobal, rule: string, additive: number): void {
    if (state.verificationConfidence !== 'low') return;
    if (state.offlineSignalBuffer.length >= MAX_OFFLINE_SIGNAL_BUFFER) {
      state.offlineSignalBuffer.shift(); // Drop oldest
    }
    state.offlineSignalBuffer.push({ rule, additive, timestamp: Date.now() });
  }

  /**
   * Phase 17: Reconcile offline signals on online transition.
   * Reviews buffered offline signals, identifies false positives
   * (rules that fire due to offline conditions), and retroactively
   * reduces riskScore.
   *
   * Called when confidence transitions to HIGH (successful AI round-trip).
   */
  reconcileOfflineSignals(): void {
    const state = getGlobalState();
    if (state.offlineSignalBuffer.length === 0) return;

    // Only reconcile if we're now confidently online
    if (state.verificationConfidence !== 'high') return;

    // Rules that are expected to fire offline (telemetry absence is normal offline)
    const offlineExpectedRules = new Set(['IMPOSSIBLE_CLEAN', 'BEHAVIORAL_ANOMALY']);

    let correction = 0;
    for (const signal of state.offlineSignalBuffer) {
      if (offlineExpectedRules.has(signal.rule)) {
        correction += signal.additive;
      }
    }

    // Apply retroactive correction (capped)
    correction = Math.min(correction, RECONCILIATION_MAX_CORRECTION);
    if (correction > 0) {
      state.riskScore = Math.max(0, state.riskScore - correction);
      if (__DEV__) {
        console.warn(
          '[TamperEngine] Reconciliation: -' + correction + ' pts from',
          state.offlineSignalBuffer.length,
          'offline signals',
        );
      }
    }

    // Clear buffer after reconciliation
    state.offlineSignalBuffer = [];
    state.offlineStartTimestamp = 0;
  }

  /**
   * Phase 17: Get collected session metrics for backend reporting.
   * Used by securityBridge for future server-side verification.
   */
  getSessionMetrics(): SessionMetrics {
    const state = getGlobalState();
    const sf = state.shadowFlags;
    const flagCount = [
      sf.suspectedSpoofing,
      sf.telemetryIntegrityBroken,
      sf.premiumBypassEverDetected,
      sf.aiSpoofEverDetected,
      sf.integrityViolationDetected,
      sf.tripwireTriggered,
      sf.engineDisableDetected,
    ].filter(Boolean).length;

    return {
      riskScore: state.riskScore,
      riskLevel: this.getRiskLevel(),
      confidence: state.verificationConfidence,
      shadowFlagCount: flagCount,
      rulesTriggered: state.ruleResults.filter((r) => r.triggered).map((r) => r.rule),
      deviceContext: { ...state.deviceContext },
      offlineDurationMs: state.offlineStartTimestamp > 0 ? Date.now() - state.offlineStartTimestamp : 0,
      reconciliationPending: state.offlineSignalBuffer.length > 0,
    };
  }

  // ── Phase 18: Backend-Assisted Verification ──

  /**
   * Package current engine state for bridge verification request.
   * Returns a snapshot the server can use to cross-reference signals,
   * verify entitlements, and confirm contradictions.
   */
  getStateSnapshot(): BridgeVerificationRequest {
    const state = getGlobalState();
    const sf = state.shadowFlags;

    return {
      sessionMetrics: this.getSessionMetrics(),
      shadowFlags: {
        suspectedSpoofing: sf.suspectedSpoofing,
        telemetryIntegrityBroken: sf.telemetryIntegrityBroken,
        entitlementMismatchHistory: sf.entitlementMismatchHistory,
        premiumBypassEverDetected: sf.premiumBypassEverDetected,
        aiSpoofEverDetected: sf.aiSpoofEverDetected,
        consecutiveHighSessions: sf.consecutiveHighSessions,
        integrityViolationDetected: sf.integrityViolationDetected,
        tripwireTriggered: sf.tripwireTriggered,
        engineDisableDetected: sf.engineDisableDetected,
      },
      signalSnapshot: {
        aiRequestCount: state.signals.ai_request_count,
        aiResponseCount: state.signals.ai_response_count,
        premiumAccessCount: state.signals.premium_access_count,
        entitlementMismatchCount: state.signals.entitlementMismatchCount,
        telemetryGapCount: state.signals.telemetryGapCount,
        hasActiveEntitlement: state.signals.hasActiveEntitlement,
      },
      reconciliationBatches: getPendingReconciliationBatches(),
      timestamp: Date.now(),
    };
  }

  /**
   * Apply a server verification response to engine state.
   *
   * ADVISORY ONLY — server can only:
   *   - Confirm contradictions (set shadow flags, increase risk)
   *   - Clear false-positive flags (reduce risk)
   *   - Provide entitlement ground truth
   *   - Boost confidence (never lower it)
   *   - Apply reconciliation directives
   *
   * Server CANNOT:
   *   - Block users
   *   - Force MEDIUM/HIGH degradation without client-side evidence
   *   - Lower confidence below current level
   */
  applyBridgeVerification(response: BridgeVerificationResponse): void {
    if (!response.verified) return;

    const state = getGlobalState();

    // 1. Apply server-confirmed contradictions to shadow flags
    if (response.contradictionsConfirmed.length > 0) {
      for (const rule of response.contradictionsConfirmed) {
        switch (rule) {
          case 'PREMIUM_BYPASS':
            state.shadowFlags.premiumBypassEverDetected = true;
            break;
          case 'AI_WITHOUT_NETWORK':
            state.shadowFlags.aiSpoofEverDetected = true;
            break;
          case 'INTEGRITY_VIOLATION':
            state.shadowFlags.integrityViolationDetected = true;
            break;
          // No default: only known contradiction rules accepted
        }
      }
    }

    // 2. Apply shadow flag overrides (server-verified false positives)
    if (response.shadowFlagOverrides) {
      const sf = state.shadowFlags as unknown as Record<string, unknown>;
      if (response.shadowFlagOverrides.clear) {
        for (const flag of response.shadowFlagOverrides.clear) {
          if (flag in state.shadowFlags) {
            // Only clear boolean flags — numeric counters are not cleared by server
            if (typeof sf[flag] === 'boolean') {
              sf[flag] = false;
            }
          }
        }
      }
      if (response.shadowFlagOverrides.set) {
        for (const flag of response.shadowFlagOverrides.set) {
          if (flag in state.shadowFlags) {
            if (typeof sf[flag] === 'boolean') {
              sf[flag] = true;
            }
          }
        }
      }
    }

    // 3. Apply risk adjustment (capped, cannot push below 0 or above MAX)
    if (response.riskAdjustment !== undefined) {
      // Server risk adjustment is additive, capped at ±RECONCILIATION_MAX_CORRECTION
      const clamped = Math.max(
        -RECONCILIATION_MAX_CORRECTION,
        Math.min(RECONCILIATION_MAX_CORRECTION, response.riskAdjustment),
      );
      state.riskScore = Math.max(0, Math.min(MAX_SCORE, state.riskScore + clamped));
    }

    // 4. Apply confidence boost (ONLY if >= current — server cannot lower confidence)
    if (response.confidenceBoost) {
      const order: VerificationConfidence[] = ['low', 'medium', 'high'];
      const currentIdx = order.indexOf(state.verificationConfidence);
      const boostIdx = order.indexOf(response.confidenceBoost);
      if (boostIdx > currentIdx) {
        state.verificationConfidence = response.confidenceBoost;
        state.lastVerificationTimestamp = Date.now();
      }
    }

    // 5. Apply entitlement ground truth (server-side RevenueCat verification)
    if (response.entitlementTruth !== undefined) {
      this.updateEntitlementState(response.entitlementTruth);
    }

    // 6. Apply reconciliation directive
    if (response.reconciliationDirective) {
      const dir = response.reconciliationDirective;
      if (dir.riskAdjustment !== undefined) {
        const adj = Math.max(
          -RECONCILIATION_MAX_CORRECTION,
          Math.min(RECONCILIATION_MAX_CORRECTION, dir.riskAdjustment),
        );
        state.riskScore = Math.max(0, Math.min(MAX_SCORE, state.riskScore + adj));
      }
      if (dir.clearFlags) {
        const sf = state.shadowFlags as unknown as Record<string, unknown>;
        for (const flag of dir.clearFlags) {
          if (flag in state.shadowFlags && typeof sf[flag] === 'boolean') {
            sf[flag] = false;
          }
        }
      }
      if (dir.forceFlags) {
        const sf = state.shadowFlags as unknown as Record<string, unknown>;
        for (const flag of dir.forceFlags) {
          if (flag in state.shadowFlags && typeof sf[flag] === 'boolean') {
            sf[flag] = true;
          }
        }
      }
    }

    // 7. Record success in bridge metrics
    recordVerificationSuccess(response);

    if (__DEV__) {
      console.warn(
        '[TamperEngine] Bridge verification applied:',
        'contradictions:',
        response.contradictionsConfirmed,
        'riskAdj:',
        response.riskAdjustment,
        'confidenceBoost:',
        response.confidenceBoost,
        'flagOverrides:',
        response.shadowFlagOverrides,
        '→ score:',
        state.riskScore,
        '| confidence:',
        state.verificationConfidence,
      );
    }
  }

  /**
   * Opportunistically request bridge verification.
   *
   * Non-blocking, fire-and-forget. Called from AI success path and
   * entitlement checks. Throttled to max once per 2 minutes.
   * On failure/timeout: silent no-op (offline autonomy preserved).
   *
   * Guards:
   *   - Throttle (2 min minimum interval)
   *   - Confidence gate (must be >= 'medium' to justify network cost)
   *   - In-flight dedup (only one request at a time)
   */
  requestBridgeVerification(): void {
    const state = getGlobalState();

    // Gate: only dispatch when we have some confidence (avoids wasting
    // network round-trips when device is freshly offline)
    if (state.verificationConfidence === 'low') return;

    // Throttle + in-flight guard checked by bridge
    if (!shouldAttemptVerification()) return;

    const request = this.getStateSnapshot();

    // Fire-and-forget — response applied asynchronously
    dispatchBridgeVerification(request)
      .then((response) => {
        if (response) {
          this.applyBridgeVerification(response);
        }
      })
      .catch(() => {
        // Silent failure — offline autonomy preserved
      });
  }

  // ── Risk Evaluation ──

  evaluate(): void {
    const state = getGlobalState();
    const now = Date.now();

    if (now - state.lastEvaluationTimestamp < EVALUATION_THROTTLE_MS) return;
    state.lastEvaluationTimestamp = now;

    // Phase 14: Increment heartbeat counter (proves engine is alive)
    state.heartbeatCounter += 1;

    // Phase 15: Advance dynamic integrity token (moving target)
    this.advanceIntegrityEpoch(state);

    // Phase 14: Drain delayed penalties first
    this.drainDelayedPenalties(state);

    // Phase 14: Self-integrity check
    this.checkSelfIntegrity(state, now);

    // Phase 16: Apply confidence decay (24h timeout → LOW)
    this.applyConfidenceDecay(state, now);

    // Apply decay
    this.applyDecay(state, now);

    // Sync external signals
    state.signals.errorCount = getSessionErrorCount();

    const results: RuleResult[] = [];
    let additive = 0;
    let multiplier = 1.0;

    // Phase 14: Grace check — is session still in grace period?
    const inGracePeriod = now - state.signals.sessionStartTimestamp < GRACE_PERIOD_MS;

    // Phase 16: Capture verification confidence for rule gating
    const confidence = state.verificationConfidence;

    // === CRITICAL RULES (multiplicative) — always active, even in grace ===
    // These detect CONTRADICTIONS (premium used without entitlement, AI used without network)
    // Contradiction rules fire regardless of confidence — they prove tampering definitively.

    const r1 = this.rulePremiumBypass(state);
    results.push(r1);
    if (r1.triggered) {
      multiplier *= r1.factor;
      additive += r1.additive;
    }

    const r2 = this.ruleAIWithoutNetwork(state);
    results.push(r2);
    if (r2.triggered) {
      multiplier *= r2.factor;
      additive += r2.additive;
    }

    // === SIGNAL CORRELATION RULES — gated by grace + Phase 16 confidence ===
    if (!inGracePeriod) {
      // Phase 17: Compute dynamic weight based on device/session context
      const dynamicWeight = this.computeDynamicWeight(state);

      // Phase 16: TELEMETRY RULES — DISABLED when confidence='low'
      // Offline = uncertainty, not suspicion. These rules rely on telemetry
      // being expected — which is only true when we've verified online state.
      if (confidence !== 'low') {
        const r3 = this.ruleAIResponseWithoutTelemetry(state, now);
        results.push(r3);
        if (r3.triggered) additive += Math.round(r3.additive * dynamicWeight);

        const r4 = this.ruleTelemetrySilence(state, now);
        results.push(r4);
        if (r4.triggered) additive += Math.round(r4.additive * dynamicWeight);

        const r5 = this.ruleDeadSignals(state, now);
        results.push(r5);
        if (r5.triggered) additive += Math.round(r5.additive * dynamicWeight);

        const r8 = this.ruleTelemetryGaps(state);
        results.push(r8);
        if (r8.triggered) additive += Math.round(r8.additive * dynamicWeight);
      }

      // Phase 16: BEHAVIORAL RULES — WEAKENED when confidence='low' (30% weight)
      // Phase 17: Additionally modulated by dynamic device/session weight.
      // These are partially location-independent but still produce false positives
      // during legitimate offline sessions (impossible_clean especially).
      const r6 = this.ruleImpossibleClean(state, now);
      results.push(r6);
      if (r6.triggered) {
        const effectiveAdditive =
          confidence === 'low'
            ? Math.round(r6.additive * LOW_CONFIDENCE_WEIGHT * dynamicWeight)
            : Math.round(r6.additive * dynamicWeight);
        additive += effectiveAdditive;
        // Phase 17: Buffer offline signal for reconciliation
        if (confidence === 'low') {
          this.bufferOfflineSignal(state, 'IMPOSSIBLE_CLEAN', effectiveAdditive);
        }
      }

      const r7 = this.ruleBehavioralAnomaly(state, now);
      results.push(r7);
      if (r7.triggered) {
        const effectiveAdditive =
          confidence === 'low'
            ? Math.round(r7.additive * LOW_CONFIDENCE_WEIGHT * dynamicWeight)
            : Math.round(r7.additive * dynamicWeight);
        additive += effectiveAdditive;
        // Phase 17: Buffer offline signal for reconciliation
        if (confidence === 'low') {
          this.bufferOfflineSignal(state, 'BEHAVIORAL_ANOMALY', effectiveAdditive);
        }
      }
    }

    // Phase 14: Rule 9 — Integrity/tripwire detection (always active)
    // This detects CODE TAMPERING (contradiction), not signal absence.
    const r9 = this.ruleIntegrityViolation(state);
    results.push(r9);
    if (r9.triggered) {
      multiplier *= r9.factor;
      additive += r9.additive;
    }

    // === SHADOW FLAG AMPLIFICATION ===
    // Phase 17: modulated by verification confidence
    const shadowMultiplier = this.getShadowAmplification(state.shadowFlags, confidence);

    // === APPLY SCORING ===
    let newScore = state.riskScore;
    if (multiplier > 1.0) {
      newScore = Math.max(newScore, MEDIUM_THRESHOLD);
      newScore = newScore * multiplier;
    }
    newScore += additive * shadowMultiplier;

    // Phase 14: Grace ceiling — cap score for first 90s (unless critical rule fires)
    if (inGracePeriod && multiplier <= 1.0) {
      newScore = Math.min(newScore, GRACE_MAX_SCORE);
    }

    // Phase 16: Risk cap based on verification confidence
    // LOW confidence → score CANNOT reach HIGH threshold (cap at 59)
    // Only contradiction rules (multiplier > 1.0) bypass this cap.
    if (confidence === 'low' && multiplier <= 1.0) {
      newScore = Math.min(newScore, HIGH_THRESHOLD - 1);
    }

    state.riskScore = Math.min(MAX_SCORE, Math.max(0, Math.round(newScore)));
    state.ruleResults = results;

    // Phase 16: Stability window tracking
    // Score must persist at threshold for STABILITY_WINDOW_MS before degradation applies
    if (state.riskScore >= MEDIUM_THRESHOLD) {
      if (state.stabilityWindowStart === 0) {
        state.stabilityWindowStart = now; // Start clock
      }
    } else {
      state.stabilityWindowStart = 0; // Reset — score dropped below threshold
    }

    // Phase 15: False recovery loop — temporary relief then re-escalation
    this.processFalseRecovery(state, now);

    // Phase 15: Consult backend bridge (no-op until server is connected)
    const bridgeResult = querySecurityBridge();
    if (bridgeResult.riskOverride !== undefined) {
      state.riskScore = Math.min(MAX_SCORE, Math.max(0, bridgeResult.riskOverride));
    }
    if (bridgeResult.forceFlags) {
      for (const flag of bridgeResult.forceFlags) {
        if (flag in state.shadowFlags) {
          (state.shadowFlags as unknown as Record<string, unknown>)[flag] = true;
        }
      }
    }

    // Phase 18: Opportunistic bridge verification dispatch
    // Fire-and-forget: asks server to confirm/deny client-detected contradictions.
    // Only dispatches when throttle allows and confidence >= 'medium'.
    // Response (if any) applied asynchronously via applyBridgeVerification().
    if (confidence !== 'low' && shouldAttemptVerification()) {
      this.requestBridgeVerification();
    }

    this.updateShadowFlags(state);

    // Periodic persistence (includes secondary shard)
    if (now - state.lastPersistTimestamp > PERSIST_INTERVAL_MS) {
      state.lastPersistTimestamp = now;
      this.persistState().catch(() => {});
      this.persistSecondaryShard(state).catch(() => {});
    }

    if (__DEV__) {
      const triggered = results.filter((r) => r.triggered);
      if (triggered.length > 0) {
        console.warn(
          '[TamperEngine] Rules:',
          triggered.map((r) => r.rule).join(', '),
          '| ×',
          multiplier.toFixed(2),
          '| shadow×',
          shadowMultiplier.toFixed(2),
          '| score:',
          state.riskScore,
          '→',
          this.getRiskLevel(),
          '| confidence:',
          confidence,
          inGracePeriod ? '(grace)' : '',
        );
      }
    }
  }

  // ── Accessors ──

  getRiskLevel(): RiskLevel {
    const score = getGlobalState().riskScore;
    if (score >= HIGH_THRESHOLD) return 'high';
    if (score >= MEDIUM_THRESHOLD) return 'medium';
    return 'low';
  }

  getRiskScore(): number {
    return getGlobalState().riskScore;
  }

  getDegradationDay(): number {
    return getGlobalState().degradationDay;
  }

  getSignals(): Readonly<TamperSignals> {
    return { ...getGlobalState().signals };
  }

  getRuleResults(): readonly RuleResult[] {
    return [...getGlobalState().ruleResults];
  }

  getEntropy(): number {
    return entropy(getGlobalState());
  }

  /** Phase 14: Check if engine is initialized and heartbeat is alive. Used by sentinel. */
  isAlive(): boolean {
    const state = getGlobalState();
    return state.initialized && state.heartbeatCounter > 0;
  }

  /** Phase 14: Get heartbeat counter for sentinel verification. */
  getHeartbeatCounter(): number {
    return getGlobalState().heartbeatCounter;
  }

  // ── Private: Rules ──

  private rulePremiumBypass(state: TamperStateGlobal): RuleResult {
    const s = state.signals;
    const sf = state.shadowFlags;
    const triggered = s.premium_feature_used && !s.hasActiveEntitlement && s.lastEntitlementCheck > 0;

    let factor = 1.0;
    let additive = 0;
    if (triggered) {
      factor = 1.8 + Math.min(sf.entitlementMismatchHistory * 0.1, 0.5);
      additive = 15;
      state.shadowFlags.premiumBypassEverDetected = true;
      state.shadowFlags.firstViolationTimestamp = sf.firstViolationTimestamp || Date.now();
    }
    return {
      rule: 'PREMIUM_BYPASS',
      triggered,
      factor,
      additive,
      reason: triggered ? `Premium without entitlement (mismatches: ${s.entitlementMismatchCount})` : '',
    };
  }

  private ruleAIWithoutNetwork(state: TamperStateGlobal): RuleResult {
    const s = state.signals;
    const aiUsed = s.ai_feature_used && s.ai_feature_timestamps.length > 0;
    const noNetwork = s.ai_request_count === 0 && s.ai_response_count === 0;
    const triggered = aiUsed && noNetwork;

    let factor = 1.0;
    let additive = 0;
    if (triggered) {
      factor = 1.5;
      additive = 20;
      state.shadowFlags.aiSpoofEverDetected = true;
    }
    return {
      rule: 'AI_WITHOUT_NETWORK',
      triggered,
      factor,
      additive,
      reason: triggered ? `AI invoked ${s.ai_feature_timestamps.length}× with 0 network calls` : '',
    };
  }

  private ruleAIResponseWithoutTelemetry(state: TamperStateGlobal, now: number): RuleResult {
    const s = state.signals;
    const hasResponses = s.ai_response_count > 2;
    const telemetryStale = s.lastEventTimestamp > 0 && now - s.lastEventTimestamp > CORRELATION_WINDOW_MS * 3;
    const sessionMature = now - s.sessionStartTimestamp > SESSION_ACTIVE_THRESHOLD_MS;
    const triggered = hasResponses && telemetryStale && sessionMature && s.posthogConfigured;
    return {
      rule: 'AI_RESPONSE_NO_TELEMETRY',
      triggered,
      factor: 1.0,
      additive: triggered ? 15 : 0,
      reason: triggered ? 'AI responses received but telemetry pipeline silent' : '',
    };
  }

  private ruleTelemetrySilence(state: TamperStateGlobal, now: number): RuleResult {
    const s = state.signals;
    const sessionDuration = now - s.sessionStartTimestamp;
    const sessionActive = sessionDuration > SESSION_ACTIVE_THRESHOLD_MS;
    const hasActivity = s.ai_feature_used || s.premium_feature_used || s.heavyUsageDetected;
    const triggered = sessionActive && s.eventsPerSession === 0 && s.posthogConfigured && hasActivity;
    let additive = 0;
    if (triggered) {
      additive = 25;
      state.shadowFlags.telemetryIntegrityBroken = true;
    }
    return {
      rule: 'TELEMETRY_SILENCE',
      triggered,
      factor: 1.0,
      additive,
      reason: triggered ? `Active session (${Math.round(sessionDuration / 60000)}min) with zero telemetry` : '',
    };
  }

  private ruleDeadSignals(state: TamperStateGlobal, now: number): RuleResult {
    const s = state.signals;
    const sessionDuration = now - s.sessionStartTimestamp;
    const longSession = sessionDuration > 5 * 60 * 1000;
    const noPostHog = s.eventsPerSession === 0;
    const noSentry = s.errorCount === 0 && s.lastErrorTimestamp === 0;
    const triggered = longSession && noPostHog && noSentry && s.posthogConfigured;
    return {
      rule: 'DEAD_SIGNALS',
      triggered,
      factor: 1.0,
      additive: triggered ? 20 : 0,
      reason: triggered ? 'Both PostHog and Sentry completely silent' : '',
    };
  }

  private ruleImpossibleClean(state: TamperStateGlobal, now: number): RuleResult {
    const s = state.signals;
    const sessionDuration = now - s.sessionStartTimestamp;
    const longSession = sessionDuration > 10 * 60 * 1000;
    const triggered =
      longSession && s.heavyUsageDetected && s.errorCount === 0 && s.eventsPerSession === 0 && s.posthogConfigured;
    let additive = 0;
    if (triggered) {
      additive = 15;
      // Phase 17 FIX: Only set suspectedSpoofing when we've verified the user IS online.
      // At LOW confidence (offline), telemetry silence is expected — NOT evidence of spoofing.
      if (state.verificationConfidence !== 'low') {
        state.shadowFlags.suspectedSpoofing = true;
      }
    }
    return {
      rule: 'IMPOSSIBLE_CLEAN',
      triggered,
      factor: 1.0,
      additive,
      reason: triggered ? 'Heavy usage, zero errors, zero telemetry' : '',
    };
  }

  private ruleBehavioralAnomaly(state: TamperStateGlobal, now: number): RuleResult {
    const s = state.signals;
    let additive = 0;
    const reasons: string[] = [];

    if (s.ai_feature_timestamps.length > 0) {
      const firstAI = s.ai_feature_timestamps[0]!;
      const timeSinceLaunch = firstAI - s.sessionStartTimestamp;
      if (timeSinceLaunch < INSTANT_FEATURE_MS && timeSinceLaunch >= 0) {
        additive += 8;
        reasons.push(`AI used ${timeSinceLaunch}ms after launch`);
      }
    }

    const impossibleSpeeds = s.interActionDelays.filter((d) => d > 0 && d < IMPOSSIBLE_SPEED_MS).length;
    if (impossibleSpeeds >= 3) {
      additive += 10;
      reasons.push(`${impossibleSpeeds} sub-100ms feature transitions`);
    }

    if (s.premium_access_count > 0 && s.eventsPerSession === 0 && s.ai_request_count === 0) {
      const timeSinceLaunch = now - s.sessionStartTimestamp;
      if (timeSinceLaunch < 3000) {
        additive += 12;
        reasons.push('Premium accessed immediately with no session activity');
      }
    }

    const triggered = additive > 0;
    return {
      rule: 'BEHAVIORAL_ANOMALY',
      triggered,
      factor: 1.0,
      additive,
      reason: triggered ? reasons.join('; ') : '',
    };
  }

  private ruleTelemetryGaps(state: TamperStateGlobal): RuleResult {
    const s = state.signals;
    const triggered = s.telemetryGapCount >= 3 && s.posthogConfigured;
    let additive = 0;
    if (triggered) {
      additive = 15 + Math.min(s.telemetryGapCount * 3, 15);
      state.shadowFlags.telemetryIntegrityBroken = true;
    }
    return {
      rule: 'TELEMETRY_GAPS',
      triggered,
      factor: 1.0,
      additive,
      reason: triggered ? `${s.telemetryGapCount} telemetry gaps detected` : '',
    };
  }

  /** Phase 14: Integrity violation — engine tampering or tripwire hit. */
  private ruleIntegrityViolation(state: TamperStateGlobal): RuleResult {
    const sf = state.shadowFlags;
    const triggered = sf.integrityViolationDetected || sf.tripwireTriggered || sf.engineDisableDetected;
    let factor = 1.0;
    let additive = 0;
    if (triggered) {
      factor = 2.0; // Extreme multiplier
      additive = 30;
    }
    return {
      rule: 'INTEGRITY_VIOLATION',
      triggered,
      factor,
      additive,
      reason: triggered
        ? `Integrity: ${sf.tripwireTriggered ? 'tripwire' : ''}${sf.integrityViolationDetected ? ' integrity' : ''}${sf.engineDisableDetected ? ' engine-disable' : ''}`
        : '',
    };
  }

  // ── Shadow Flag Amplification ──

  /**
   * Phase 17: Confidence-modulated shadow amplification.
   *
   * Contradiction-derived flags (premiumBypass, aiSpoof, integrity, tripwire, engineDisable)
   * always amplify at full strength — they prove definitive tampering.
   *
   * Non-contradiction flags (suspectedSpoofing, telemetryIntegrityBroken) are dampened
   * when confidence is LOW or MEDIUM — these could be set by offline false positives.
   *
   * Counter-based amplifiers (consecutiveHigh, mismatchHistory) scale with confidence.
   */
  private getShadowAmplification(sf: ShadowFlags, confidence: VerificationConfidence): number {
    let amp = 1.0;

    // Contradiction-derived flags — full amplification always
    if (sf.premiumBypassEverDetected) amp += 0.3;
    if (sf.aiSpoofEverDetected) amp += 0.2;
    if (sf.integrityViolationDetected) amp += 0.4;
    if (sf.tripwireTriggered) amp += 0.5;
    if (sf.engineDisableDetected) amp += 0.3;

    // Non-contradiction flags — dampened by confidence
    const nonContradictionDampening =
      confidence === 'low'
        ? LOW_CONFIDENCE_SHADOW_DAMPENING
        : confidence === 'medium'
          ? MEDIUM_CONFIDENCE_SHADOW_DAMPENING
          : 1.0;

    if (sf.telemetryIntegrityBroken) amp += 0.2 * nonContradictionDampening;
    if (sf.suspectedSpoofing) amp += 0.15 * nonContradictionDampening;

    // Counter-based amplifiers — scaled by confidence dampening
    amp += Math.min(sf.consecutiveHighSessions * 0.1, 0.5) * nonContradictionDampening;
    amp += Math.min(sf.entitlementMismatchHistory * 0.05, 0.3);

    return amp;
  }

  private updateShadowFlags(_state: TamperStateGlobal): void {
    // Shadow flag updates happen in rules and integrity checks, not here.
    // Kept for future expansion.
  }

  // ── Decay ──

  private applyDecay(state: TamperStateGlobal, now: number): void {
    const elapsed = now - state.lastDecayTimestamp;
    if (elapsed < DECAY_INTERVAL_MS || state.riskScore <= 0) return;

    const decayCycles = Math.floor(elapsed / DECAY_INTERVAL_MS);
    let effectiveDecay = DECAY_AMOUNT;

    if (state.shadowFlags.premiumBypassEverDetected) effectiveDecay -= 2;
    if (state.shadowFlags.aiSpoofEverDetected) effectiveDecay -= 1;
    if (state.shadowFlags.telemetryIntegrityBroken) effectiveDecay -= 1;
    // Phase 14: integrity violations freeze decay further
    if (state.shadowFlags.integrityViolationDetected || state.shadowFlags.tripwireTriggered) effectiveDecay -= 1;

    effectiveDecay = Math.max(effectiveDecay, 0); // Can reach 0 = no decay

    // Phase 16: Accelerated decay for legitimate users
    // When confidence is LOW (offline) and no sticky shadow flags have been triggered,
    // decay ×2 so legitimate users recover quickly from any transient false positives.
    const hasStickyFlags =
      state.shadowFlags.premiumBypassEverDetected ||
      state.shadowFlags.aiSpoofEverDetected ||
      state.shadowFlags.integrityViolationDetected ||
      state.shadowFlags.tripwireTriggered;
    if (state.verificationConfidence === 'low' && !hasStickyFlags && effectiveDecay > 0) {
      effectiveDecay *= ACCELERATED_DECAY_MULTIPLIER;
    }

    state.riskScore = Math.max(0, state.riskScore - decayCycles * effectiveDecay);
    state.lastDecayTimestamp = now;
  }

  // ── Persistence ──

  private async restorePersistedState(): Promise<void> {
    const state = getGlobalState();
    if (state.persistenceLoaded) return;
    state.persistenceLoaded = true;

    try {
      const raw = await getAppState(PERSIST_KEY);
      if (!raw) return;
      const persisted: PersistedState = JSON.parse(raw);

      const sessionGapMs = Date.now() - persisted.lastSessionTimestamp;
      const sessionGapHours = sessionGapMs / (60 * 60 * 1000);
      const offlineDecay = Math.floor(sessionGapHours * 5);
      const hasHistory = persisted.shadowFlags.premiumBypassEverDetected || persisted.shadowFlags.aiSpoofEverDetected;
      // Phase 14: tripwires/integrity raise the floor
      const hasIntegrityIssue =
        persisted.shadowFlags.tripwireTriggered || persisted.shadowFlags.integrityViolationDetected;
      const minFloor = hasIntegrityIssue ? 20 : hasHistory ? 10 : 0;

      state.riskScore = Math.max(minFloor, persisted.riskScore - offlineDecay);
      state.degradationDay = persisted.degradationDay;

      // Apply pending penalties from previous session
      if (persisted.pendingPenalties > 0) {
        state.riskScore = Math.min(MAX_SCORE, state.riskScore + persisted.pendingPenalties);
      }

      state.shadowFlags = { ...createFreshShadowFlags(), ...persisted.shadowFlags };

      if (persisted.riskScore >= HIGH_THRESHOLD) {
        state.shadowFlags.consecutiveHighSessions += 1;
      } else {
        state.shadowFlags.consecutiveHighSessions = Math.max(0, state.shadowFlags.consecutiveHighSessions - 1);
      }

      if (persisted.riskScore >= HIGH_THRESHOLD && sessionGapHours >= 4) {
        state.degradationDay = Math.min(persisted.degradationDay + 1, 10);
      }

      // Phase 15: Restore false recovery state — reset on fresh sessions
      if (persisted.recoveryPhase && sessionGapHours < 1) {
        state.recoveryPhase = persisted.recoveryPhase;
        state.recoveryStartedAt = persisted.recoveryStartedAt || 0;
      } else {
        state.recoveryPhase = 'none';
      }

      // Phase 16: Restore verification confidence — degrade to LOW if >24h offline
      if (persisted.verificationConfidence && persisted.lastVerificationTimestamp) {
        if (sessionGapMs > CONFIDENCE_DECAY_MS) {
          state.verificationConfidence = 'low';
        } else {
          state.verificationConfidence = persisted.verificationConfidence;
          state.lastVerificationTimestamp = persisted.lastVerificationTimestamp;
        }
      } else {
        state.verificationConfidence = 'low'; // No persisted confidence → assume offline
      }

      // Phase 17: Restore session context for cross-session learning
      state.totalSessionCount = (persisted.totalSessionCount || 0) + 1;
      state.offlineSessionCount = persisted.offlineSessionCount || 0;
      if (persisted.networkReliabilitySamples) {
        state.networkReliabilitySamples = persisted.networkReliabilitySamples;
        const onlineCount = state.networkReliabilitySamples.filter(Boolean).length;
        state.deviceContext.networkReliability =
          state.networkReliabilitySamples.length > 0 ? onlineCount / state.networkReliabilitySamples.length : 0;
      }
      if (persisted.deviceMemoryClass) {
        state.deviceContext.memoryClass = persisted.deviceMemoryClass;
      }
      state.deviceContext.sessionCount = state.totalSessionCount;
      state.deviceContext.avgSessionDuration = sessionGapMs > 0 ? Math.min(sessionGapMs, 60 * 60 * 1000) : 0; // Approximate from gap
      // Track offline session if confidence was LOW at persistence time
      if (state.verificationConfidence === 'low') {
        state.offlineSessionCount += 1;
        state.offlineStartTimestamp = Date.now();
      }
      state.deviceContext.offlineSessionRatio =
        state.totalSessionCount > 0 ? state.offlineSessionCount / state.totalSessionCount : 0;

      if (__DEV__) {
        console.warn(
          '[TamperEngine] Restored: score=',
          state.riskScore,
          'day=',
          state.degradationDay,
          'confidence=',
          state.verificationConfidence,
          'flags=',
          state.shadowFlags,
        );
      }
    } catch {
      // Corrupted state — start fresh
    }
  }

  private async persistState(): Promise<void> {
    const state = getGlobalState();
    try {
      // Sum pending delayed penalties for cross-session persistence
      const pendingPoints = state.delayedPenalties.reduce((sum, p) => sum + p.points, 0);
      const persisted: PersistedState = {
        riskScore: state.riskScore,
        shadowFlags: { ...state.shadowFlags },
        degradationDay: state.degradationDay,
        lastSessionTimestamp: Date.now(),
        pendingPenalties: pendingPoints,
        recoveryPhase: state.recoveryPhase,
        recoveryStartedAt: state.recoveryStartedAt,
        // Phase 16: Persist verification confidence
        verificationConfidence: state.verificationConfidence,
        lastVerificationTimestamp: state.lastVerificationTimestamp,
        // Phase 17: Persist session context for cross-session learning
        offlineSessionCount: state.offlineSessionCount,
        totalSessionCount: state.totalSessionCount,
        networkReliabilitySamples: state.networkReliabilitySamples,
        deviceMemoryClass: state.deviceContext.memoryClass,
      };
      await setAppState(PERSIST_KEY, JSON.stringify(persisted));
    } catch {
      // Best effort
    }
  }

  // ── Heartbeat ──

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      this.evaluate();
    }, HEARTBEAT_INTERVAL_MS);
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const tamperEngine = new TamperEngine();
