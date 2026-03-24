/**
 * ENGINE — Behavioral Signal Engine
 *
 * Produces daily contextual signals based on real data.
 * Adapts tone to user's behavioral mode (INCONSISTENT / DISCIPLINED).
 *
 * Design principles:
 * - Precise, honest, non-emotional, non-coercive
 * - Reflects reality and supports growth
 * - INCONSISTENT mode: lower barrier, reduce friction
 * - DISCIPLINED mode: sharper feedback, maintain challenge
 *
 * Deterministic. No AI calls. No network. All math on-device.
 */

import {
  getRecentSessions,
  getStreak,
  getUserProfile,
} from '../database/service';
import { getCachedReadiness, type ReadinessSnapshot } from './ReadinessEngine';
import { getAverageFatigue } from './recoveryEngine';
import { classifyConsistency, type BehavioralMode } from './ConsistencyClassifier';
import type { WorkoutSession } from '../database/types';
import { t } from '../i18n/engine-i18n';

// ============================================
// TYPES
// ============================================

export type SignalUrgency = 'HIGH' | 'MEDIUM' | 'LOW';
export type SignalType =
  | 'EXPECT_TODAY'
  | 'STREAK_AT_RISK'
  | 'STREAK_BUILDING'
  | 'RECOVERY_READY'
  | 'REST_ADVISED'
  | 'COMEBACK'
  | 'MOMENTUM'
  | 'FIRST_SESSION'
  | 'TRANSITION';

export interface BehavioralSignal {
  type: SignalType;
  urgency: SignalUrgency;
  /** The one-liner displayed to user. Max 60 chars. */
  headline: string;
  /** Supporting context. Max 100 chars. */
  subtext: string;
  /** Icon name for MaterialCommunityIcons */
  icon: string;
  /** Accent color key from theme */
  colorKey: 'accent' | 'warning' | 'error' | 'success' | 'blue';
  /** Should the signal pulse/animate to draw attention? */
  pulse: boolean;
  /** Current behavioral mode used to generate this signal */
  behavioralMode: BehavioralMode;
}

// ============================================
// CORE SIGNAL GENERATOR
// ============================================

/**
 * Generate the single most important behavioral signal for right now.
 * Adapts language based on consistency classification.
 * Only one signal at a time — the system speaks with one voice.
 */
export async function getDailySignal(userId: string): Promise<BehavioralSignal> {
  const [streakData, sessions, profile, readiness, avgFatigue, consistency] = await Promise.all([
    getStreak(userId).catch(() => ({ current: 0, longest: 0 })),
    getRecentSessions(userId, 7).catch(() => [] as WorkoutSession[]),
    getUserProfile(userId).catch(() => null),
    getCachedReadiness(userId).catch(() => null as ReadinessSnapshot | null),
    getAverageFatigue(userId).catch(() => 0),
    classifyConsistency(userId).catch(() => ({
      mode: 'INCONSISTENT' as BehavioralMode,
      consistencyScore: 0,
      sessionsCompleted: 0,
      sessionsExpected: 0,
      avgCompletionRate: 0,
      streakRatio: 0,
      transitionDetected: false,
      transitionDirection: null,
      statusLine: '',
    })),
  ]);

  const mode = consistency.mode;
  const streak = streakData.current;
  const readinessScore = readiness?.score ?? 50;
  const lastCompleted = sessions.find((s) => s.completed_at);
  const hoursSinceLastWorkout = lastCompleted?.completed_at
    ? (Date.now() - new Date(lastCompleted.completed_at).getTime()) / 3600000
    : null;
  const trainedToday = sessions.some((s) => {
    if (!s.completed_at) return false;
    return new Date(s.completed_at).toDateString() === new Date().toDateString();
  });

  // ── PRIORITY 0: Mode transition detected
  if (consistency.transitionDetected && consistency.transitionDirection) {
    return {
      type: 'TRANSITION',
      urgency: 'MEDIUM',
      headline: consistency.statusLine,
      subtext: consistency.transitionDirection === 'advancing'
        ? t('signal.transition.advancing.subtext')
        : t('signal.transition.regressing.subtext'),
      icon: consistency.transitionDirection === 'advancing' ? 'arrow-up-bold' : 'tune-vertical',
      colorKey: consistency.transitionDirection === 'advancing' ? 'success' : 'blue',
      pulse: false,
      behavioralMode: mode,
    };
  }

  // ── PRIORITY 1: First session ever
  if (!lastCompleted) {
    return {
      type: 'FIRST_SESSION',
      urgency: 'HIGH',
      headline: t('signal.firstSession.headline'),
      subtext: t('signal.firstSession.subtext'),
      icon: 'rocket-launch',
      colorKey: 'accent',
      pulse: true,
      behavioralMode: mode,
    };
  }

  // ── PRIORITY 2: Streak continuity (data-based, not urgency-based)
  if (streak > 0 && !trainedToday && hoursSinceLastWorkout !== null && hoursSinceLastWorkout > 20) {
    return {
      type: 'STREAK_AT_RISK',
      urgency: 'MEDIUM',
      headline: t('signal.streakAtRisk.headline', { streak: String(streak) }),
      subtext: mode === 'DISCIPLINED'
        ? t('signal.streakAtRisk.subtext.disciplined')
        : t('signal.streakAtRisk.subtext.inconsistent'),
      icon: 'fire',
      colorKey: 'warning',
      pulse: false,
      behavioralMode: mode,
    };
  }

  // ── PRIORITY 3: Rest advised (high fatigue or low readiness)
  if (avgFatigue > 70 || readinessScore < 25) {
    return {
      type: 'REST_ADVISED',
      urgency: 'MEDIUM',
      headline: t('signal.restAdvised.headline'),
      subtext: avgFatigue > 70
        ? t('signal.restAdvised.subtext.fatigue', { fatigue: String(Math.round(avgFatigue)) })
        : t('signal.restAdvised.subtext.readiness', { readiness: String(readinessScore) }),
      icon: 'battery-charging',
      colorKey: 'blue',
      pulse: false,
      behavioralMode: mode,
    };
  }

  // ── PRIORITY 4: Already trained today
  if (trainedToday) {
    return {
      type: 'MOMENTUM',
      urgency: 'LOW',
      headline: t('signal.momentum.headline'),
      subtext: streak > 1
        ? t('signal.momentum.subtext.streak', { streak: String(streak) })
        : t('signal.momentum.subtext.default'),
      icon: 'check-circle',
      colorKey: 'success',
      pulse: false,
      behavioralMode: mode,
    };
  }

  // ── PRIORITY 5: Comeback after break
  if (hoursSinceLastWorkout !== null && hoursSinceLastWorkout > 72) {
    const days = Math.floor(hoursSinceLastWorkout / 24);
    return {
      type: 'COMEBACK',
      urgency: 'MEDIUM',
      headline: mode === 'INCONSISTENT'
        ? t('signal.comeback.headline.inconsistent', { days: String(days) })
        : t('signal.comeback.headline.disciplined', { days: String(days) }),
      subtext: mode === 'INCONSISTENT'
        ? t('signal.comeback.subtext.inconsistent')
        : t('signal.comeback.subtext.disciplined'),
      icon: 'arrow-u-left-top',
      colorKey: 'accent',
      pulse: false,
      behavioralMode: mode,
    };
  }

  // ── PRIORITY 6: Recovery complete — ready to train
  if (readinessScore >= 65) {
    return {
      type: 'RECOVERY_READY',
      urgency: 'MEDIUM',
      headline: mode === 'DISCIPLINED'
        ? t('signal.recoveryReady.headline.disciplined')
        : t('signal.recoveryReady.headline.inconsistent'),
      subtext: t('signal.recoveryReady.subtext', { readiness: String(readinessScore) }),
      icon: 'lightning-bolt',
      colorKey: 'accent',
      pulse: false,
      behavioralMode: mode,
    };
  }

  // ── PRIORITY 7: Streak building
  if (streak >= 3) {
    return {
      type: 'STREAK_BUILDING',
      urgency: 'LOW',
      headline: t('signal.streakBuilding.headline', { streak: String(streak) }),
      subtext: mode === 'DISCIPLINED'
        ? t('signal.streakBuilding.subtext.disciplined')
        : t('signal.streakBuilding.subtext.inconsistent'),
      icon: 'trending-up',
      colorKey: 'success',
      pulse: false,
      behavioralMode: mode,
    };
  }

  // ── DEFAULT: Schedule-based
  return {
    type: 'EXPECT_TODAY',
    urgency: 'LOW',
    headline: mode === 'DISCIPLINED'
      ? t('signal.expectToday.headline.disciplined')
      : t('signal.expectToday.headline.inconsistent'),
    subtext: readinessScore >= 50
      ? t('signal.expectToday.subtext.good', { readiness: String(readinessScore) })
      : t('signal.expectToday.subtext.moderate'),
    icon: 'calendar-check',
    colorKey: 'accent',
    pulse: false,
    behavioralMode: mode,
  };
}
