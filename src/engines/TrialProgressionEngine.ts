/**
 * ENGINE — Trial Progression Engine
 *
 * Manages the 14-day trial as a behavior installation phase.
 * Progressive feature exposure. Timed messaging. Fair transition.
 *
 * Monetization model:
 * - FREE (post-trial): Core workouts, exercise database, basic session tracking
 * - PAID (subscribed): Intelligence layers — AI insights, session memory, signals, progression
 * - During trial: Full access to everything. No restrictions.
 *
 * Design principles:
 * - hasCore = true (always)
 * - hasIntelligence = isSubscribed || isTrial
 * - hasMemory = isSubscribed || isTrial
 * - hasSignals = isSubscribed || isTrial
 * - Preview mode: locked panels show blurred/partial content to reinforce value
 * - Language: precise, honest, non-coercive
 *
 * Deterministic. No AI. No network.
 */

import { getTrialState, getTrialStats } from '../database/service';
import { t } from '../i18n/engine-i18n';

// ============================================
// TYPES
// ============================================

export type TrialPhase =
  | 'ONBOARDING' // Day 1–3: Light signals, first wins
  | 'DISCOVERY' // Day 4–7: Introduce memory, show improvements
  | 'DEEPENING' // Day 8–11: Full intelligence, pattern recognition
  | 'DECISION' // Day 12–14: Peak value + transparent transition notice
  | 'EXPIRED' // Post-trial: core works, intelligence locked
  | 'CONVERTED' // Paid subscriber
  | 'NOT_STARTED'; // No trial yet

export type TrialMessageType =
  | 'WELCOME'
  | 'FIRST_WIN'
  | 'MEMORY_INTRO'
  | 'IMPROVEMENT_SHOWN'
  | 'PATTERN_DETECTED'
  | 'FULL_INTELLIGENCE'
  | 'TRIAL_TRANSITION_SOFT'
  | 'TRIAL_TRANSITION_CLEAR'
  | 'TRIAL_ENDED'
  | 'NONE';

export interface TrialMessage {
  type: TrialMessageType;
  headline: string;
  subtext: string;
  /** Whether to show in a prominent card vs subtle badge */
  prominent: boolean;
  /** Optional action label for CTA */
  actionLabel: string | null;
  /** Optional action route */
  actionRoute: string | null;
}

export interface TrialSnapshot {
  /** Current phase of the trial */
  phase: TrialPhase;
  /** Day number (1-14, or 0 if not started, 15+ if expired) */
  dayNumber: number;
  /** Days remaining (0 if expired) */
  daysRemaining: number;
  /** Whether the user has full premium access right now */
  hasFullAccess: boolean;
  /** Whether advanced intelligence features are available */
  hasIntelligence: boolean;
  /** Whether memory/session comparison is available */
  hasMemory: boolean;
  /** Whether behavioral signals are available */
  hasSignals: boolean;
  /** Whether locked panels should show blurred preview content */
  previewAvailable: boolean;
  /** Current trial message (may be NONE) */
  message: TrialMessage;
  /** Usage stats during trial */
  stats: TrialStats | null;
}

export interface TrialStats {
  workouts: number;
  pagesRead: number;
  stepsTotal: number;
  daysActive: number;
}

/** Feature availability by phase. Post-trial = core only. */
export interface FeatureGating {
  /** AI workout intelligence panel */
  aiInsights: boolean;
  /** Session memory / workout delta */
  sessionMemory: boolean;
  /** Behavioral signals on dashboard */
  behavioralSignals: boolean;
  /** Progression narratives */
  progressionNarratives: boolean;
  /** Health dashboard advanced analytics */
  advancedHealth: boolean;
  /** FitMind AI (Professor/Coach) */
  fitmindAI: boolean;
  /** Core workout generation (always available) */
  coreWorkouts: boolean;
  /** Exercise library (always available) */
  exerciseLibrary: boolean;
  /** Step tracking (always available) */
  stepTracking: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const TRIAL_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================
// CORE ENGINE
// ============================================

/**
 * Get complete trial snapshot for current user.
 * Single function call gives UI everything it needs.
 *
 * @param userId - User ID
 * @param isSubscribed - Whether user has an active paid subscription
 */
export async function getTrialSnapshot(userId: string, isSubscribed = false): Promise<TrialSnapshot> {
  const trial = await getTrialState(userId).catch(() => null);

  if (!trial) {
    return buildNotStarted();
  }

  if (trial.converted || isSubscribed) {
    return buildConverted();
  }

  const now = Date.now();
  const dayNumber = Math.max(1, Math.ceil((now - trial.started_at) / MS_PER_DAY));
  const daysRemaining = Math.max(0, TRIAL_DAYS - dayNumber + 1);
  const isExpired = now >= trial.ends_at;

  if (isExpired) {
    const stats = await getTrialStats(userId, trial.started_at).catch(() => null);
    return buildExpired(dayNumber, stats);
  }

  const phase = classifyPhase(dayNumber);
  const stats = await getTrialStats(userId, trial.started_at).catch(() => null);
  const message = buildMessage(phase, dayNumber, daysRemaining, stats);
  const gating = getFeatureGating(phase);

  return {
    phase,
    dayNumber,
    daysRemaining,
    hasFullAccess: true, // Full access during entire trial
    hasIntelligence: gating.aiInsights,
    hasMemory: gating.sessionMemory,
    hasSignals: gating.behavioralSignals,
    previewAvailable: false, // No preview needed during trial — everything is unlocked
    message,
    stats,
  };
}

/**
 * Get feature gating for a given trial phase.
 * During trial: progressive unlocking.
 * Post-trial: core stays, intelligence removed.
 */
export function getFeatureGating(phase: TrialPhase): FeatureGating {
  // Always available
  const core = {
    coreWorkouts: true,
    exerciseLibrary: true,
    stepTracking: true,
  };

  switch (phase) {
    case 'ONBOARDING':
      return {
        ...core,
        aiInsights: true,
        sessionMemory: false, // Not yet — let them build history first
        behavioralSignals: true,
        progressionNarratives: false,
        advancedHealth: true,
        fitmindAI: true,
      };

    case 'DISCOVERY':
      return {
        ...core,
        aiInsights: true,
        sessionMemory: true, // Day 4+: "Last session impact"
        behavioralSignals: true,
        progressionNarratives: true, // Day 4+: "You improved here"
        advancedHealth: true,
        fitmindAI: true,
      };

    case 'DEEPENING':
    case 'DECISION':
      return {
        ...core,
        aiInsights: true,
        sessionMemory: true,
        behavioralSignals: true,
        progressionNarratives: true,
        advancedHealth: true,
        fitmindAI: true,
      };

    case 'CONVERTED':
      return {
        ...core,
        aiInsights: true,
        sessionMemory: true,
        behavioralSignals: true,
        progressionNarratives: true,
        advancedHealth: true,
        fitmindAI: true,
      };

    case 'EXPIRED':
      // Core functionality stays. Intelligence layers removed.
      return {
        ...core,
        aiInsights: false,
        sessionMemory: false,
        behavioralSignals: false,
        progressionNarratives: false,
        advancedHealth: false,
        fitmindAI: false,
      };

    case 'NOT_STARTED':
    default:
      return {
        ...core,
        aiInsights: true,
        sessionMemory: false,
        behavioralSignals: true,
        progressionNarratives: false,
        advancedHealth: true,
        fitmindAI: true,
      };
  }
}

// ============================================
// PHASE CLASSIFICATION
// ============================================

function classifyPhase(dayNumber: number): TrialPhase {
  if (dayNumber <= 3) return 'ONBOARDING';
  if (dayNumber <= 7) return 'DISCOVERY';
  if (dayNumber <= 11) return 'DEEPENING';
  if (dayNumber <= TRIAL_DAYS) return 'DECISION';
  return 'EXPIRED';
}

// ============================================
// MESSAGE BUILDER
// ============================================

function buildMessage(
  phase: TrialPhase,
  dayNumber: number,
  daysRemaining: number,
  stats: TrialStats | null,
): TrialMessage {
  switch (phase) {
    case 'ONBOARDING': {
      if (dayNumber === 1) {
        return {
          type: 'WELCOME',
          headline: t('trial.welcome.headline'),
          subtext: t('trial.welcome.subtext'),
          prominent: true,
          actionLabel: null,
          actionRoute: null,
        };
      }
      if (stats && stats.workouts > 0) {
        return {
          type: 'FIRST_WIN',
          headline: t('trial.firstWin.headline', {
            workouts: String(stats.workouts),
            plural: stats.workouts > 1 ? 's' : '',
          }),
          subtext: t('trial.firstWin.subtext'),
          prominent: false,
          actionLabel: null,
          actionRoute: null,
        };
      }
      return {
        type: 'WELCOME',
        headline: t('trial.readyForFirst.headline', { day: String(dayNumber) }),
        subtext: t('trial.readyForFirst.subtext'),
        prominent: false,
        actionLabel: null,
        actionRoute: null,
      };
    }

    case 'DISCOVERY': {
      if (stats && stats.workouts >= 2) {
        return {
          type: 'IMPROVEMENT_SHOWN',
          headline: t('trial.improvementShown.headline'),
          subtext: t('trial.improvementShown.subtext'),
          prominent: true,
          actionLabel: null,
          actionRoute: null,
        };
      }
      return {
        type: 'MEMORY_INTRO',
        headline: t('trial.memoryIntro.headline'),
        subtext: t('trial.memoryIntro.subtext', { day: String(dayNumber) }),
        prominent: false,
        actionLabel: null,
        actionRoute: null,
      };
    }

    case 'DEEPENING': {
      return {
        type: 'FULL_INTELLIGENCE',
        headline: t('trial.fullIntelligence.headline'),
        subtext: t('trial.fullIntelligence.subtext', { day: String(dayNumber) }),
        prominent: false,
        actionLabel: null,
        actionRoute: null,
      };
    }

    case 'DECISION': {
      if (daysRemaining <= 2) {
        return {
          type: 'TRIAL_TRANSITION_CLEAR',
          headline: t('trial.transitionClear.headline', {
            days: String(daysRemaining),
            plural: daysRemaining === 1 ? '' : 's',
          }),
          subtext: t('trial.transitionClear.subtext'),
          prominent: true,
          actionLabel: t('trial.viewPlans'),
          actionRoute: '/paywall',
        };
      }
      return {
        type: 'TRIAL_TRANSITION_SOFT',
        headline: t('trial.transitionSoft.headline', { days: String(daysRemaining) }),
        subtext: t('trial.transitionSoft.subtext'),
        prominent: false,
        actionLabel: t('trial.viewPlans'),
        actionRoute: '/paywall',
      };
    }

    default:
      return { type: 'NONE', headline: '', subtext: '', prominent: false, actionLabel: null, actionRoute: null };
  }
}

// ============================================
// STATE BUILDERS
// ============================================

function buildNotStarted(): TrialSnapshot {
  return {
    phase: 'NOT_STARTED',
    dayNumber: 0,
    daysRemaining: TRIAL_DAYS,
    hasFullAccess: true,
    hasIntelligence: true,
    hasMemory: false,
    hasSignals: true,
    previewAvailable: false,
    message: {
      type: 'WELCOME',
      headline: t('trial.welcome.headline'),
      subtext: t('trial.welcome.subtext'),
      prominent: true,
      actionLabel: null,
      actionRoute: null,
    },
    stats: null,
  };
}

function buildConverted(): TrialSnapshot {
  return {
    phase: 'CONVERTED',
    dayNumber: 0,
    daysRemaining: 0,
    hasFullAccess: true,
    hasIntelligence: true,
    hasMemory: true,
    hasSignals: true,
    previewAvailable: false,
    message: { type: 'NONE', headline: '', subtext: '', prominent: false, actionLabel: null, actionRoute: null },
    stats: null,
  };
}

/**
 * Post-trial, not subscribed:
 * - Core features remain (workouts, exercises, steps)
 * - Intelligence layers locked (AI insight, memory, signals)
 * - Preview mode active — blurred/partial content visible to reinforce value
 */
function buildExpired(dayNumber: number, stats: TrialStats | null): TrialSnapshot {
  const workoutCount = stats?.workouts ?? 0;
  return {
    phase: 'EXPIRED',
    dayNumber,
    daysRemaining: 0,
    hasFullAccess: false,
    hasIntelligence: false,
    hasMemory: false,
    hasSignals: false,
    previewAvailable: true, // Show blurred previews to reinforce value
    message: {
      type: 'TRIAL_ENDED',
      headline: t('trial.expired.headline'),
      subtext:
        workoutCount > 0
          ? t('trial.expired.subtext.withWorkouts', { workouts: String(workoutCount) })
          : t('trial.expired.subtext.noWorkouts'),
      prominent: true,
      actionLabel: t('trial.viewPlans'),
      actionRoute: '/paywall',
    },
    stats,
  };
}
