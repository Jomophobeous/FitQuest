/**
 * ENGINE — State Simulation
 *
 * Predicts near-future user state based on current state + hypothetical actions.
 * "If user skips today: predict fatigue decrease, streak loss, mode regression."
 * "If user trains today: predict fatigue increase, streak extension, progression."
 *
 * Purpose:
 * - Show consequences before they happen
 * - Adjust tomorrow's workout proactively
 * - Surface actionable predictions ("Skipping today means recovery mode tomorrow.")
 *
 * Deterministic. No AI. No randomness. Pure state projection.
 */

import { getUserState, type UserState } from './UserStateEngine';
import { getStreak, getRecentSessions, getUserProfile } from '../database/service';
import { t } from '../i18n/engine-i18n';

// ============================================
// TYPES
// ============================================

export type SimulatedAction = 'SKIP' | 'TRAIN' | 'REST_DAY';

export interface StatePrediction {
  action: SimulatedAction;
  /** Projected fatigue after action (0-100) */
  projectedFatigue: number;
  /** Change in fatigue from current */
  fatigueDelta: number;
  /** Projected streak after action */
  projectedStreak: number;
  /** Whether streak would break */
  streakBreaks: boolean;
  /** Whether mode would shift */
  modeShift: boolean;
  /** Projected mode after action */
  projectedMode: 'INCONSISTENT' | 'DISCIPLINED';
  /** Human-readable consequence */
  insight: string;
  /** Recommendation for tomorrow's session */
  tomorrowRecommendation: 'normal' | 'recovery' | 'reduced' | 'push';
}

export interface SimulationReport {
  currentState: {
    fatigue: number;
    streak: number;
    mode: string;
  };
  predictions: StatePrediction[];
  bestAction: SimulatedAction;
  computedAt: number;
}

// ============================================
// CONSTANTS
// ============================================

/** Base daily fatigue recovery (points per rest day) */
const REST_DAY_RECOVERY = 12;
/** Base daily fatigue recovery on a skip day (less recovery than intentional rest) */
const SKIP_DAY_RECOVERY = 8;
/** Average fatigue added by a training session */
const TRAINING_FATIGUE_COST = 18;
/** Consistency threshold — sessions per 14 days to maintain DISCIPLINED */
const _DISCIPLINED_THRESHOLD = 4;
/** Days without training before streak breaks */
const STREAK_BREAK_DAYS = 2;

// ============================================
// CORE
// ============================================

/**
 * Simulate near-future state for each possible action.
 * Returns predictions for SKIP, TRAIN, and REST_DAY.
 */
export async function simulateNextDay(userId: string, isSubscribed = false): Promise<SimulationReport> {
  const [currentState, streak, recentSessions, profile] = await Promise.all([
    getUserState(userId, isSubscribed),
    getStreak(userId),
    getRecentSessions(userId, 14),
    getUserProfile(userId),
  ]);

  const currentFatigue = currentState.averageFatigue;
  const currentStreak = streak.current;
  const currentMode = currentState.behavioralMode;
  const trainingDays = profile?.training_days_per_week ?? 3;

  // Determine days since last session
  const daysSinceLastSession = computeDaysSinceLastSession(recentSessions);

  // Count sessions in last 14 days for mode prediction
  const recentSessionCount = recentSessions.filter((s) => s.completed_at != null).length;

  const predictions: StatePrediction[] = [
    simulateAction(
      'SKIP',
      currentFatigue,
      currentStreak,
      currentMode,
      daysSinceLastSession,
      recentSessionCount,
      trainingDays,
    ),
    simulateAction(
      'TRAIN',
      currentFatigue,
      currentStreak,
      currentMode,
      daysSinceLastSession,
      recentSessionCount,
      trainingDays,
    ),
    simulateAction(
      'REST_DAY',
      currentFatigue,
      currentStreak,
      currentMode,
      daysSinceLastSession,
      recentSessionCount,
      trainingDays,
    ),
  ];

  const bestAction = determineBestAction(predictions, currentFatigue, currentState);

  return {
    currentState: {
      fatigue: currentFatigue,
      streak: currentStreak,
      mode: currentMode,
    },
    predictions,
    bestAction,
    computedAt: Date.now(),
  };
}

/**
 * Get a single prediction for a specific action.
 * Lightweight — no full simulation report.
 */
export async function predictAction(
  userId: string,
  action: SimulatedAction,
  isSubscribed = false,
): Promise<StatePrediction> {
  const [currentState, streak, recentSessions, profile] = await Promise.all([
    getUserState(userId, isSubscribed),
    getStreak(userId),
    getRecentSessions(userId, 14),
    getUserProfile(userId),
  ]);

  const daysSinceLastSession = computeDaysSinceLastSession(recentSessions);
  const recentSessionCount = recentSessions.filter((s) => s.completed_at != null).length;

  return simulateAction(
    action,
    currentState.averageFatigue,
    streak.current,
    currentState.behavioralMode,
    daysSinceLastSession,
    recentSessionCount,
    profile?.training_days_per_week ?? 3,
  );
}

// ============================================
// SIMULATION LOGIC
// ============================================

function simulateAction(
  action: SimulatedAction,
  currentFatigue: number,
  currentStreak: number,
  currentMode: 'INCONSISTENT' | 'DISCIPLINED',
  daysSinceLastSession: number,
  recentSessionCount: number,
  trainingDaysPerWeek: number,
): StatePrediction {
  let projectedFatigue: number;
  let projectedStreak: number;
  let streakBreaks: boolean;
  let sessionCountDelta: number;
  let tomorrowRecommendation: StatePrediction['tomorrowRecommendation'];

  switch (action) {
    case 'SKIP':
      projectedFatigue = Math.max(0, currentFatigue - SKIP_DAY_RECOVERY);
      streakBreaks = daysSinceLastSession >= STREAK_BREAK_DAYS;
      projectedStreak = streakBreaks ? 0 : currentStreak;
      sessionCountDelta = 0;
      tomorrowRecommendation = projectedFatigue > 50 ? 'recovery' : 'normal';
      break;

    case 'TRAIN':
      projectedFatigue = Math.min(100, currentFatigue + TRAINING_FATIGUE_COST);
      streakBreaks = false;
      projectedStreak = currentStreak + 1;
      sessionCountDelta = 1;
      tomorrowRecommendation = projectedFatigue > 65 ? 'reduced' : projectedFatigue < 30 ? 'push' : 'normal';
      break;

    case 'REST_DAY':
      projectedFatigue = Math.max(0, currentFatigue - REST_DAY_RECOVERY);
      streakBreaks = daysSinceLastSession >= STREAK_BREAK_DAYS;
      projectedStreak = streakBreaks ? 0 : currentStreak;
      sessionCountDelta = 0;
      tomorrowRecommendation = 'normal';
      break;
  }

  // Predict mode shift
  const projectedSessionCount = recentSessionCount + sessionCountDelta;
  const projectedMode = predictMode(projectedSessionCount, trainingDaysPerWeek);
  const modeShift = projectedMode !== currentMode;

  const fatigueDelta = projectedFatigue - currentFatigue;

  const insight = buildInsight(action, streakBreaks, modeShift, projectedMode, fatigueDelta, tomorrowRecommendation);

  return {
    action,
    projectedFatigue: Math.round(projectedFatigue),
    fatigueDelta: Math.round(fatigueDelta),
    projectedStreak,
    streakBreaks,
    modeShift,
    projectedMode,
    insight,
    tomorrowRecommendation,
  };
}

function predictMode(sessionsIn14Days: number, trainingDaysPerWeek: number): 'INCONSISTENT' | 'DISCIPLINED' {
  // 14 days = 2 weeks. Expected sessions = trainingDaysPerWeek * 2.
  const expected = trainingDaysPerWeek * 2;
  const ratio = expected > 0 ? sessionsIn14Days / expected : 0;
  return ratio >= 0.5 ? 'DISCIPLINED' : 'INCONSISTENT';
}

function determineBestAction(
  predictions: StatePrediction[],
  currentFatigue: number,
  currentState: UserState,
): SimulatedAction {
  // High fatigue → rest
  if (currentFatigue > 65) return 'REST_DAY';
  // Streak at risk → train
  const skipPrediction = predictions.find((p) => p.action === 'SKIP');
  if (skipPrediction?.streakBreaks) return 'TRAIN';
  // Mode regression risk → train
  const skipModeShift = skipPrediction?.modeShift && skipPrediction.projectedMode === 'INCONSISTENT';
  if (skipModeShift && currentState.behavioralMode === 'DISCIPLINED') return 'TRAIN';
  // Default: train if fatigue allows
  if (currentFatigue < 40) return 'TRAIN';
  return 'REST_DAY';
}

// ============================================
// HELPERS
// ============================================

function computeDaysSinceLastSession(sessions: Array<{ completed_at?: string | null }>): number {
  const completed = sessions.filter((s) => s.completed_at != null);
  if (completed.length === 0) return 99;
  // Most recent first
  const sorted = [...completed].sort((a, b) => {
    const aTime = new Date(a.completed_at!).getTime();
    const bTime = new Date(b.completed_at!).getTime();
    return bTime - aTime;
  });
  const lastDate = new Date(sorted[0]!.completed_at!);
  const now = new Date();
  const diffMs = now.getTime() - lastDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function buildInsight(
  action: SimulatedAction,
  streakBreaks: boolean,
  modeShift: boolean,
  projectedMode: string,
  fatigueDelta: number,
  tomorrowRec: string,
): string {
  const parts: string[] = [];

  switch (action) {
    case 'SKIP':
      if (streakBreaks) parts.push(t('simulation.skip.streakReset'));
      if (modeShift && projectedMode === 'INCONSISTENT') parts.push(t('simulation.skip.modeShift'));
      if (fatigueDelta < 0) parts.push(t('simulation.skip.fatigueDrop', { delta: String(Math.abs(fatigueDelta)) }));
      if (parts.length === 0) parts.push(t('simulation.skip.minimal'));
      break;

    case 'TRAIN':
      parts.push(t('simulation.train.fatigueUp', { delta: String(fatigueDelta) }));
      if (modeShift && projectedMode === 'DISCIPLINED') parts.push(t('simulation.train.modeAdvance'));
      if (tomorrowRec === 'reduced') parts.push(t('simulation.train.reduceTomorrow'));
      else if (tomorrowRec === 'push') parts.push(t('simulation.train.pushTomorrow'));
      break;

    case 'REST_DAY':
      parts.push(t('simulation.rest.recovery', { delta: String(Math.abs(fatigueDelta)) }));
      if (streakBreaks) parts.push(t('simulation.rest.streakReset'));
      if (tomorrowRec === 'normal') parts.push(t('simulation.rest.ready'));
      break;
  }

  return parts.join(' ');
}
