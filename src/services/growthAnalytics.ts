/**
 * SERVICE — Growth Analytics
 *
 * Structured event logging for conversion + retention funnel.
 * All events go through existing logEvent() (SQLite + PostHog).
 * No new storage layer. No new telemetry infrastructure.
 *
 * Event taxonomy:
 * - onboarding_*   → funnel tracking
 * - paywall_*      → revenue intelligence
 * - session_*      → engagement metrics
 * - friction_*     → struggle detection
 * - retention_*    → return behavior
 */

import { logEvent } from './telemetry';
import { getAppState, setAppState } from '../database/service';

// ============================================
// ONBOARDING FUNNEL (Block U)
// ============================================

const STEP_NAMES = [
  'age_gate',
  'data_consent',
  'medical_disclaimer',
  'welcome',
  'interests',
  'goal_selection',
  'experience_level',
  'body_profile',
  'training_schedule',
  'equipment',
  'permissions',
] as const;

export type OnboardingStepName = (typeof STEP_NAMES)[number];

/**
 * Log when a user views an onboarding step.
 * Call when step renders (via useEffect in onboarding).
 */
export function logOnboardingStepViewed(stepIndex: number): void {
  const stepName = STEP_NAMES[stepIndex] ?? `step_${stepIndex}`;
  void logEvent('onboarding_step_viewed', {
    step_index: stepIndex,
    step_name: stepName,
    total_steps: STEP_NAMES.length,
    timestamp: Date.now(),
  });
}

/**
 * Log when a user completes (advances past) an onboarding step.
 */
export function logOnboardingStepCompleted(stepIndex: number): void {
  const stepName = STEP_NAMES[stepIndex] ?? `step_${stepIndex}`;
  void logEvent('onboarding_step_completed', {
    step_index: stepIndex,
    step_name: stepName,
    total_steps: STEP_NAMES.length,
    timestamp: Date.now(),
  });
}

/**
 * Log when a user drops off (leaves without completing).
 * Call on unmount if onboarding was not finished.
 */
export function logOnboardingDropOff(lastStepIndex: number): void {
  const stepName = STEP_NAMES[lastStepIndex] ?? `step_${lastStepIndex}`;
  void logEvent('onboarding_drop_off', {
    last_step_index: lastStepIndex,
    last_step_name: stepName,
    completion_percent: Math.round((lastStepIndex / STEP_NAMES.length) * 100),
    timestamp: Date.now(),
  });
}

/**
 * Log successful onboarding completion.
 */
export function logOnboardingCompleted(durationMs: number): void {
  void logEvent('onboarding_completed', {
    duration_ms: durationMs,
    timestamp: Date.now(),
  });
}

// ============================================
// PAYWALL INTELLIGENCE (Block V)
// ============================================

/**
 * Log paywall view with context (what triggered it).
 */
export function logPaywallViewed(trigger: 'trial_expiry' | 'feature_gate' | 'manual' | 'onboarding'): void {
  void logEvent('paywall_viewed', {
    trigger,
    timestamp: Date.now(),
  });
}

/**
 * Log paywall dismissed without conversion.
 */
export function logPaywallClosed(viewDurationMs: number): void {
  void logEvent('paywall_closed', {
    view_duration_ms: viewDurationMs,
    timestamp: Date.now(),
  });
}

/**
 * Log successful paywall conversion.
 */
export function logPaywallConverted(plan: 'monthly' | 'annual', viewDurationMs: number): void {
  void logEvent('paywall_converted', {
    plan,
    view_duration_ms: viewDurationMs,
    timestamp: Date.now(),
  });
}

// ============================================
// RETENTION EVENTS (Block W)
// ============================================

/**
 * Log a daily app return (once per day max).
 */
export async function logDailyReturn(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]!;
  const lastReturn = await getAppState('growth.last_daily_return').catch(() => null);
  if (lastReturn === today) return; // Already logged today
  await setAppState('growth.last_daily_return', today);
  void logEvent('retention_daily_return', {
    date: today,
    timestamp: Date.now(),
  });
}

/**
 * Log when a "next action" CTA is shown on dashboard.
 */
export function logNextActionShown(actionType: string): void {
  void logEvent('retention_next_action_shown', {
    action_type: actionType,
    timestamp: Date.now(),
  });
}

/**
 * Log when user follows through on a "next action" CTA.
 */
export function logNextActionTaken(actionType: string): void {
  void logEvent('retention_next_action_taken', {
    action_type: actionType,
    timestamp: Date.now(),
  });
}
