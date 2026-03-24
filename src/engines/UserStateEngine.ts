/**
 * ENGINE — User State Consolidation Layer
 *
 * Single source of truth for all engine-derived user state.
 * All engines read/write through this object. No fragmentation.
 *
 * Aggregates:
 * - ConsistencyClassifier → behavioralMode, consistencyScore
 * - LongTermProgressionEngine → strengthTrends, volumeTolerance, recoveryRate
 * - FailureAnalysisEngine → failurePattern
 * - RecoveryEngine → fatigueMap, deloadStatus
 * - TrialProgressionEngine → trialPhase
 * - BehavioralSignalEngine → currentSignal
 *
 * Cached in memory. Refreshed on demand. All fields nullable (loading gate).
 *
 * Deterministic. No AI. No network.
 */

import { classifyConsistency, type ConsistencyProfile, type BehavioralMode } from './ConsistencyClassifier';
import { getProgressionProfile, type ProgressionProfile } from './LongTermProgressionEngine';
import { getFailurePattern, type FailurePattern } from './FailureAnalysisEngine';
import { getFatigueSnapshot, getAverageFatigue, checkDeloadStatus, type FatigueSnapshot, type DeloadStatus } from './recoveryEngine';
import { getTrialSnapshot, type TrialPhase, type TrialSnapshot } from './TrialProgressionEngine';
import { getDailySignal, type BehavioralSignal } from './BehavioralSignalEngine';

// ============================================
// TYPES
// ============================================

/** Complete consolidated user state — everything the system knows about a user */
export interface UserState {
  userId: string;
  /** Behavioral classification */
  consistencyScore: number;
  behavioralMode: BehavioralMode;
  /** Fatigue map (per-muscle) */
  fatigueMap: FatigueSnapshot[];
  averageFatigue: number;
  /** Deload status */
  deloadStatus: DeloadStatus;
  /** Progression profile (long-term trends) */
  progressionProfile: ProgressionProfile;
  /** Failure analysis pattern */
  failurePattern: FailurePattern;
  /** Trial phase */
  trialPhase: TrialPhase;
  /** Full trial snapshot (for UI) */
  trialSnapshot: TrialSnapshot;
  /** Current behavioral signal */
  currentSignal: BehavioralSignal | null;
  /** Full consistency profile */
  consistency: ConsistencyProfile;
  /** When this state was last refreshed */
  refreshedAt: number;
}

// ============================================
// CACHE
// ============================================

/** In-memory cache. Invalidated on refresh. */
let _cachedState: UserState | null = null;
let _cacheUserId: string | null = null;
/** Maximum cache age in ms (2 minutes) */
const CACHE_TTL_MS = 2 * 60 * 1000;

// ============================================
// CORE
// ============================================

/**
 * Get consolidated user state. Uses cache if fresh.
 * This is the single entry point for all user state queries.
 *
 * @param userId - User ID
 * @param isSubscribed - Whether user has active subscription (for trial gating)
 * @param forceRefresh - Skip cache and recompute
 */
export async function getUserState(
  userId: string,
  isSubscribed = false,
  forceRefresh = false,
): Promise<UserState> {
  // Return cache if valid
  if (
    !forceRefresh &&
    _cachedState &&
    _cacheUserId === userId &&
    Date.now() - _cachedState.refreshedAt < CACHE_TTL_MS
  ) {
    return _cachedState;
  }

  // Parallel fetch all engine data
  const [
    consistency,
    progressionProfile,
    failurePattern,
    fatigueMap,
    averageFatigue,
    deloadStatus,
    trialSnapshot,
    currentSignal,
  ] = await Promise.all([
    classifyConsistency(userId).catch(() => defaultConsistency()),
    getProgressionProfile(userId).catch(() => defaultProgression()),
    getFailurePattern(userId).catch(() => defaultFailurePattern()),
    getFatigueSnapshot(userId).catch(() => [] as FatigueSnapshot[]),
    getAverageFatigue(userId).catch(() => 0),
    checkDeloadStatus(userId).catch(() => defaultDeload()),
    getTrialSnapshot(userId, isSubscribed).catch(() => defaultTrialSnapshot()),
    getDailySignal(userId).catch(() => null as BehavioralSignal | null),
  ]);

  const state: UserState = {
    userId,
    consistencyScore: consistency.consistencyScore,
    behavioralMode: consistency.mode,
    fatigueMap,
    averageFatigue,
    deloadStatus,
    progressionProfile,
    failurePattern,
    trialPhase: trialSnapshot.phase,
    trialSnapshot,
    currentSignal,
    consistency,
    refreshedAt: Date.now(),
  };

  // Cache
  _cachedState = state;
  _cacheUserId = userId;

  return state;
}

/**
 * Invalidate cached state. Call after:
 * - Workout completion
 * - Profile changes
 * - Subscription changes
 */
export function invalidateUserState(): void {
  _cachedState = null;
  _cacheUserId = null;
}

/**
 * Get cached state without refreshing.
 * Returns null if no cache exists. Never triggers async work.
 */
export function getCachedUserState(): UserState | null {
  if (_cachedState && Date.now() - _cachedState.refreshedAt < CACHE_TTL_MS) {
    return _cachedState;
  }
  return null;
}

// ============================================
// DEFAULTS (for error fallbacks)
// ============================================

function defaultConsistency(): ConsistencyProfile {
  return {
    mode: 'INCONSISTENT',
    consistencyScore: 0,
    sessionsCompleted: 0,
    sessionsExpected: 0,
    avgCompletionRate: 0,
    streakRatio: 0,
    transitionDetected: false,
    transitionDirection: null,
    statusLine: 'Getting started.',
  };
}

function defaultProgression(): ProgressionProfile {
  return {
    strengthTrends: [],
    volumeTolerance: { avgSetsPerSession: 0, canIncreaseVolume: false, volumeCompletionRate: 0, trend: 'stable' },
    recoveryRate: { avgPreSessionFatigue: 0, avgDaysBetweenSessions: 2, recoveryAdequate: true, speed: 'normal' },
    overloadRecommendation: { volumeMultiplier: 1.0, progressPatterns: [], maintainPatterns: [], summary: 'No data yet.' },
    computedAt: Date.now(),
  };
}

function defaultFailurePattern(): FailurePattern {
  return {
    sessionsAnalyzed: 0,
    failureCount: 0,
    failureRate: 0,
    dominantFailureType: 'NONE',
    avgDropOffPoint: null,
    trendWorsening: false,
    recommendation: 'No session data yet.',
  };
}

function defaultDeload(): DeloadStatus {
  return {
    should_deload: false,
    reasons: [],
    severity: 'none',
    days_until_scheduled: 28,
  };
}

function defaultTrialSnapshot(): TrialSnapshot {
  return {
    phase: 'NOT_STARTED',
    dayNumber: 0,
    daysRemaining: 14,
    hasFullAccess: true,
    hasIntelligence: true,
    hasMemory: false,
    hasSignals: true,
    previewAvailable: false,
    message: { type: 'NONE', headline: '', subtext: '', prominent: false, actionLabel: null, actionRoute: null },
    stats: null,
  };
}
