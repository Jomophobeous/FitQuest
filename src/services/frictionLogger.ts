/**
 * SERVICE — Friction Logger (Block X)
 *
 * Detects user struggle signals from interaction patterns.
 * All events go through existing logEvent().
 *
 * Tracked signals:
 * - Rapid back navigation (2+ backs within 3s)
 * - Repeated taps on disabled UI (3+ taps within 2s)
 * - Abandoned flows (navigated away from multi-step flow)
 * - Error screen encounters
 *
 * Designed to be called from InteractionManager and NavigationGuard.
 */

import { logEvent } from './telemetry';

// ============================================
// STATE
// ============================================

let _backTimestamps: number[] = [];
let _disabledTapTimestamps: number[] = [];

const BACK_WINDOW_MS = 3000;
const DISABLED_TAP_WINDOW_MS = 2000;
const RAPID_BACK_THRESHOLD = 2;
const DISABLED_TAP_THRESHOLD = 3;

// ============================================
// DETECTORS
// ============================================

/**
 * Record a back navigation event.
 * Detects rapid back-navigation (frustration signal).
 * Call from NavigationGuard.back().
 */
export function recordBackNavigation(fromRoute: string): void {
  const now = Date.now();
  _backTimestamps = _backTimestamps.filter((t) => now - t < BACK_WINDOW_MS);
  _backTimestamps.push(now);

  if (_backTimestamps.length >= RAPID_BACK_THRESHOLD) {
    void logEvent('friction_rapid_back', {
      from_route: fromRoute,
      count: _backTimestamps.length,
      window_ms: BACK_WINDOW_MS,
      timestamp: now,
    });
    _backTimestamps = []; // Reset after detection
  }
}

/**
 * Record a tap on disabled/non-interactive UI.
 * Detects confusion or frustration with disabled states.
 * Call from UI components with disabled buttons.
 */
export function recordDisabledTap(elementId: string, screenName: string): void {
  const now = Date.now();
  _disabledTapTimestamps = _disabledTapTimestamps.filter((t) => now - t < DISABLED_TAP_WINDOW_MS);
  _disabledTapTimestamps.push(now);

  if (_disabledTapTimestamps.length >= DISABLED_TAP_THRESHOLD) {
    void logEvent('friction_disabled_tap_spam', {
      element_id: elementId,
      screen: screenName,
      count: _disabledTapTimestamps.length,
      window_ms: DISABLED_TAP_WINDOW_MS,
      timestamp: now,
    });
    _disabledTapTimestamps = []; // Reset after detection
  }
}

/**
 * Log when a user abandons a multi-step flow.
 * Call when navigating away from onboarding, workout creation, etc.
 */
export function logFlowAbandoned(flowName: string, atStep: number, totalSteps: number): void {
  void logEvent('friction_flow_abandoned', {
    flow: flowName,
    at_step: atStep,
    total_steps: totalSteps,
    completion_percent: Math.round((atStep / totalSteps) * 100),
    timestamp: Date.now(),
  });
}

/**
 * Log when a user encounters an error screen.
 */
export function logErrorScreenShown(screenName: string, errorMessage: string): void {
  void logEvent('friction_error_screen', {
    screen: screenName,
    error: errorMessage.slice(0, 200),
    timestamp: Date.now(),
  });
}

/**
 * Reset all friction detection state.
 * Call on app foreground to avoid stale data.
 */
export function resetFrictionState(): void {
  _backTimestamps = [];
  _disabledTapTimestamps = [];
}
